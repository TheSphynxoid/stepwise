import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSteps } from "../use-steps";

describe("useSteps", () => {
  it("starts at index 0 by default", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"]));
    expect(result.current.index).toBe(0);
    expect(result.current.count).toBe(3);
  });

  it("respects initialIndex", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"], { initialIndex: 2 }));
    expect(result.current.index).toBe(2);
    expect(result.current.atEnd).toBe(true);
  });

  it("next advances, prev retreats", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"]));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    act(() => result.current.prev());
    expect(result.current.index).toBe(0);
  });

  it("next at end is a no-op (clamped)", () => {
    const { result } = renderHook(() => useSteps(["a", "b"], { initialIndex: 1 }));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(result.current.atEnd).toBe(true);
  });

  it("prev at start is a no-op (clamped)", () => {
    const { result } = renderHook(() => useSteps(["a", "b"]));
    act(() => result.current.prev());
    expect(result.current.index).toBe(0);
    expect(result.current.atStart).toBe(true);
  });

  it("go() clamps to valid range", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"]));
    act(() => result.current.go(10));
    expect(result.current.index).toBe(2);
    act(() => result.current.go(-5));
    expect(result.current.index).toBe(0);
  });

  it("first() jumps to index 0", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"], { initialIndex: 2 }));
    act(() => result.current.first());
    expect(result.current.index).toBe(0);
  });

  it("fires onChange on movement", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSteps(["a", "b", "c"], { onChange }));
    act(() => result.current.next());
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("does not fire onChange on clamped no-op", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSteps(["a"], { onChange, initialIndex: 0 }));
    act(() => result.current.next());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-clamps when the sequence shrinks", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useSteps(items),
      { initialProps: { items: ["a", "b", "c", "d", "e"] } }
    );
    act(() => result.current.go(4));
    expect(result.current.index).toBe(4);
    rerender({ items: ["a", "b"] });
    expect(result.current.index).toBe(1);
  });

  it("reports -1 for an empty sequence", () => {
    const { result } = renderHook(() => useSteps([]));
    expect(result.current.index).toBe(-1);
    expect(result.current.count).toBe(0);
  });

  it("keeps callbacks referentially stable", () => {
    const { result, rerender } = renderHook(() => useSteps(["a", "b"]));
    const first = result.current;
    rerender();
    expect(result.current.go).toBe(first.go);
    expect(result.current.next).toBe(first.next);
    expect(result.current.prev).toBe(first.prev);
    expect(result.current.first).toBe(first.first);
  });

  it("works with a numeric count instead of items", () => {
    const { result } = renderHook(() => useSteps(5));
    expect(result.current.count).toBe(5);
    act(() => result.current.go(3));
    expect(result.current.index).toBe(3);
  });

  it("boundary flags are correct", () => {
    const { result } = renderHook(() => useSteps(["a", "b", "c"]));
    expect(result.current.atStart).toBe(true);
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(true);
    act(() => result.current.go(2));
    expect(result.current.atEnd).toBe(true);
    expect(result.current.canNext).toBe(false);
    expect(result.current.canPrev).toBe(true);
  });
});

