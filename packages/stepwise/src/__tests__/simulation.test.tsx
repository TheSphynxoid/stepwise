import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { reanchor, stepKey } from "../reanchor";
import { createRng, runSimulation, type Simulation } from "../simulation";
import { useSimulation } from "../use-simulation";
import { useStepPlayer } from "../use-step-player";
import { useTrace } from "../use-trace";
import type { StepwiseStep } from "../types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type K = StepwiseStep<{ v?: number }>;
const k = (key: string | undefined, v?: number): K => ({ tone: "neutral", label: key ?? "-", key, v });

describe("reanchor", () => {
  it("lands on the same key at its new position", () => {
    const old = [k("a"), k("b"), k("c")];
    const next = [k("x"), k("a"), k("b"), k("c")];
    expect(reanchor(old, 2, next, stepKey)).toBe(3);
  });

  it("walks back to the latest shared key when the current one is gone", () => {
    const old = [k("a"), k("b"), k("c"), k("d")];
    const next = [k("a"), k("b"), k("z")];
    expect(reanchor(old, 3, next, stepKey)).toBe(1);
  });

  it("returns 0 with no shared keys, -1 for an empty trace, 0 before start", () => {
    expect(reanchor([k("a")], 0, [k("b")], stepKey)).toBe(0);
    expect(reanchor([k("a")], 0, [], stepKey)).toBe(-1);
    expect(reanchor([k("a")], -1, [k("a")], stepKey)).toBe(0);
  });

  it("skips unkeyed steps and takes the first occurrence of a duplicate key", () => {
    const old = [k("a"), k(undefined)];
    const next = [k("q"), k("a"), k("a")];
    expect(reanchor(old, 1, next, stepKey)).toBe(1);
  });
});

describe("createRng", () => {
  it("is deterministic per seed, and string seeds work", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.int(1, 6)];
    expect([b.next(), b.next(), b.int(1, 6)]).toEqual(seqA);
    expect(createRng("demo").next()).toBe(createRng("demo").next());
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("int stays in range; shuffle is a permutation and leaves the input alone", () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 5);
      expect(n >= 3 && n <= 5 && Number.isInteger(n)).toBe(true);
    }
    const input = [1, 2, 3, 4, 5];
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
    expect(() => r.pick([])).toThrow(RangeError);
  });
});

// Linear scan for a target: one keyed step per probe, so changing the input
// array shifts where "found" happens but keeps the probes' identities.
type Scan = StepwiseStep<{ arr: number[]; at: number }>;
const scan: Simulation<{ arr: number[]; target: number }, Scan> = function* ({ arr, target }) {
  for (let i = 0; i < arr.length; i++) {
    const hit = arr[i] === target;
    yield { key: `probe:${i}`, tone: hit ? "good" : "neutral", label: hit ? "found" : `probe ${i}`, arr, at: i };
    if (hit) return;
  }
  yield { key: "miss", tone: "bad", label: "not found", arr, at: -1 };
};

describe("runSimulation", () => {
  it("collects the generator's steps", () => {
    const r = runSimulation(scan, { arr: [4, 5, 6], target: 5 });
    expect(r.steps.map((s) => s.label)).toEqual(["probe 0", "found"]);
    expect(r.truncated).toBe(false);
    expect(r.error).toBe(null);
  });

  it("caps runaway simulations and keeps steps before a throw", () => {
    const forever: Simulation<null, K> = function* () {
      for (let i = 0; ; i++) yield k(`s${i}`);
    };
    const capped = runSimulation(forever, null, { maxSteps: 50 });
    expect(capped.steps).toHaveLength(50);
    expect(capped.truncated).toBe(true);

    const boom: Simulation<null, K> = function* () {
      yield k("a");
      throw new Error("bad input");
    };
    const failed = runSimulation(boom, null);
    expect(failed.steps).toHaveLength(1);
    expect((failed.error as Error).message).toBe("bad input");
  });

  it("hands the simulation a seeded rng: same seed, same trace", () => {
    const noisy: Simulation<number, K> = function* (n, { rng }) {
      for (let i = 0; i < n; i++) yield k(`s${i}`, rng.int(0, 100));
    };
    const a = runSimulation(noisy, 5, { seed: "replay" });
    const b = runSimulation(noisy, 5, { seed: "replay" });
    expect(a.steps.map((s) => s.v)).toEqual(b.steps.map((s) => s.v));
    expect(a.seed).toBe(b.seed);
  });
});

describe("useTrace — keyed re-anchoring", () => {
  it("keeps the playhead on the same key when the trace changes", () => {
    const A = [k("a"), k("b"), k("c")];
    const B = [k("new"), k("a"), k("b"), k("c")];
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps), { initialProps: { steps: A } });
    act(() => result.current.player.seek(1));
    expect(result.current.step?.key).toBe("b");
    rerender({ steps: B });
    expect(result.current.step?.key).toBe("b");
    expect(result.current.frame).toBe(2);
    expect(result.current.player.index).toBe(2);
  });

  it("does not interrupt playback", () => {
    vi.useFakeTimers();
    const A = [k("a"), k("b"), k("c"), k("d")];
    const B = [k("z"), k("a"), k("b"), k("c"), k("d")];
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps, { autoPlay: true, baseDelayMs: 100 }), {
      initialProps: { steps: A },
    });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.step?.key).toBe("b");
    rerender({ steps: B });
    expect(result.current.step?.key).toBe("b");
    expect(result.current.player.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.step?.key).toBe("c");
  });

  it("unkeyed traces keep the old behavior (same index, clamped)", () => {
    const A: K[] = [{ tone: "neutral", label: "0" }, { tone: "neutral", label: "1" }, { tone: "neutral", label: "2" }];
    const B: K[] = [{ tone: "neutral", label: "x" }, { tone: "neutral", label: "y" }];
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps), { initialProps: { steps: A } });
    act(() => result.current.player.seek(2));
    rerender({ steps: B });
    expect(result.current.step?.label).toBe("y");
  });

  it("shows the player's frame when an effect moves it right after a trace change", () => {
    // Re-anchoring moves the cursor to 0, then a sibling effect in the same
    // commit moves it back to 2: the player's state nets out unchanged, and
    // the display must still follow it (not stay on the anchored frame).
    const A = [k("a"), k("b"), k("c"), k("d")];
    const B = [k("a"), k("z"), k("y"), k("w")];
    const { result, rerender } = renderHook(
      ({ steps }) => {
        const t = useTrace(steps);
        const { jump } = t.player;
        useEffect(() => {
          if (steps === B) jump(2);
        }, [steps, jump]);
        return t;
      },
      { initialProps: { steps: A } }
    );
    act(() => result.current.player.seek(2));
    rerender({ steps: B });
    expect(result.current.player.index).toBe(2);
    expect(result.current.frame).toBe(2);
    expect(result.current.step?.key).toBe("y");
  });

  it("supports a custom keyOf", () => {
    const A = [k(undefined, 1), k(undefined, 2), k(undefined, 3)];
    const B = [k(undefined, 0), k(undefined, 1), k(undefined, 2), k(undefined, 3)];
    const { result, rerender } = renderHook(
      ({ steps }) => useTrace(steps, { keyOf: (s) => (s.v === undefined ? undefined : `v${s.v}`) }),
      { initialProps: { steps: A } }
    );
    act(() => result.current.player.seek(1));
    rerender({ steps: B });
    expect(result.current.step?.v).toBe(2);
  });
});

describe("useSimulation", () => {
  it("recomputes on input change and stays on the same probe", () => {
    const { result, rerender } = renderHook(({ input }) => useSimulation(scan, input), {
      initialProps: { input: { arr: [1, 2, 3, 9], target: 9 } },
    });
    expect(result.current.steps).toHaveLength(4);
    act(() => result.current.player.seek(2));
    expect(result.current.step?.key).toBe("probe:2");

    rerender({ input: { arr: [7, 8, 9, 1, 2], target: 2 } });
    expect(result.current.steps).toHaveLength(5);
    expect(result.current.step?.key).toBe("probe:2");

    // The target is found earlier now: probe 3 no longer exists past "found".
    act(() => result.current.player.seek(3));
    rerender({ input: { arr: [2, 0, 0, 0], target: 2 } });
    expect(result.current.step?.key).toBe("probe:0");
  });

  it("keeps the same trace for an equal seed and exposes the result fields", () => {
    const input = { arr: [3, 1], target: 4 };
    const { result } = renderHook(() => useSimulation(scan, input, { seed: 5 }));
    expect(result.current.step?.label).toBe("probe 0");
    expect(result.current.steps.at(-1)?.label).toBe("not found");
    expect(result.current.truncated).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.seed).toBe(5);
  });
});

describe("useStepPlayer — hash read on mount", () => {
  it("doesn't overwrite a linked frame before applying it", () => {
    window.history.replaceState(null, "", "#frame=2&other=x");
    const seen: string[] = [];
    // A sibling effect in the same commit (e.g. a page restoring its own
    // linked state) must still see the frame from the link.
    const { result } = renderHook(() => {
      const p = useStepPlayer({ total: 5, syncHash: "frame", autoPlay: true, baseDelayMs: 60_000 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => void seen.push(window.location.hash), []);
      return p;
    });
    expect(seen[0]).toBe("#frame=2&other=x");
    expect(result.current.index).toBe(2);
    expect(window.location.hash).toBe("#frame=2&other=x");
    window.history.replaceState(null, "", window.location.pathname);
  });
});

describe("useTrace — re-anchoring with syncHash", () => {
  it("a recomputed trace doesn't re-read the stale frame from the URL", () => {
    window.history.replaceState(null, "", window.location.pathname);
    const A = [k("a"), k("b"), k("c"), k("d")];
    const B = [k("x"), k("y"), k("a"), k("b"), k("c"), k("d")];
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps, { syncHash: "frame" }), {
      initialProps: { steps: A },
    });
    act(() => result.current.player.seek(2));
    expect(window.location.hash).toBe("#frame=2");
    // Someone else rewrites their own hash part right before the recompute
    // (a page storing its input), so the hash no longer matches what the
    // player last wrote.
    window.history.replaceState(null, "", "#frame=2&in=1.2.3");
    rerender({ steps: B });
    expect(result.current.step?.key).toBe("c");
    expect(result.current.player.index).toBe(4);
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("still applies a linked frame when the timeline arrives after mount", () => {
    window.history.replaceState(null, "", "#frame=2");
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps, { syncHash: "frame" }), {
      initialProps: { steps: [] as K[] },
    });
    rerender({ steps: [k("a"), k("b"), k("c")] });
    expect(result.current.step?.key).toBe("c");
    window.history.replaceState(null, "", window.location.pathname);
  });
});

describe("useStepPlayer — checkpoints", () => {
  it("holds autoplay on a checkpoint until release()", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 5, autoPlay: true, baseDelayMs: 100, holdAt: (f) => f === 2 })
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(2);
    expect(result.current.held).toBe(2);
    expect(result.current.playing).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(2);

    act(() => result.current.release());
    expect(result.current.held).toBe(null);
    expect(result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(3);
  });

  it("never holds manual steps, and play on a checkpoint releases it", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStepPlayer({ total: 5, baseDelayMs: 100, holdAt: (f) => f === 1 }));
    act(() => result.current.seek(1));
    expect(result.current.held).toBe(null);
    act(() => result.current.next());
    expect(result.current.index).toBe(2);

    act(() => result.current.seek(1));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(2);
  });

  it("re-arms checkpoints on start(); release/jump stay stable", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 4, autoPlay: true, baseDelayMs: 100, holdAt: (f) => f === 1 })
    );
    const { release, jump } = result.current;
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.held).toBe(1);
    act(() => result.current.release());
    // One act per frame: the next timeout is scheduled by the re-render.
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.ended).toBe(true);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.held).toBe(1);
    expect(result.current.release).toBe(release);
    expect(result.current.jump).toBe(jump);
  });

  it("useTrace's holdAt receives the step from the current trace", () => {
    vi.useFakeTimers();
    const A = [k("a"), k("stop"), k("c")];
    const { result } = renderHook(() =>
      useTrace(A, { autoPlay: true, baseDelayMs: 100, holdAt: (_, s) => s?.key === "stop" })
    );
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.player.held).toBe(1);
    expect(result.current.step?.key).toBe("stop");
  });

  it("jump moves the cursor without pausing", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStepPlayer({ total: 6, autoPlay: true, baseDelayMs: 100 }));
    act(() => result.current.jump(3));
    expect(result.current.index).toBe(3);
    expect(result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(4);
  });
});
