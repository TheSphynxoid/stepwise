import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Simulation } from "../simulation";
import { useSimulation } from "../use-simulation";
import { useStepPlayer } from "../use-step-player";
import { useTrace } from "../use-trace";
import type { StepwiseStep } from "../types";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = realMatchMedia;
  window.history.replaceState(null, "", window.location.pathname);
});

function mockReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// One act per frame: the next timeout is scheduled by the re-render.
const tick = (n = 1) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(100));
};

type K = StepwiseStep;
const k = (key: string): K => ({ tone: "neutral", label: key, key });

describe("useStepPlayer — follow", () => {
  it("plays into appended frames when parked at the end", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { total: 3 } }
    );
    tick(2);
    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(result.current.live).toBe(true);

    rerender({ total: 5 });
    expect(result.current.playing).toBe(true);
    expect(result.current.ended).toBe(false);
    expect(result.current.index).toBe(2);
    tick();
    expect(result.current.index).toBe(3);
    tick();
    expect(result.current.index).toBe(4);
    expect(result.current.ended).toBe(true);
  });

  it("without follow, appended frames wait (the 0.2 behavior)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100 }),
      { initialProps: { total: 2 } }
    );
    tick();
    expect(result.current.ended).toBe(true);
    rerender({ total: 4 });
    tick(3);
    expect(result.current.index).toBe(1);
    expect(result.current.live).toBe(false);
  });

  it("a reader who scrubbed back stays put; goLive returns them", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { total: 3 } }
    );
    const { goLive } = result.current;
    act(() => result.current.seek(0));
    expect(result.current.live).toBe(false);

    rerender({ total: 6 });
    tick(3);
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(false);

    act(() => result.current.goLive());
    expect(result.current.index).toBe(5);
    expect(result.current.live).toBe(true);
    expect(result.current.playing).toBe(false);

    rerender({ total: 7 });
    tick();
    expect(result.current.index).toBe(6);
    expect(result.current.goLive).toBe(goLive);
  });

  it("pausing mid-trace leaves the live edge", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { total: 5 } }
    );
    tick();
    expect(result.current.live).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.live).toBe(false);
    rerender({ total: 8 });
    tick(2);
    expect(result.current.index).toBe(1);
  });

  it("mounted empty with autoPlay, starts on the first frames", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { total: 0 } }
    );
    expect(result.current.index).toBe(-1);
    expect(result.current.live).toBe(true);
    rerender({ total: 2 });
    expect(result.current.index).toBe(0);
    tick();
    expect(result.current.index).toBe(1);
  });

  it("reduced motion: an empty following player doesn't start on its own", () => {
    vi.useFakeTimers();
    mockReducedMotion();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { total: 0 } }
    );
    expect(result.current.live).toBe(false);
    rerender({ total: 3 });
    tick(3);
    expect(result.current.index).toBe(-1);
    expect(result.current.playing).toBe(false);
  });

  it("checkpoints still hold, also with frames arriving while held", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ total }) => useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true, holdAt: (f) => f === 3 }),
      { initialProps: { total: 3 } }
    );
    tick(2);
    expect(result.current.ended).toBe(true);
    rerender({ total: 5 });
    tick();
    expect(result.current.index).toBe(3);
    expect(result.current.held).toBe(3);
    expect(result.current.live).toBe(false);

    rerender({ total: 8 });
    tick(3);
    expect(result.current.index).toBe(3);
    expect(result.current.held).toBe(3);

    act(() => result.current.release());
    tick();
    expect(result.current.index).toBe(4);
  });

  it("a linked frame isn't yanked to the edge", () => {
    vi.useFakeTimers();
    mockReducedMotion();
    window.history.replaceState(null, "", "#frame=1");
    const { result, rerender } = renderHook(
      ({ total }) =>
        useStepPlayer({ total, autoPlay: true, baseDelayMs: 100, follow: true, syncHash: "frame" }),
      { initialProps: { total: 4 } }
    );
    expect(result.current.index).toBe(1);
    rerender({ total: 6 });
    tick(3);
    expect(result.current.index).toBe(1);
    expect(window.location.hash).toBe("#frame=1");
  });
});

describe("useTrace / useSimulation — follow", () => {
  it("an appended keyed trace keeps playing from the same step", () => {
    vi.useFakeTimers();
    const A = [k("a"), k("b"), k("c")];
    const B = [...A.map((s) => ({ ...s })), k("d"), k("e")];
    const { result, rerender } = renderHook(
      ({ steps }) => useTrace(steps, { autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { steps: A } }
    );
    tick(2);
    expect(result.current.step?.key).toBe("c");
    rerender({ steps: B });
    expect(result.current.step?.key).toBe("c");
    tick();
    expect(result.current.step?.key).toBe("d");
  });

  it("a reader behind the edge keeps their step when the trace grows", () => {
    const A = [k("a"), k("b"), k("c")];
    const B = [...A.map((s) => ({ ...s })), k("d")];
    const { result, rerender } = renderHook(({ steps }) => useTrace(steps, { follow: true }), {
      initialProps: { steps: A },
    });
    act(() => result.current.player.seek(1));
    rerender({ steps: B });
    expect(result.current.step?.key).toBe("b");
    expect(result.current.player.live).toBe(false);
  });

  it("a move history: each new move plays in, with its timed follow-up frame", () => {
    vi.useFakeTimers();
    // Every move yields "flip", and a miss also yields a timed "hide" frame:
    // the beat between them is the player's own timer.
    const game: Simulation<number[], K> = function* (moves) {
      yield k("start");
      for (let i = 0; i < moves.length; i++) {
        yield k(`m${i}`);
        if (moves[i] % 2) yield k(`m${i}.hide`);
      }
    };
    const { result, rerender } = renderHook(
      ({ moves }) => useSimulation(game, moves, { autoPlay: true, baseDelayMs: 100, follow: true }),
      { initialProps: { moves: [] as number[] } }
    );
    expect(result.current.step?.key).toBe("start");
    rerender({ moves: [1] });
    tick();
    expect(result.current.step?.key).toBe("m0");
    tick();
    expect(result.current.step?.key).toBe("m0.hide");
    expect(result.current.player.ended).toBe(true);

    rerender({ moves: [1, 2] });
    tick();
    expect(result.current.step?.key).toBe("m1");
    expect(result.current.player.live).toBe(true);
  });
});
