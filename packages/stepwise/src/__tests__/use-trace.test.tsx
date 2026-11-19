import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useTrace } from "../use-trace";
import type { StepwiseStep } from "../types";

afterEach(cleanup);

type Frame = StepwiseStep<{ arr: number[] }>;

const STEPS: Frame[] = [
  { tone: "neutral", label: "compare", arr: [2, 1] },
  { tone: "write", label: "swap", arr: [1, 2] },
  { tone: "good", label: "sorted", arr: [1, 2] },
];

describe("useTrace", () => {
  it("renders frame 0 before the player starts (never the last frame)", () => {
    const { result } = renderHook(() => useTrace(STEPS));
    expect(result.current.player.index).toBe(-1);
    expect(result.current.frame).toBe(0);
    expect(result.current.step?.label).toBe("compare");
  });

  it("follows the player and exposes the typed payload", () => {
    const { result } = renderHook(() => useTrace(STEPS));
    act(() => result.current.player.seek(1));
    expect(result.current.frame).toBe(1);
    expect(result.current.step?.arr).toEqual([1, 2]);
  });

  it("toneAt / titleAt read the latest steps and stay stable", () => {
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps), {
      initialProps: { steps: STEPS },
    });
    const { toneAt, titleAt } = result.current;
    expect(toneAt(1)).toBe("write");
    expect(titleAt(2)).toBe("sorted");
    expect(toneAt(9)).toBe("neutral");

    rerender({ steps: [{ tone: "bad", label: "other", arr: [] }] });
    expect(result.current.toneAt).toBe(toneAt);
    expect(toneAt(0)).toBe("bad");
    expect(titleAt(0)).toBe("other");
  });

  // A page that derives the trace in render (`BUILDS.slice(0, n)`) passes a
  // new array every render. Re-anchoring onto the same index must not force
  // another commit, or the page renders forever (React #185).
  it("an array rebuilt every render (slice) does not loop", () => {
    const keyed: Frame[] = STEPS.map((s, i) => ({ ...s, key: `k${i}` }));
    const { result } = renderHook(() => useTrace(keyed.slice(0, 3)));
    act(() => result.current.player.seek(1));
    expect(result.current.frame).toBe(1);
    expect(result.current.step?.label).toBe("swap");
  });

  it("a growing feed sliced every render, followed and playing, does not loop", () => {
    vi.useFakeTimers();
    const feed: Frame[] = Array.from({ length: 8 }, (_, i) => ({ key: `b${i}`, tone: "good", label: `b${i}`, arr: [] }));
    const { result, rerender } = renderHook(({ n }) => useTrace(feed.slice(0, n), { follow: true, autoPlay: true, baseDelayMs: 100 }), {
      initialProps: { n: 3 },
    });
    act(() => result.current.player.goLive());
    expect(result.current.frame).toBe(2);
    rerender({ n: 5 });
    for (let t = 0; t < 5; t++) act(() => vi.advanceTimersByTime(100));
    expect(result.current.frame).toBe(4);
    vi.useRealTimers();
  });

  it("a move made while the page rebuilds the array is not undone", () => {
    vi.useFakeTimers();
    const feed: Frame[] = Array.from({ length: 4 }, (_, i) => ({ key: `b${i}`, tone: "good", label: `b${i}`, arr: [] }));
    const { result } = renderHook(() => useTrace(feed.slice(0, 3), { follow: true, autoPlay: true }));
    act(() => result.current.player.goLive());
    expect(result.current.frame).toBe(2);
    act(() => result.current.player.seek(1));
    expect(result.current.frame).toBe(1);
    vi.useRealTimers();
  });

  it("an array of fresh but equal steps every render does not loop", () => {
    const { result } = renderHook(() => useTrace(STEPS.map((s, i) => ({ ...s, key: `k${i}` }))));
    act(() => result.current.player.seek(2));
    expect(result.current.frame).toBe(2);
  });

  it("is empty-safe", () => {
    const { result } = renderHook(() => useTrace<Frame>([]));
    expect(result.current.frame).toBe(-1);
    expect(result.current.step).toBeUndefined();
  });
});
