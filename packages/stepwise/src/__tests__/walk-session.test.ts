import { describe, expect, it } from "vitest";
import { createWalkSession } from "../walk-session";
import { runWalk, type WalkSimulation, type WalkStep } from "../walk";

type W = WalkStep & { r?: number };
type AB = "a" | "b";
const s = (key: string, extra?: Partial<W>): W => ({ key, tone: "neutral", label: key, ...extra });

// Branches at every round, draws from the seeded rng (so a resumed generator
// and a replayed one must agree on the rng state too), and mixes `await`
// choice points with prompt-only ones.
const rounds: WalkSimulation<number, W, AB> = function* (n, { rng }) {
  yield s("intro");
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? yield s(`ask${i}`, { await: true }) : yield s(`ask${i}`, { prompt: { id: `p${i}` } });
    const len = c === "a" ? 1 : 2;
    for (let j = 0; j < len; j++) yield s(`${c ?? "skip"}${i}.${j}`, { r: rng.int(0, 100) });
  }
  yield s("end");
};

const counted = () => {
  const counter = { created: 0 };
  const sim: WalkSimulation<number, W, AB> = (n, ctx) => {
    counter.created++;
    return rounds(n, ctx);
  };
  return { sim, counter };
};

describe("createWalkSession", () => {
  it("continuing equals replaying", () => {
    const { sim, counter } = counted();
    const session = createWalkSession(sim, 4, { seed: 3 });
    const answers: (AB | undefined)[] = ["a", "b", "a", "b"];
    for (let k = 0; k <= answers.length; k++) {
      const choices = answers.slice(0, k);
      expect(session.run(choices)).toEqual(runWalk(rounds, 4, { seed: 3, choices }));
    }
    // One generator for the whole forward run.
    expect(counter.created).toBe(1);
  });

  it("continuing equals replaying with skipped prompts and extra answers", () => {
    const session = createWalkSession(rounds, 3, { seed: "x" });
    for (const choices of [[], ["b"], ["b", undefined], ["b", undefined, "a"], ["b", undefined, "a", "b", "a"]] as (
      | AB
      | undefined
    )[][]) {
      expect(session.run(choices)).toEqual(runWalk(rounds, 3, { seed: "x", choices }));
    }
  });

  it("applies the cap since the last choice point, like runWalk", () => {
    const loop: WalkSimulation<null, W, AB> = function* () {
      for (let i = 0; ; i++) {
        yield s(`ask${i}`, { await: true });
        for (let j = 0; j < 3; j++) yield s(`s${i}.${j}`);
      }
    };
    // Three steps, then the next choice point: a cap of 4 lets the run go on forever.
    const session = createWalkSession(loop, null, { maxSteps: 4 });
    for (const choices of [["a"], ["a", "b"], ["a", "b", "a"]] as AB[][]) {
      const r = session.run(choices);
      expect(r).toEqual(runWalk(loop, null, { maxSteps: 4, choices }));
      expect(r.awaiting).toBe(true);
    }
    const capped = createWalkSession(loop, null, { maxSteps: 3 }).run(["a"]);
    expect(capped).toEqual(runWalk(loop, null, { maxSteps: 3, choices: ["a"] }));
    expect(capped.truncated).toBe(true);
  });

  it("a changed earlier answer replays", () => {
    const { sim, counter } = counted();
    const session = createWalkSession(sim, 3);
    session.run([]);
    session.run(["a"]);
    expect(counter.created).toBe(1);
    const changed = session.run(["b"]);
    expect(counter.created).toBe(2);
    expect(changed).toEqual(runWalk(rounds, 3, { choices: ["b"] }));
  });

  it("the same choices return the same result without touching the generator", () => {
    const { sim, counter } = counted();
    const session = createWalkSession(sim, 2);
    const r = session.run(["a"]);
    expect(session.run(["a"])).toBe(r);
    expect(counter.created).toBe(1);
  });

  it("never mutates a result it returned", () => {
    const session = createWalkSession(rounds, 3);
    const r = session.run([]);
    const snapshot = structuredClone(r);
    session.run(["a", "b"]);
    expect(r).toEqual(snapshot);
  });

  it("the generator is not resumed after a result is returned that the caller then discards by remount", () => {
    // StrictMode: the first render's session advanced, its result was thrown
    // away, and a fresh session (the remount) runs the same answers again.
    const answers: AB[] = ["b", "a", "b"];
    const discarded = createWalkSession(rounds, 3, { seed: 9 });
    const remounted = createWalkSession(rounds, 3, { seed: 9 });
    for (let k = 0; k <= answers.length; k++) {
      const choices = answers.slice(0, k);
      const a = discarded.run(choices);
      // The discarded session is asked again (a double-invoked memo).
      expect(discarded.run(choices.slice())).toBe(a);
      expect(remounted.run(choices)).toEqual(a);
      expect(a).toEqual(runWalk(rounds, 3, { seed: 9, choices }));
    }
  });

  it("a throwing generator: error kept, the next run replays", () => {
    const boom = new Error("boom");
    const counter = { created: 0 };
    const throwing: WalkSimulation<null, W, AB> = function* () {
      counter.created++;
      const c = yield s("ask", { await: true });
      yield s(`after-${c}`);
      if (c === "b") throw boom;
      yield s("ask2", { await: true });
      yield s("end");
    };
    const session = createWalkSession(throwing, null);
    session.run([]);
    const failed = session.run(["b"]);
    expect(failed.error).toBe(boom);
    expect(failed).toEqual(runWalk(throwing, null, { choices: ["b"] }));
    const created = counter.created;
    const again = session.run(["b", "a"]);
    expect(counter.created).toBe(created + 1);
    expect(again.error).toBe(boom);
    const fixed = session.run(["a", "a"]);
    expect(fixed.error).toBeNull();
    expect(fixed.steps.map((x) => x.key)).toEqual(["ask", "after-a", "ask2", "end"]);
  });

  it("closes the live generator's finally blocks when it replays or closes", () => {
    const closed: string[] = [];
    const guarded: WalkSimulation<string, W, AB> = function* (tag) {
      try {
        yield s("ask", { await: true });
        yield s("ask2", { await: true });
      } finally {
        closed.push(tag);
      }
    };
    const session = createWalkSession(guarded, "one");
    session.run([]);
    expect(closed).toEqual([]);
    session.run(["b"]);
    expect(closed).toEqual([]);
    session.run(["a"]); // changed answer: replay closes the old generator
    expect(closed).toEqual(["one"]);
    session.close();
    expect(closed).toEqual(["one", "one"]);
    // After close, a run replays.
    expect(session.run(["a"])).toEqual(runWalk(guarded, "one", { choices: ["a"] }));
  });
});
