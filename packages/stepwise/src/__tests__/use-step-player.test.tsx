import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useStepPlayer } from "../use-step-player";
import type { PlayerEngine, PlayerEngineApi, PlayerEngineHandle } from "../types";

function createFakeEngine() {
  let api: PlayerEngineApi | null = null;
  const handle: PlayerEngineHandle = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setRate: vi.fn(),
    disconnect: vi.fn(),
  };
  const engine: PlayerEngine = {
    connect(next) {
      api = next;
      return handle;
    },
  };
  return {
    engine,
    handle,
    connected: () => api !== null,
    emitFrame: (frame: number) => api?.onFrame(frame),
    emitEnd: () => api?.onEnd(),
  };
}

function clearHash() {
  window.history.replaceState(null, "", window.location.pathname);
}

beforeEach(clearHash);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearHash();
});

describe("useStepPlayer — built-in timer", () => {
  it("is unstarted: frame -1, paused", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3 }));
    expect(result.current.frame).toBe(-1);
    expect(result.current.index).toBe(-1);
    expect(result.current.playing).toBe(false);
    expect(result.current.atEnd).toBe(false);
  });

  it("start() begins at frame 0 and plays", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3 }));
    act(() => result.current.start());
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("timer advances frames and stops at the end", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, autoPlay: true, baseDelayMs: 300 })
    );
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.index).toBe(1);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.index).toBe(2);
    expect(result.current.atEnd).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it("seek() clamps and pauses", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3, autoPlay: true }));
    act(() => result.current.seek(10));
    expect(result.current.index).toBe(2);
    expect(result.current.playing).toBe(false);
    expect(result.current.atEnd).toBe(true);
  });

  it("next() pauses and advances; prev() pauses and steps back", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3, autoPlay: true }));
    act(() => result.current.next());
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(1);
    act(() => result.current.prev());
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it("toggle() at the end replays from frame 0", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3 }));
    act(() => result.current.seek(2));
    expect(result.current.atEnd).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("toggle() pauses and resumes mid-timeline", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3, autoPlay: true }));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    expect(result.current.index).toBe(0); // resume, no jump
  });

  it("onEmpty fires on next/toggle with no timeline, and the player stays empty", () => {
    const onEmpty = vi.fn();
    const { result } = renderHook(() => useStepPlayer({ total: 0 }));
    act(() => result.current.next(onEmpty));
    act(() => result.current.toggle(onEmpty));
    expect(onEmpty).toHaveBeenCalledTimes(2);
    expect(result.current.index).toBe(-1);
    expect(result.current.playing).toBe(false);
  });

  it("reset() returns to the unstarted state", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3, autoPlay: true }));
    act(() => result.current.reset());
    expect(result.current.frame).toBe(-1);
    expect(result.current.playing).toBe(false);
  });
});

describe("useStepPlayer — deep linking", () => {
  it("honors #<key>=<n> on mount", () => {
    window.location.hash = "frame=2";
    const { result } = renderHook(() =>
      useStepPlayer({ total: 5, syncHash: "frame" })
    );
    expect(result.current.index).toBe(2);
  });

  it("ignores out-of-range and unknown hashes on mount", () => {
    window.location.hash = "frame=99";
    const outOfRange = renderHook(() => useStepPlayer({ total: 5, syncHash: "frame" }));
    expect(outOfRange.result.current.index).toBe(-1);
    cleanup();
    clearHash();

    window.location.hash = "other=1";
    const unknownKey = renderHook(() => useStepPlayer({ total: 5, syncHash: "frame" }));
    expect(unknownKey.result.current.index).toBe(-1);
  });

  it("writes the hash as the index changes", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 5, syncHash: "frame" }));
    act(() => result.current.seek(2));
    expect(window.location.hash).toBe("#frame=2");
  });
});

describe("useStepPlayer — end state", () => {
  it("ended becomes true when the timer plays through the final frame", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 2, autoPlay: true, baseDelayMs: 100 })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.index).toBe(1);
    expect(result.current.atEnd).toBe(true);
    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it("onEnd fires exactly once per playthrough", () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, autoPlay: true, baseDelayMs: 100, onEnd })
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.ended).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("seeking to the last frame does NOT set ended (that's what atEnd is for)", () => {
    const { result } = renderHook(() => useStepPlayer({ total: 3 }));
    act(() => result.current.seek(2));
    expect(result.current.atEnd).toBe(true);
    expect(result.current.ended).toBe(false);
  });

  it("any cursor movement clears ended", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 2, autoPlay: true, baseDelayMs: 100 })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.ended).toBe(true);

    act(() => result.current.seek(0));
    expect(result.current.ended).toBe(false);

    act(() => result.current.toggle()); // resume from frame 0
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // played through again — ended until the next movement
    expect(result.current.ended).toBe(true);
    act(() => result.current.prev());
    expect(result.current.ended).toBe(false);
  });

  it("toggle() at end replays and clears ended", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 2, autoPlay: true, baseDelayMs: 100 })
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.toggle());
    expect(result.current.ended).toBe(false);
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("engine onEnd sets ended and fires the callback; repeats are idempotent", () => {
    const fake = createFakeEngine();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, engine: fake.engine, autoPlay: true, onEnd })
    );
    act(() => fake.emitEnd());
    act(() => fake.emitEnd());
    act(() => fake.emitEnd());
    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("engine frames reaching the last frame alone do not mark ended", () => {
    const fake = createFakeEngine();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, engine: fake.engine, autoPlay: true })
    );
    act(() => fake.emitFrame(2));
    expect(result.current.atEnd).toBe(true);
    expect(result.current.ended).toBe(false);
  });

  it("a new timeline clears completion", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100 }),
      { initialProps: { total: 2 } }
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.ended).toBe(true);
    rerender({ total: 5 });
    expect(result.current.ended).toBe(false);
  });
});

describe("useStepPlayer — custom engine", () => {
  it("connects on mount, frames drive the index, end pauses, disconnect on unmount", () => {
    const fake = createFakeEngine();
    const { result, unmount } = renderHook(() =>
      useStepPlayer({ total: 3, engine: fake.engine, autoPlay: true })
    );
    expect(fake.connected()).toBe(true);

    act(() => fake.emitFrame(1));
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(true);

    act(() => fake.emitEnd());
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(1); // cursor stays

    unmount();
    expect(fake.handle.disconnect).toHaveBeenCalledTimes(1);
  });

  it("player controls forward play/pause/seek/rate to the handle", () => {
    const fake = createFakeEngine();
    const { result } = renderHook(() =>
      useStepPlayer({ total: 3, engine: fake.engine })
    );
    act(() => result.current.start());
    expect(fake.handle.seek).toHaveBeenCalledWith(0);
    expect(fake.handle.play).toHaveBeenCalled();

    act(() => result.current.seek(2));
    expect(fake.handle.pause).toHaveBeenCalled();
    expect(fake.handle.seek).toHaveBeenLastCalledWith(2);

    act(() => result.current.setSpeed(1.5));
    expect(fake.handle.setRate).toHaveBeenCalledWith(1.5);
  });

  it("reconnects when the engine identity changes (old one disconnects)", () => {
    const first = createFakeEngine();
    const second = createFakeEngine();
    const { rerender, unmount } = renderHook(
      ({ engine }) => useStepPlayer({ total: 3, engine }),
      { initialProps: { engine: first.engine } }
    );
    expect(first.connected()).toBe(true);
    rerender({ engine: second.engine });
    expect(first.handle.disconnect).toHaveBeenCalledTimes(1);
    expect(second.connected()).toBe(true);
    unmount();
    expect(second.handle.disconnect).toHaveBeenCalledTimes(1);
    expect(first.handle.disconnect).toHaveBeenCalledTimes(1);
  });
});
