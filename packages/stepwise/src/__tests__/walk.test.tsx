import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { isChoicePoint, runWalk, type WalkSimulation, type WalkStep } from "../walk";
import { diffTraces, structuralEqual } from "../diff-traces";
import { fromGraph } from "../graph";
import { runSimulation } from "../simulation";
import { useWalk } from "../use-walk";
import { useStepPlayer } from "../use-step-player";
import * as experimental from "../experimental";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
});

type W = WalkStep & { v?: number };
type AB = "a" | "b";
const s = (key: string, extra?: Partial<W>): W => ({ key, tone: "neutral", label: key, ...extra });

// intro, fork (choice), n steps of the chosen branch, fork2 (choice), end.
const lesson: WalkSimulation<number, W, AB> = function* (n) {
  yield s("intro");
  const c = yield s("fork", { await: true });
  for (let i = 0; i < n; i++) yield s(`${c}${i}`);
  const d = yield s("fork2", { await: true });
  yield s(`end-${d}`);
};
const keys = (steps: readonly W[]) => steps.map((x) => x.key);

describe("runWalk", () => {
  it("stops at the first unanswered choice point", () => {
    const r = runWalk(lesson, 2);
    expect(keys(r.steps)).toEqual(["intro", "fork"]);
    expect(r.awaiting).toBe(true);
    expect(r.choicePoints).toEqual([1]);
    expect(r.used).toBe(0);
  });

  it("replays choices to the same path, ignoring extra ones", () => {
    const r = runWalk(lesson, 2, { choices: ["a", "b", "a"] });
    expect(keys(r.steps)).toEqual(["intro", "fork", "a0", "a1", "fork2", "end-b"]);
    expect(r.awaiting).toBe(false);
    expect(r.choicePoints).toEqual([1, 4]);
    expect(r.used).toBe(2);
    expect(runWalk(lesson, 2, { choices: ["a", "b"] }).steps).toEqual(r.steps);
  });

  it("reports a throw with the steps before it, and caps runaway walks", () => {
    const boom: WalkSimulation<null, W, AB> = function* () {
      yield s("one");
      throw new Error("nope");
    };
    const r = runWalk(boom, null);
    expect(keys(r.steps)).toEqual(["one"]);
    expect((r.error as Error).message).toBe("nope");

    const forever: WalkSimulation<null, W, AB> = function* () {
      for (let i = 0; ; i++) yield s(`s${i}`);
    };
    const capped = runWalk(forever, null, { maxSteps: 5 });
    expect(capped.steps).toHaveLength(5);
    expect(capped.truncated).toBe(true);
  });

  it("runs a linear simulation exactly like runSimulation", () => {
    const linear = function* (n: number) {
      for (let i = 0; i < n; i++) yield s(`s${i}`, { v: i * i });
    };
    expect(runWalk(linear, 4).steps).toEqual(runSimulation(linear, 4).steps);
  });
});

describe("diffTraces", () => {
  it("reports nothing for equal runs", () => {
    const d = diffTraces([s("a"), s("b")], [s("a"), s("b")]);
    expect(d.divergedAt).toBe(-1);
    expect([...d.changed]).toEqual([]);
  });

  it("finds the first difference and the changed steps by index", () => {
    const d = diffTraces([s("a"), s("b", { v: 1 }), s("c")], [s("a"), s("b", { v: 2 }), s("c"), s("d")]);
    expect(d.divergedAt).toBe(1);
    expect([...d.changed]).toEqual([1, 3]);
  });

  it("pairs by key: a shifted step is unchanged, same key with new data is changed", () => {
    const old = [s("a"), s("b"), s("c", { v: 1 })];
    const next = [s("a"), s("x"), s("b"), s("c", { v: 2 })];
    const d = diffTraces(old, next, { keyOf: (x) => x.key });
    expect(d.divergedAt).toBe(1);
    expect([...d.changed]).toEqual([1, 3]);
  });

  it("uses a custom equality, and a shorter run diverges at its end", () => {
    const d = diffTraces([s("a", { v: 1 }), s("b")], [s("a", { v: 9 })], { equals: (p, q) => p.key === q.key });
    expect(d.divergedAt).toBe(1);
    expect([...d.changed]).toEqual([]);
  });

  it("structuralEqual compares plain data and nothing else", () => {
    expect(structuralEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(structuralEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(structuralEqual(new Date(1), new Date(1))).toBe(false);
    expect(structuralEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});

// Binary numbers divisible by 3: the state is the remainder so far.
const div3 = () =>
  fromGraph<"0" | "1">({
    start: "r0",
    nodes: { r0: { label: "0" }, r1: { label: "1" }, r2: { label: "2" } },
    edges: [
      { from: "r0", on: "0", to: "r0" },
      { from: "r0", on: "1", to: "r1" },
      { from: "r1", on: "0", to: "r2" },
      { from: "r1", on: "1", to: "r0" },
      { from: "r2", on: "0", to: "r1" },
      { from: "r2", on: "1", to: "r2" },
    ],
    accept: ["r0"],
  });

describe("fromGraph", () => {
  it("runs a word: one step per symbol, keyed by position, accept flagged", () => {
    const g = div3();
    const { steps } = runSimulation(g.simulation, "110"); // 6
    expect(steps.map((x) => x.node)).toEqual(["r0", "r1", "r0", "r0"]);
    expect(steps.map((x) => x.key)).toEqual(["0", "1", "2", "3"]);
    expect(steps[3].accepted).toBe(true);
    expect(steps[3].tone).toBe("good");
    expect(steps[1]).toMatchObject({ from: "r0", on: "1", read: 1, label: "'1': 0 → 1" });
    expect(runSimulation(g.simulation, "111").steps.at(-1)?.accepted).toBe(false); // 7
  });

  it("sends a missing edge to `otherwise`, or ends the run with an error", () => {
    const withDead = fromGraph<"a" | "b">({
      start: "q0",
      nodes: { q0: {}, q1: {}, dead: {} },
      edges: [{ from: "q0", on: "a", to: "q1" }],
      otherwise: "dead",
    });
    const run = runSimulation(withDead.simulation, ["a", "b", "a"]);
    expect(run.steps.map((x) => x.node)).toEqual(["q0", "q1", "dead", "dead"]);
    expect(run.steps[2].tone).toBe("bad");

    const strict = fromGraph<"a" | "b">({ start: "q0", nodes: { q0: {}, q1: {} }, edges: [{ from: "q0", on: "a", to: "q1" }] });
    const failed = runSimulation(strict.simulation, ["a", "b"]);
    expect(failed.steps).toHaveLength(2);
    expect(String(failed.error)).toMatch(/no edge from "q1" on "b"/);
    expect(strict.delta("q1", "b")).toBe(null);
  });

  it("exposes the declared graph and rejects inconsistent ones", () => {
    const g = div3();
    expect(g.graph.edges).toHaveLength(6);
    expect([...g.graph.accept]).toEqual(["r0"]);
    expect(g.delta("r2", "0")).toBe("r1");
    // A typed spec can't name an unknown start; data loaded at runtime (or JS) can.
    expect(() => fromGraph<string, unknown, string>({ start: "x", nodes: {}, edges: [] })).toThrow(/start node "x"/);
    expect(() =>
      fromGraph({
        start: "a",
        nodes: { a: {} },
        edges: [
          { from: "a", on: "1", to: "a" },
          { from: "a", on: "1", to: "a" },
        ],
      })
    ).toThrow(/two edges/);
  });
});

describe("useStepPlayer — a checkpoint on the last frame", () => {
  it("holds instead of ending; released, playback ends", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, autoPlay: true, baseDelayMs: 100, holdAt: (f) => f === 2 })
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(2);
    expect(result.current.held).toBe(2);
    expect(result.current.ended).toBe(false);
    act(() => result.current.release());
    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
  });
});

describe("useWalk", () => {
  it("holds at the waiting choice point; choosing extends the path and resumes", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWalk(lesson, 2, { autoPlay: true, baseDelayMs: 100 }));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.frame).toBe(1);
    expect(result.current.awaiting).toBe(true);
    expect(result.current.player.held).toBe(1);

    act(() => result.current.choose("a"));
    expect(keys(result.current.steps)).toEqual(["intro", "fork", "a0", "a1", "fork2"]);
    expect(result.current.choices).toEqual(["a"]);
    expect(result.current.step?.key).toBe("a0");
    expect(result.current.player.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.step?.key).toBe("a1");
  });

  it("a different answer on an earlier choice point cuts off the old future", () => {
    const { result } = renderHook(() => useWalk(lesson, 2, { choices: ["a", "b"] }));
    expect(keys(result.current.steps)).toEqual(["intro", "fork", "a0", "a1", "fork2", "end-b"]);
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("b"));
    expect(result.current.choices).toEqual(["b"]);
    expect(keys(result.current.steps)).toEqual(["intro", "fork", "b0", "b1", "fork2"]);
    expect(result.current.awaiting).toBe(true);
    expect(result.current.step?.key).toBe("b0");
    expect(result.current.player.playing).toBe(false);
  });

  it("the same answer keeps the future and just moves into it", () => {
    const { result } = renderHook(() => useWalk(lesson, 2, { choices: ["a", "b"] }));
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("a"));
    expect(result.current.choices).toEqual(["a", "b"]);
    expect(result.current.step?.key).toBe("a0");
    expect(result.current.choiceAt(1)).toBe("a");
    expect(result.current.choiceAt(4)).toBe("b");
    expect(result.current.choiceAt(2)).toBe(undefined);
  });

  it("ignores choose() off a choice point, with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWalk(lesson, 2, { choices: ["a"] }));
    act(() => result.current.player.seek(2));
    act(() => result.current.choose("b"));
    expect(result.current.choices).toEqual(["a"]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("an input edit replays the same choices and keeps the step (by key)", () => {
    const { result } = renderHook(() => {
      const [n, setN] = useState(2);
      return { setN, walk: useWalk(lesson, n, { choices: ["a"] }) };
    });
    act(() => result.current.walk.player.seek(3));
    expect(result.current.walk.step?.key).toBe("a1");
    act(() => result.current.setN(3));
    expect(keys(result.current.walk.steps)).toEqual(["intro", "fork", "a0", "a1", "a2", "fork2"]);
    expect(result.current.walk.step?.key).toBe("a1");
    expect(result.current.walk.choices).toEqual(["a"]);
    expect(result.current.walk.lastChange?.divergedAt).toBe(4);
    expect([...(result.current.walk.lastChange?.changed ?? [])]).toEqual([4]);
  });

  it('anchor: "index" keeps the position when every key changes', () => {
    const tagged: WalkSimulation<string, W, AB> = function* (tag) {
      for (let i = 0; i < 5; i++) yield s(`${tag}${i}`);
    };
    const run = (anchor?: "key" | "index") =>
      renderHook(() => {
        const [tag, setTag] = useState("x");
        return { setTag, walk: useWalk(tagged, tag, { anchor }) };
      }).result;
    const byIndex = run("index");
    act(() => byIndex.current.walk.player.seek(3));
    act(() => byIndex.current.setTag("y"));
    expect(byIndex.current.walk.step?.key).toBe("y3");
    expect([...(byIndex.current.walk.lastChange?.changed ?? [])]).toEqual([0, 1, 2, 3, 4]);

    const byKey = run();
    act(() => byKey.current.walk.player.seek(3));
    act(() => byKey.current.setTag("y"));
    expect(byKey.current.walk.step?.key).toBe("y0");
  });

  it("restores input, choices and frame from a link, in that order", () => {
    window.history.replaceState(null, "", "#frame=5&n=3&path=a.b");
    const { result } = renderHook(() => {
      const [n, setN] = useState(1);
      const walk = useWalk(lesson, n, {
        syncHash: "frame",
        syncInput: { key: "n", serialize: String, parse: (v) => (/^\d+$/.test(v) ? Number(v) : null), onRestore: setN },
        syncChoices: { key: "path", serialize: (c) => c, parse: (v) => (v === "a" || v === "b" ? v : null) },
      });
      return { n, walk };
    });
    expect(result.current.n).toBe(3);
    expect(result.current.walk.choices).toEqual(["a", "b"]);
    expect(keys(result.current.walk.steps)).toEqual(["intro", "fork", "a0", "a1", "a2", "fork2", "end-b"]);
    expect(result.current.walk.frame).toBe(5);
    expect(result.current.walk.step?.key).toBe("fork2");
    expect(window.location.hash).toBe("#frame=5&n=3&path=a.b");
  });

  it("a link pasted into the same tab restores its choices, then its frame", () => {
    const { result } = renderHook(() =>
      useWalk(lesson, 3, {
        syncHash: "frame",
        syncChoices: { key: "path", serialize: (c) => c, parse: (v) => (v === "a" || v === "b" ? v : null) },
      })
    );
    expect(result.current.choices).toEqual([]);
    act(() => {
      window.history.replaceState(null, "", "#frame=5&path=a.b");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.choices).toEqual(["a", "b"]);
    expect(result.current.frame).toBe(5);
    expect(result.current.step?.key).toBe("fork2");
  });

  it("writes choices to the URL, and ignores a link with a bad choice", () => {
    const sync = { key: "path", serialize: (c: AB) => c, parse: (v: string) => (v === "a" || v === "b" ? (v as AB) : null) };
    window.history.replaceState(null, "", "#path=a.zz");
    const { result } = renderHook(() => useWalk(lesson, 1, { syncChoices: sync }));
    expect(result.current.choices).toEqual([]);
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("b"));
    expect(window.location.hash).toBe("#path=b");
  });

  it("is StrictMode-safe and keeps choose / choiceAt stable", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, rerender } = renderHook(() => useWalk(lesson, 2), { wrapper });
    const { choose, choiceAt } = result.current;
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("a"));
    rerender();
    expect(result.current.choices).toEqual(["a"]);
    expect(result.current.step?.key).toBe("a0");
    expect(result.current.choose).toBe(choose);
    expect(result.current.choiceAt).toBe(choiceAt);
  });

  it("walks a declared graph over a typed word, keeping the position", () => {
    const g = div3();
    const { result } = renderHook(() => {
      const [word, setWord] = useState("11");
      return { setWord, walk: useWalk(g.simulation, word, { anchor: "index" }) };
    });
    act(() => result.current.walk.player.seek(2));
    expect(result.current.walk.step?.node).toBe("r0");
    act(() => result.current.setWord("10"));
    expect(result.current.walk.frame).toBe(2);
    expect(result.current.walk.step?.node).toBe("r2");
  });
});

describe("experimental entry", () => {
  it("exports every runtime entry point", () => {
    const expected = ["runWalk", "useWalk", "fromGraph", "diffTraces", "structuralEqual"];
    expect(expected.filter((name) => !(name in experimental))).toEqual([]);
  });
});

describe("prompts on walk steps", () => {
  it("a step with prompt is a choice point like await", () => {
    const twin = (mark: Partial<W>): WalkSimulation<number, W, AB> =>
      function* () {
        yield s("a");
        yield s("q", mark);
        yield s("z");
      };
    const withAwait = runWalk(twin({ await: true }), 0);
    const withPrompt = runWalk(twin({ prompt: { id: "q" } }), 0);
    expect(withPrompt.choicePoints).toEqual(withAwait.choicePoints);
    expect(withPrompt.choicePoints).toEqual([1]);
    expect(withPrompt.awaiting).toBe(true);
    expect(isChoicePoint(s("x", { prompt: {} }))).toBe(true);
    expect(isChoicePoint(s("x", { await: true }))).toBe(true);
    expect(isChoicePoint(s("x"))).toBe(false);
  });

  it("an undefined choice is fed to the generator", () => {
    const seen: unknown[] = [];
    const sim: WalkSimulation<number, W, AB> = function* () {
      seen.push(yield s("p1", { prompt: {} }));
      seen.push(yield s("p2", { prompt: {} }));
      yield s("end");
    };
    const r = runWalk(sim, 0, { choices: [undefined, "b"] });
    expect(seen).toEqual([undefined, "b"]);
    expect(r.awaiting).toBe(false);
    expect(r.used).toBe(2);
  });

  it("the cap counts steps since the last choice point", () => {
    const sim: WalkSimulation<number, W, AB> = function* () {
      for (let r = 0; r < 5; r++) {
        for (let i = 0; i < 8; i++) yield s(`r${r}-${i}`);
        yield s(`p${r}`, { prompt: {} });
      }
    };
    const ok = runWalk(sim, 0, { maxSteps: 10, choices: ["a", "a", "a", "a", "a"] });
    expect(ok.truncated).toBe(false);
    expect(ok.steps).toHaveLength(45);
    const loop: WalkSimulation<number, W, AB> = function* () {
      yield s("p", { prompt: {} });
      for (let i = 0; i < 11; i++) yield s(`l${i}`);
    };
    const bad = runWalk(loop, 0, { maxSteps: 10, choices: ["a"] });
    expect(bad.truncated).toBe(true);
  });

  it("a run without choice points keeps the whole-run cap", () => {
    const sim: WalkSimulation<number, W, AB> = function* () {
      for (let i = 0; i < 12; i++) yield s(`k${i}`);
    };
    const r = runWalk(sim, 0, { maxSteps: 10 });
    expect(r.steps).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });
});

describe("useWalk forward continuation", () => {
  const counting = () => {
    const counter = { created: 0 };
    const sim: WalkSimulation<number, W, AB> = (n, ctx) => {
      counter.created++;
      return lesson(n, ctx);
    };
    return { sim, counter };
  };

  it("answers forward without replaying the walk", () => {
    const { sim, counter } = counting();
    const { result } = renderHook(() => useWalk(sim, 2));
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("a"));
    act(() => result.current.player.seek(4));
    act(() => result.current.choose("b"));
    expect(keys(result.current.steps)).toEqual(keys(runWalk(lesson, 2, { choices: ["a", "b"] }).steps));
    expect(counter.created).toBe(1);
    // A changed earlier answer replays.
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("b"));
    expect(counter.created).toBe(2);
    expect(keys(result.current.steps)).toEqual(keys(runWalk(lesson, 2, { choices: ["b"] }).steps));
  });

  it("under StrictMode, the path after answering equals a full replay", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useWalk(lesson, 3, { seed: 4 }), { wrapper });
    act(() => result.current.player.seek(1));
    act(() => result.current.choose("b"));
    act(() => result.current.player.seek(5));
    act(() => result.current.choose("a"));
    expect(result.current.steps).toEqual(runWalk(lesson, 3, { seed: 4, choices: ["b", "a"] }).steps);
    expect(result.current.choicePoints).toEqual([1, 5]);
    expect(result.current.awaiting).toBe(false);
  });
});

describe("useWalk initialTrace", () => {
  it("counts prompt-only steps of a precomputed path as choice points", () => {
    const quiz: WalkSimulation<null, W, AB> = function* () {
      yield s("intro");
      const c = yield s("q", { prompt: { id: "q" } });
      yield s(`after-${c}`);
    };
    const pre = runWalk(quiz, null);
    const initialTrace = { input: null, seed: pre.seed, steps: pre.steps, choices: [] };
    const sim = vi.fn(quiz);
    const { result } = renderHook(() => useWalk(sim, null, { initialTrace }));
    expect(sim).not.toHaveBeenCalled();
    expect(result.current.choicePoints).toEqual([1]);
    expect(result.current.awaiting).toBe(true);
  });
});
