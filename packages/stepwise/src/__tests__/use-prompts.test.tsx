import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Simulation } from "../simulation";
import type { WalkSimulation, WalkStep } from "../walk";
import type { Prompt } from "../prompts";
import { usePrompts } from "../use-prompts";
import type { PromptsOptions } from "../use-prompts";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
});

// ── Fixtures ────────────────────────────────────────────────────────────────

// Bubble sort over 4 numbers. For [3, 1, 2, 0]: start, cmp-0-0 (1), swap (2),
// cmp-0-1 (3), swap (4), cmp-0-2 (5), swap (6), cmp-1-0 (7), cmp-1-1 (8),
// swap (9), cmp-2-0 (10), swap (11), done (12).
type Sort = WalkStep & { arr: number[] };
const bubble: Simulation<number[], Sort> = function* (input) {
  const a = input.slice();
  yield { key: "start", tone: "neutral", label: "start", arr: a.slice() };
  for (let p = 0; p < a.length - 1; p++) {
    for (let i = 0; i < a.length - 1 - p; i++) {
      yield { key: `cmp-${p}-${i}`, tone: "accent", label: `compare ${i}`, arr: a.slice() };
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        yield { key: `swap-${p}-${i}`, tone: "write", label: `swap ${i}`, arr: a.slice() };
      }
    }
  }
  yield { key: "done", tone: "good", label: "done", arr: a.slice() };
};
const INPUT = [3, 1, 2, 0];

// "Will they swap?" on every compare: the answer is read from the next frame.
const willSwap = (step: Sort, f: number, steps: readonly Sort[]): Prompt<string, Sort> | null =>
  step.key?.startsWith("cmp")
    ? { options: ["yes", "no"], answer: steps[f + 1]?.key?.startsWith("swap") ? "yes" : "no", explain: "bigger moves right" }
    : null;

const sorting = (opts?: PromptsOptions<number[], Sort, string>) =>
  renderHook(() => usePrompts({ simulation: bubble, input: INPUT }, { ask: willSwap, ...opts }));

// A branching story: the fork's answer picks the path.
type W = WalkStep & { v?: number };
const s = (key: string, extra?: Partial<W>): W => ({ key, tone: "neutral", label: key, ...extra });
let received: unknown[] = [];
const story: WalkSimulation<null, W, string> = function* () {
  yield s("intro");
  const c = yield s("fork", { prompt: { options: ["left", "right"] } });
  received.push(c);
  if (c === "left") {
    yield s("L1");
    yield s("L2");
  } else yield s("R1");
  yield s("end");
};
const quizStory: WalkSimulation<null, W, string> = function* () {
  yield s("intro");
  const c = yield s("fork", { prompt: { options: ["left", "right"], answer: "right" } });
  received.push(c);
  yield s(c === "right" ? "R1" : "lost");
};
const finale: WalkSimulation<null, W, string> = function* () {
  yield s("intro");
  received.push(yield s("final", { prompt: { options: ["a", "b"] } }));
};

const STEPS: W[] = [s("one"), s("two"), s("three")];
const askTwo = (step: W): Prompt<string, W> | null => (step.key === "two" ? { options: ["a", "b"], answer: "b" } : null);
const askLast = (step: W): Prompt<string, W> | null => (step.key === "three" ? { options: ["a", "b"], answer: "b" } : null);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("usePrompts", () => {
  it("stepping with next stops at an unsettled overlay prompt", () => {
    const { result } = sorting();
    for (let i = 0; i < 5; i++) act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    expect(result.current.active?.frame).toBe(1);
    expect(result.current.status).toBe("open");
  });

  it("a right answer passes and waits; proceed moves on", () => {
    const { result } = sorting();
    act(() => result.current.player.next());
    act(() => result.current.respond("yes"));
    expect(result.current.status).toBe("pass");
    expect(result.current.frame).toBe(1);
    act(() => result.current.player.next());
    act(() => result.current.player.next());
    // Settled: the gate is open, so next moves on (to the next compare's gate).
    expect(result.current.frame).toBe(3);
    act(() => result.current.player.prev());
    act(() => result.current.player.prev());
    expect(result.current.frame).toBe(1);
    act(() => result.current.proceed());
    expect(result.current.frame).toBe(2);
  });

  it("retries 0: a wrong answer settles as fail and reveals answer and explain", () => {
    const { result } = sorting();
    act(() => result.current.player.next());
    expect(result.current.revealed).toBeNull();
    act(() => result.current.respond("no"));
    expect(result.current.status).toBe("fail");
    expect(result.current.active?.entry.settled).toBe(true);
    expect(result.current.retriesLeft).toBe(0);
    expect(result.current.revealed).toEqual({ answer: "yes", explain: "bigger moves right" });
    expect(result.current.score.failed).toBe(1);
    // Final: another answer changes nothing.
    act(() => result.current.respond("yes"));
    expect(result.current.status).toBe("fail");
    expect(result.current.active?.entry.attempts).toEqual(["no"]);
  });

  it("retries 2: misses stay open and show remaining tries", () => {
    const { result } = sorting({ retries: 2 });
    act(() => result.current.player.next());
    expect(result.current.retriesLeft).toBe(2);
    act(() => result.current.respond("no"));
    expect(result.current.status).toBe("fail");
    expect(result.current.active?.entry.settled).toBe(false);
    expect(result.current.retriesLeft).toBe(2);
    expect(result.current.revealed).toBeNull();
    act(() => result.current.respond("no"));
    expect(result.current.retriesLeft).toBe(1);
    expect(result.current.revealed).toBeNull();
    // Still unsettled: the gate holds.
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    act(() => result.current.respond("no"));
    expect(result.current.retriesLeft).toBe(0);
    expect(result.current.active?.entry.settled).toBe(true);
    expect(result.current.revealed).toEqual({ answer: "yes", explain: "bigger moves right" });
  });

  it("autoContinue moves on after settling", () => {
    const { result } = sorting({ autoContinue: true });
    act(() => result.current.player.next());
    act(() => result.current.respond("yes"));
    expect(result.current.frame).toBe(2);
    expect(result.current.record.entries[0].status).toBe("pass");
  });

  it("generator prompt: the answer branches the run", () => {
    received = [];
    const { result } = renderHook(() => usePrompts({ simulation: story, input: null }));
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork"]);
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    expect(result.current.active?.prompt.options).toEqual(["left", "right"]);
    act(() => result.current.respond("left"));
    expect(result.current.status).toBe("answered");
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork", "L1", "L2", "end"]);
    expect(result.current.frame).toBe(1);
    act(() => result.current.proceed());
    expect(result.current.step?.label).toBe("L1");
  });

  it("generator judged prompt that fails sends the last answer to the generator", () => {
    received = [];
    const { result } = renderHook(() => usePrompts({ simulation: quizStory, input: null }));
    act(() => result.current.player.next());
    act(() => result.current.respond("wrong"));
    expect(result.current.status).toBe("fail");
    expect(result.current.revealed?.answer).toBe("right");
    expect(received).toContain("wrong");
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork", "lost"]);
  });

  it("ask and step.prompt on one frame: generator wins, one dev warning", () => {
    received = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ask = (step: W): Prompt<string, W> | null => (step.key === "fork" ? { options: ["x"], answer: "x" } : null);
    const { result, rerender } = renderHook(() => usePrompts({ simulation: story, input: null }, { ask }));
    act(() => result.current.player.next());
    rerender();
    act(() => result.current.player.prev());
    act(() => result.current.player.next());
    expect(result.current.active?.prompt.options).toEqual(["left", "right"]);
    expect(result.current.active?.entry.source).toBe("generator");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[stepwise\] usePrompts/);
  });

  it("a prompt on the last frame holds, settles, then the run ends (overlay)", () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();
    const { result } = renderHook(() => usePrompts({ steps: STEPS }, { ask: askLast, autoPlay: true, onEnd }));
    for (let i = 0; i < 4; i++) act(() => vi.advanceTimersByTime(1000));
    expect(result.current.frame).toBe(2);
    expect(result.current.player.held).toBe(2);
    expect(result.current.player.ended).toBe(false);
    act(() => result.current.respond("b"));
    expect(result.current.status).toBe("pass");
    act(() => result.current.proceed());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.player.ended).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(result.current.player.held).toBeNull();
  });

  it("a prompt on the last frame holds, settles, then the run ends (generator)", () => {
    vi.useFakeTimers();
    received = [];
    const onEnd = vi.fn();
    const { result } = renderHook(() => usePrompts({ simulation: finale, input: null }, { autoPlay: true, onEnd }));
    for (let i = 0; i < 4; i++) act(() => vi.advanceTimersByTime(1000));
    expect(result.current.frame).toBe(1);
    expect(result.current.player.held).toBe(1);
    act(() => result.current.respond("a"));
    expect(received).toEqual(["a"]);
    expect(result.current.steps).toHaveLength(2);
    act(() => result.current.proceed());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.player.ended).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("proceed on a settled last frame ends the run after stepping there by hand", () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => usePrompts({ steps: STEPS }, { ask: askLast, onEnd }));
    act(() => result.current.player.seek(2));
    act(() => result.current.respond("b"));
    act(() => result.current.proceed());
    expect(result.current.player.ended).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("an async judge resolving after restart is dropped", async () => {
    const d = deferred<boolean>();
    const ask = (step: W): Prompt<string, W> | null => (step.key === "one" ? { options: ["a", "b"] } : null);
    const { result } = renderHook(() => usePrompts({ steps: STEPS }, { ask, judge: () => d.promise }));
    act(() => result.current.respond("a"));
    expect(result.current.status).toBe("pending");
    act(() => result.current.restart());
    await act(async () => {
      d.resolve(true);
      await d.promise;
    });
    expect(result.current.frame).toBe(0);
    expect(result.current.status).toBe("open");
    expect(result.current.record.entries.every((e) => e.attempts.length === 0)).toBe(true);
    expect(result.current.score.passed).toBe(0);
  });

  it("an async judge that resolves in time settles the entry", async () => {
    const d = deferred<boolean>();
    const ask = (step: W): Prompt<string, W> | null => (step.key === "one" ? { options: ["a", "b"] } : null);
    const { result } = renderHook(() => usePrompts({ steps: STEPS }, { ask, judge: () => d.promise }));
    act(() => result.current.respond("a"));
    await act(async () => {
      d.resolve(true);
      await d.promise;
    });
    expect(result.current.status).toBe("pass");
  });

  it("score counts the run", () => {
    const { result } = sorting({ navigation: "free" });
    act(() => result.current.player.next()); // 1: cmp-0-0 (yes)
    act(() => result.current.respond("yes"));
    act(() => result.current.proceed()); // 2
    act(() => result.current.player.next()); // 3: cmp-0-1 (yes)
    act(() => result.current.respond("no"));
    act(() => result.current.proceed()); // 4
    act(() => result.current.player.next()); // 5: cmp-0-2, left unanswered
    act(() => result.current.player.next()); // 6
    expect(result.current.frame).toBe(6);
    expect(result.current.score).toEqual({ reached: 3, passed: 1, failed: 1, answered: 0, skipped: 1 });
  });

  it("{ steps } source works with ask", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result, rerender } = renderHook(() => usePrompts({ steps: [...STEPS] }, { ask: askTwo }));
    for (let i = 0; i < 3; i++) act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    act(() => result.current.respond("b"));
    expect(result.current.status).toBe("pass");
    for (let i = 0; i < 5; i++) rerender();
    expect(result.current.frame).toBe(1);
    expect(result.current.status).toBe("pass");
    expect(warn).not.toHaveBeenCalled();
  });

  it("a { steps } source rebuilt every render, without keys, neither warns nor loops", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result, rerender } = renderHook(() =>
      usePrompts({ steps: [{ tone: "neutral", label: "a" }, { tone: "neutral", label: "b" }] as WalkStep[] })
    );
    act(() => result.current.player.next());
    for (let i = 0; i < 5; i++) rerender();
    expect(result.current.frame).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("callbacks are referentially stable across frames", () => {
    const { result } = sorting({ navigation: "free" });
    const first = result.current;
    act(() => result.current.player.next());
    act(() => result.current.respond("yes"));
    act(() => result.current.proceed());
    act(() => result.current.setEnabled(false));
    const later = result.current;
    expect(later.frame).toBe(2);
    expect(later.respond).toBe(first.respond);
    expect(later.skip).toBe(first.skip);
    expect(later.proceed).toBe(first.proceed);
    expect(later.restart).toBe(first.restart);
    expect(later.setEnabled).toBe(first.setEnabled);
  });

  it("a judge that throws fails the entry and logs one dev console.error per error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = sorting({
      retries: 2,
      judge: () => {
        throw new Error("boom");
      },
    });
    act(() => result.current.player.next());
    act(() => result.current.respond("yes"));
    expect(result.current.status).toBe("fail");
    expect((result.current.judgeError as Error).message).toBe("boom");
    act(() => result.current.respond("yes"));
    expect(result.current.status).toBe("fail");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(/^\[stepwise\] usePrompts/);
  });

  it("respond with no prompt at the playhead is ignored with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = sorting();
    act(() => result.current.respond("yes"));
    expect(result.current.record.entries).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[stepwise\] usePrompts/);
  });

  it("restart clears the record and returns to frame 0", () => {
    received = [];
    const { result } = renderHook(() => usePrompts({ simulation: story, input: null }));
    act(() => result.current.player.next());
    act(() => result.current.respond("left"));
    act(() => result.current.proceed());
    act(() => result.current.player.next());
    expect(result.current.step?.label).toBe("L2");
    act(() => result.current.restart());
    expect(result.current.frame).toBe(0);
    expect(result.current.record.entries).toEqual([]);
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork"]);
  });

  it("a prompt whose id at a frame changes can be answered, and its gate opens", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const askAs = (id: string) => (step: W): Prompt<string, W> | null =>
      step.key === "two" ? { id, options: ["a", "b"], answer: "b" } : null;
    const { result, rerender } = renderHook(({ id }) => usePrompts({ steps: STEPS }, { ask: askAs(id) }), {
      initialProps: { id: "q1" },
    });
    act(() => result.current.player.next());
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    expect(result.current.record.entries.map((e) => e.id)).toEqual(["q1"]);
    rerender({ id: "q2" });
    expect(result.current.record.entries.map((e) => e.id)).toEqual(["q2"]);
    act(() => result.current.respond("b"));
    expect(result.current.status).toBe("pass");
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("an input change that renames the step at a gated frame doesn't deadlock", () => {
    type K = WalkStep;
    const named: Simulation<string, K> = function* (tag) {
      yield { key: "a", tone: "neutral", label: "a" };
      yield { key: `ask-${tag}`, tone: "neutral", label: "ask" };
      yield { key: "z", tone: "neutral", label: "z" };
    };
    const ask = (step: K): Prompt<string, K> | null => (step.label === "ask" ? { options: ["y"], answer: "y" } : null);
    const { result, rerender } = renderHook(({ tag }) => usePrompts({ simulation: named, input: tag }, { ask }), {
      initialProps: { tag: "one" },
    });
    act(() => result.current.player.next());
    expect(result.current.active?.entry.id).toBe("ask-one");
    rerender({ tag: "two" });
    // Re-anchoring walks back to the last shared key ("a"); step to the renamed prompt.
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    expect(result.current.active?.entry.id).toBe("ask-two");
    act(() => result.current.respond("y"));
    expect(result.current.status).toBe("pass");
    act(() => result.current.proceed());
    expect(result.current.step?.label).toBe("z");
  });

  it("enabled turns overlay prompts off, not generator ones", () => {
    const { result } = sorting({ defaultEnabled: false });
    expect(result.current.enabled).toBe(false);
    expect(result.current.canToggle).toBe(true);
    act(() => result.current.player.next());
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(2);
    expect(result.current.active).toBeNull();
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });
});

// ── Navigation, restart, enabled, input changes, links ─────────────────────

function reducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

// The sort with its input as state, the way a page holds it.
function useSorting(opts?: PromptsOptions<number[], Sort, string>, initial: number[] = INPUT) {
  const [input, setInput] = useState(initial);
  const run = usePrompts({ simulation: bubble, input }, { ask: willSwap, ...opts });
  return { input, setInput, run };
}

const FIVE: W[] = [s("one"), s("two"), s("three"), s("four"), s("five")];
const askEven = (step: W): Prompt<string, W> | null =>
  step.key === "two" || step.key === "four" ? { options: ["a", "b"] } : null;

describe("usePrompts: navigation and restart", () => {
  it("free navigation passes prompts and counts skipped", () => {
    const { result } = renderHook(() => usePrompts({ steps: FIVE }, { ask: askEven, navigation: "free", retries: 1 }));
    for (let i = 0; i < 4; i++) act(() => result.current.player.next());
    expect(result.current.frame).toBe(4);
    expect(result.current.score.skipped).toBe(2);
    for (let i = 0; i < 3; i++) act(() => result.current.player.prev());
    expect(result.current.frame).toBe(1);
    expect(result.current.status).toBe("skipped");
    act(() => result.current.respond("a"));
    expect(result.current.status).toBe("answered");
    // Answering a skipped prompt is the first answer: no retry used.
    expect(result.current.retriesLeft).toBe(1);
    expect(result.current.score).toMatchObject({ answered: 1, skipped: 1 });
  });

  it("skip() under gate is ignored with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = sorting();
    act(() => result.current.player.next());
    act(() => result.current.skip());
    expect(result.current.status).toBe("open");
    expect(result.current.score.skipped).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[stepwise\] usePrompts/);
  });

  it("restart clears the record, unlocks the input and returns to frame 0", () => {
    const { result } = renderHook(() => useSorting());
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("yes"));
    act(() => result.current.run.proceed());
    expect(result.current.run.inputLocked).toBe(true);
    act(() => result.current.run.restart());
    expect(result.current.run.frame).toBe(0);
    expect(result.current.run.record.entries).toEqual([]);
    expect(result.current.run.inputLocked).toBe(false);
  });

  it("restart with a prompt on frame 0 reaches it again", () => {
    const askOne = (step: W): Prompt<string, W> | null => (step.key === "one" ? { options: ["a", "b"], answer: "b" } : null);
    const { result } = renderHook(() => usePrompts({ steps: STEPS }, { ask: askOne }));
    expect(result.current.score.reached).toBe(1);
    act(() => result.current.respond("b"));
    expect(result.current.status).toBe("pass");
    act(() => result.current.restart());
    expect(result.current.frame).toBe(0);
    expect(result.current.status).toBe("open");
    expect(result.current.score.reached).toBe(1);
    expect(result.current.record.entries[0].attempts).toEqual([]);
  });
});

describe("usePrompts: input changes", () => {
  it("lock: once answered, inputLocked is true and requestInput returns false with one dev warning; after restart it applies", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useSorting());
    const requestInput = result.current.run.requestInput;
    expect(result.current.run.inputLocked).toBe(false);
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("yes"));
    expect(result.current.run.inputLocked).toBe(true);
    let ran: boolean | undefined;
    act(() => {
      ran = result.current.run.requestInput(() => result.current.setInput([1, 2, 3, 0]));
    });
    expect(ran).toBe(false);
    expect(result.current.input).toEqual(INPUT);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[stepwise\] usePrompts/);
    act(() => result.current.run.restart());
    act(() => {
      ran = result.current.run.requestInput(() => result.current.setInput([1, 2, 3, 0]));
    });
    expect(ran).toBe(true);
    expect(result.current.input).toEqual([1, 2, 3, 0]);
    expect(result.current.run.requestInput).toBe(requestInput);
  });

  it("clear: an input change empties the record and score", () => {
    const { result } = renderHook(() => useSorting({ onInputChange: "clear" }));
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("yes"));
    expect(result.current.run.score.passed).toBe(1);
    expect(result.current.run.inputLocked).toBe(false);
    act(() => result.current.setInput([1, 3, 2, 0]));
    expect(result.current.run.record.entries.every((e) => e.attempts.length === 0)).toBe(true);
    expect(result.current.run.score).toMatchObject({ passed: 0, failed: 0, answered: 0, skipped: 0 });
  });

  it("keep: an input change keeps overlay answers by id and re-judges them", () => {
    const { result } = renderHook(() => useSorting({ onInputChange: "keep" }));
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("yes"));
    expect(result.current.run.status).toBe("pass");
    // 1 and 3 are compared first now: no swap, so "yes" is wrong.
    act(() => result.current.setInput([1, 3, 2, 0]));
    expect(result.current.run.frame).toBe(1);
    expect(result.current.run.active?.entry.id).toBe("cmp-0-0");
    expect(result.current.run.active?.entry.attempts).toEqual(["yes"]);
    expect(result.current.run.status).toBe("fail");
    expect(result.current.run.score).toMatchObject({ passed: 0, failed: 1 });
  });

  it("keep: an answer whose prompt moved to another frame follows it by id", () => {
    const { result } = renderHook(() => useSorting({ onInputChange: "keep", navigation: "free" }));
    // [3,1,2,0]: cmp-0-1 is frame 3. [1,3,2,0]: no swap at 0, so cmp-0-1 is frame 2.
    for (let i = 0; i < 3; i++) act(() => result.current.run.player.next());
    expect(result.current.run.active?.entry.id).toBe("cmp-0-1");
    act(() => result.current.run.respond("yes"));
    act(() => result.current.setInput([1, 3, 2, 0]));
    const entry = result.current.run.record.entries.find((e) => e.id === "cmp-0-1");
    expect(entry).toMatchObject({ frame: 2, attempts: ["yes"], status: "pass" });
  });

  it("keep: with prompts off, an input change keeps overlay answers", () => {
    const { result } = renderHook(() => useSorting({ onInputChange: "keep" }));
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("yes"));
    act(() => result.current.run.setEnabled(false));
    act(() => result.current.setInput([1, 3, 2, 0]));
    expect(result.current.run.record.entries.map((e) => [e.id, e.frame, e.attempts, e.status])).toEqual([
      ["cmp-0-0", 1, ["yes"], "fail"],
    ]);
    act(() => result.current.run.setEnabled(true));
    expect(result.current.run.active?.entry.attempts).toEqual(["yes"]);
  });

  it("walk-like runs (no judged prompts) default to keep", () => {
    received = [];
    const tagged: WalkSimulation<string, W, string> = function* (tag) {
      yield s("intro");
      const c = yield s("fork", { prompt: { options: ["left", "right"] } });
      received.push(c);
      yield s(`${c}-${tag}`);
    };
    const { result } = renderHook(() => {
      const [tag, setTag] = useState("a");
      return { setTag, run: usePrompts({ simulation: tagged, input: tag }) };
    });
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("left"));
    expect(result.current.run.inputLocked).toBe(false);
    let ran: boolean | undefined;
    act(() => {
      ran = result.current.run.requestInput(() => result.current.setTag("b"));
    });
    expect(ran).toBe(true);
    expect(result.current.run.steps.map((x) => x.label)).toEqual(["intro", "fork", "left-b"]);
    expect(result.current.run.record.entries).toHaveLength(1);
    expect(result.current.run.record.entries[0]).toMatchObject({ id: "fork", frame: 1, attempts: ["left"] });
  });
});

describe("usePrompts: enabled", () => {
  const askIntro = (step: W): Prompt<string, W> | null => (step.key === "intro" ? { options: ["x"], answer: "x" } : null);

  it("enabled false hides overlay prompts and their gates; generator prompts still apply", () => {
    received = [];
    const { result } = renderHook(() => usePrompts({ simulation: story, input: null }, { ask: askIntro, enabled: false }));
    expect(result.current.active).toBeNull();
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    expect(result.current.active?.entry.source).toBe("generator");
    act(() => result.current.player.next());
    expect(result.current.frame).toBe(1);
    act(() => result.current.respond("right"));
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork", "R1", "end"]);
  });

  it("controlled enabled ignores setEnabled; canToggle false", () => {
    const { result } = sorting({ enabled: true });
    expect(result.current.canToggle).toBe(false);
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(true);
  });

  it("under lock, canToggle turns false after the first answer", () => {
    const { result } = sorting();
    expect(result.current.canToggle).toBe(true);
    act(() => result.current.player.next());
    act(() => result.current.respond("yes"));
    expect(result.current.canToggle).toBe(false);
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(true);
    act(() => result.current.restart());
    expect(result.current.canToggle).toBe(true);
  });
});

describe("usePrompts: answer links", () => {
  // Asks on cmp-0-0 (frame 1, a swap) and cmp-1-0 (frame 7, no swap) only.
  const askTwoCompares = (step: Sort, f: number, steps: readonly Sort[]): Prompt<string, Sort> | null =>
    step.key === "cmp-0-0" || step.key === "cmp-1-0"
      ? { options: ["swap", "keep"], answer: steps[f + 1]?.key?.startsWith("swap") ? "swap" : "keep" }
      : null;
  const syncAnswers = { key: "q.a", serialize: (a: string) => a, parse: (v: string) => (v === "swap" || v === "keep" ? v : null) };
  const linked = (strict = false, enabled?: boolean) =>
    renderHook(() => {
      const [input, setInput] = useState(INPUT);
      const run = usePrompts(
        { simulation: bubble, input },
        {
          ask: askTwoCompares,
          enabled,
          autoPlay: true,
          syncHash: "q.frame",
          syncAnswers,
          syncInput: {
            key: "q.in",
            serialize: (a: number[]) => a.join("-"),
            parse: (v: string) => (/^\d(-\d)*$/.test(v) ? v.split("-").map(Number) : null),
            onRestore: setInput,
          },
        }
      );
      return { input, run };
    }, strict ? { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> } : undefined);

  it("a link restores answers then the frame", () => {
    reducedMotion();
    window.history.replaceState(null, "", "#q.a=swap.keep&q.frame=9");
    const { result } = linked();
    expect(result.current.run.frame).toBe(9);
    expect(result.current.run.player.playing).toBe(false);
    expect(result.current.run.record.entries.map((e) => [e.id, e.status, e.attempts])).toEqual([
      ["cmp-0-0", "pass", ["swap"]],
      ["cmp-1-0", "pass", ["keep"]],
    ]);
    expect(window.location.hash).toBe("#q.a=swap.keep&q.frame=9");
  });

  it("a link restores answers then the frame under StrictMode", () => {
    reducedMotion();
    window.history.replaceState(null, "", "#q.a=swap.keep&q.frame=9");
    const { result } = linked(true);
    expect(result.current.run.frame).toBe(9);
    expect(result.current.run.record.entries.map((e) => e.attempts)).toEqual([["swap"], ["keep"]]);
    expect(window.location.hash).toBe("#q.a=swap.keep&q.frame=9");
  });

  it("a link with overlay answers opened with prompts off keeps the answers and the hash", () => {
    reducedMotion();
    window.history.replaceState(null, "", "#q.a=swap.keep&q.frame=9");
    const { result } = linked(false, false);
    expect(result.current.run.frame).toBe(9);
    expect(result.current.run.active).toBeNull();
    expect(result.current.run.record.entries.map((e) => [e.id, e.attempts])).toEqual([
      ["cmp-0-0", ["swap"]],
      ["cmp-1-0", ["keep"]],
    ]);
    expect(window.location.hash).toBe("#q.a=swap.keep&q.frame=9");
  });

  it("a mixed generator and overlay link opened with prompts off feeds the generator its own answers", () => {
    reducedMotion();
    const askIntro = (step: W): Prompt<string, W> | null => (step.key === "intro" ? { options: ["x"], answer: "x" } : null);
    const open = (enabled: boolean) => {
      window.history.replaceState(null, "", "#s.a=x.left&s.frame=3");
      received = [];
      const { result, unmount } = renderHook(() =>
        usePrompts(
          { simulation: story, input: null },
          { ask: askIntro, enabled, syncHash: "s.frame", syncAnswers: { key: "s.a", serialize: (a: string) => a, parse: (v: string) => v } }
        )
      );
      const out = { labels: result.current.steps.map((x) => x.label), received: [...received], hash: window.location.hash };
      unmount();
      return out;
    };
    const on = open(true);
    const off = open(false);
    expect(on.labels).toEqual(["intro", "fork", "L1", "L2", "end"]);
    expect(off.labels).toEqual(on.labels);
    expect(off.received).toEqual(["left"]);
    expect(off.hash).toBe("#s.a=x.left&s.frame=3");
  });

  it("a link restores the input, the answers, then the frame", () => {
    reducedMotion();
    // [1,3,2,0]: cmp-0-0 keeps (frame 1); cmp-1-0 is frame 6 and keeps.
    window.history.replaceState(null, "", "#q.in=1-3-2-0&q.a=keep.keep&q.frame=8");
    const { result } = linked();
    expect(result.current.input).toEqual([1, 3, 2, 0]);
    expect(result.current.run.frame).toBe(8);
    expect(result.current.run.record.entries.map((e) => [e.id, e.frame, e.status])).toEqual([
      ["cmp-0-0", 1, "pass"],
      ["cmp-1-0", 6, "pass"],
    ]);
  });

  it("answering writes the answers to the link", () => {
    const { result } = linked();
    act(() => result.current.run.player.next());
    act(() => result.current.run.respond("swap"));
    expect(window.location.hash).toContain("q.a=swap");
  });

  it("a link with an unparsable answer ignores all answers and lands on the first unsettled prompt", () => {
    reducedMotion();
    window.history.replaceState(null, "", "#q.in=3-1-2-0&q.a=swap.bogus&q.frame=9");
    const { result } = linked();
    expect(result.current.run.frame).toBe(1);
    expect(result.current.run.record.entries.every((e) => e.attempts.length === 0)).toBe(true);
    expect(result.current.run.active?.entry.id).toBe("cmp-0-0");
  });

  it("a frame-only link past an unsettled prompt lands on it", () => {
    reducedMotion();
    window.history.replaceState(null, "", "#q.frame=9");
    const { result } = linked();
    expect(result.current.run.frame).toBe(1);
  });

  it("a link replays generator answers, then lands on the frame", () => {
    reducedMotion();
    received = [];
    window.history.replaceState(null, "", "#s.a=left&s.frame=3");
    const { result } = renderHook(() =>
      usePrompts(
        { simulation: story, input: null },
        { syncHash: "s.frame", syncAnswers: { key: "s.a", serialize: (a: string) => a, parse: (v: string) => v } }
      )
    );
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork", "L1", "L2", "end"]);
    expect(result.current.frame).toBe(3);
    expect(result.current.record.entries[0]).toMatchObject({ id: "fork", status: "answered", attempts: ["left"] });
  });
});
