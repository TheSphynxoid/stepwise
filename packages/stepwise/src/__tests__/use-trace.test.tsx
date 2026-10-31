import { afterEach, describe, expect, it } from "vitest";
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

  it("is empty-safe", () => {
    const { result } = renderHook(() => useTrace<Frame>([]));
    expect(result.current.frame).toBe(-1);
    expect(result.current.step).toBeUndefined();
  });
});
