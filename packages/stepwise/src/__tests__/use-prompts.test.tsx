import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Simulation } from "../simulation";
import type { WalkSimulation, WalkStep } from "../walk";
import type { Prompt } from "../prompts";
import { usePrompts } from "../use-prompts";
import type { PromptsOptions } from "../use-prompts";

afterEach(() => {
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
