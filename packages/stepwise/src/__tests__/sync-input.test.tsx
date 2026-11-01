import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Simulation } from "../simulation";
import { useSimulation } from "../use-simulation";
import type { StepwiseStep } from "../types";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", window.location.pathname);
});

// n steps keyed s0..s{n-1}: a longer input makes a longer trace, so a linked
// frame only exists once the linked input is in.
type K = StepwiseStep;
const count: Simulation<number, K> = function* (n) {
  for (let i = 0; i < n; i++) yield { key: `s${i}`, tone: "neutral", label: `s${i}` };
};

const syncInput = (onRestore: (n: number) => void) => ({
  key: "n",
  serialize: (n: number) => String(n),
  parse: (v: string) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null),
  onRestore,
});

function useLinked(initial: number, frameKey: string | undefined = "frame") {
  const [input, setInput] = useState(initial);
  const sim = useSimulation(count, input, { syncHash: frameKey, syncInput: syncInput(setInput) });
  return { input, setInput, sim };
}

describe("useSimulation — syncInput", () => {
  it("restores the input from the URL, then applies the linked frame to its trace", () => {
    window.history.replaceState(null, "", "#frame=4&n=6");
    const { result } = renderHook(() => useLinked(2));
    expect(result.current.input).toBe(6);
    expect(result.current.sim.steps).toHaveLength(6);
    expect(result.current.sim.frame).toBe(4);
    expect(result.current.sim.step?.key).toBe("s4");
    expect(window.location.hash).toBe("#frame=4&n=6");
  });

  it("writes edits to the URL and keeps the other hash parts", () => {
    window.history.replaceState(null, "", "#notes&frame=0");
    const { result } = renderHook(() => useLinked(3));
    expect(window.location.hash).toBe("#notes&frame=0");
    act(() => result.current.setInput(5));
    expect(window.location.hash).toBe("#notes&frame=0&n=5");
  });

  it("ignores a value parse rejects, and writes nothing on mount", () => {
    window.history.replaceState(null, "", "#n=banana");
    const { result } = renderHook(() => useLinked(3));
    expect(result.current.input).toBe(3);
    expect(window.location.hash).toBe("#n=banana");
  });

  it("without syncHash, restores the input and starts from frame 0", () => {
    window.history.replaceState(null, "", "#n=4");
    const { result } = renderHook(() => useLinked(2, undefined));
    expect(result.current.input).toBe(4);
    expect(result.current.sim.frame).toBe(0);
  });

  it("survives StrictMode's double effects", () => {
    window.history.replaceState(null, "", "#frame=3&n=5");
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useLinked(2), { wrapper });
    expect(result.current.input).toBe(5);
    expect(result.current.sim.frame).toBe(3);
    expect(window.location.hash).toBe("#frame=3&n=5");
  });

  it("a linked frame stays put under autoplay with reduced motion", () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    window.history.replaceState(null, "", "#frame=2&n=4");
    const { result } = renderHook(() => {
      const [input, setInput] = useState(1);
      return useSimulation(count, input, { autoPlay: true, syncHash: "frame", syncInput: syncInput(setInput) });
    });
    expect(result.current.frame).toBe(2);
    expect(result.current.player.playing).toBe(false);
    expect(window.location.hash).toBe("#frame=2&n=4");
  });
});

describe("useSimulation — rebuilt input warning", () => {
  it("warns once when the input is a new object with the same content every render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sim: Simulation<{ n: number }, K> = function* ({ n }) {
      yield { key: "a", tone: "neutral", label: String(n) };
    };
    const { rerender } = renderHook(({ n }) => useSimulation(sim, { n }), { initialProps: { n: 1 } });
    for (let i = 0; i < 6; i++) rerender({ n: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("useMemo");
    warn.mockRestore();
  });

  it("stays quiet for stable or genuinely changing inputs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sim: Simulation<{ n: number }, K> = function* ({ n }) {
      yield { key: "a", tone: "neutral", label: String(n) };
    };
    const stable = { n: 1 };
    const a = renderHook(() => useSimulation(sim, stable));
    for (let i = 0; i < 6; i++) a.rerender();
    const b = renderHook(({ n }) => useSimulation(sim, { n }), { initialProps: { n: 0 } });
    for (let i = 1; i < 7; i++) b.rerender({ n: i });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
