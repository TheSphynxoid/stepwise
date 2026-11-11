import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, renderHook } from "@testing-library/react";
import type { PrecomputedTrace, Simulation } from "../core";
import { runSimulation } from "../core";
import { useSimulation } from "../use-simulation";
import type { StepwiseStep } from "../types";

afterEach(cleanup);

const gen = () =>
  vi.fn<Simulation<{ n: number }, StepwiseStep>>(function* ({ n }) {
    for (let i = 0; i < n; i++) yield { key: `s${i}`, tone: "neutral", label: `s${i}` };
  });

function traceFor(sim: Simulation<{ n: number }, StepwiseStep>, n: number, seed?: number) {
  const r = runSimulation(sim, { n }, { seed });
  return { input: { n }, seed: r.seed, steps: r.steps } satisfies PrecomputedTrace<{ n: number }, StepwiseStep>;
}

describe("useSimulation initialTrace", () => {
  it("does not run the simulation when input and seed match", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    sim.mockClear();
    const { result } = renderHook(() => useSimulation(sim, trace.input, { initialTrace: trace }));
    expect(sim).toHaveBeenCalledTimes(0);
    expect(result.current.steps).toBe(trace.steps);
    expect(result.current.truncated).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.seed).toBe(trace.seed);
  });

  it("matches by content, not identity", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    sim.mockClear();
    const { result } = renderHook(() => useSimulation(sim, { n: 3 }, { initialTrace: trace }));
    expect(sim).toHaveBeenCalledTimes(0);
    expect(result.current.steps).toBe(trace.steps);
  });

  it("runs the simulation when the input differs", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    sim.mockClear();
    const { result } = renderHook(() => useSimulation(sim, { n: 5 }, { initialTrace: trace }));
    expect(sim).toHaveBeenCalledTimes(1);
    expect(result.current.steps).toHaveLength(5);
  });

  it("runs the simulation when the seed differs", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    sim.mockClear();
    const { result } = renderHook(() => useSimulation(sim, trace.input, { initialTrace: trace, seed: 7 }));
    expect(sim).toHaveBeenCalledTimes(1);
    expect(result.current.seed).toBe(7);
  });

  it("recomputes after the input changes, then never returns to the trace by identity", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    sim.mockClear();
    const { result, rerender } = renderHook(({ input }) => useSimulation(sim, input, { initialTrace: trace }), {
      initialProps: { input: trace.input },
    });
    expect(sim).toHaveBeenCalledTimes(0);
    rerender({ input: { n: 4 } });
    expect(sim).toHaveBeenCalledTimes(1);
    expect(result.current.steps).toHaveLength(4);
    expect(result.current.steps).not.toBe(trace.steps);
  });

  it("first render is identical with and without a trace", () => {
    const sim = gen();
    const trace = traceFor(sim, 3);
    const Probe = ({ withTrace }: { withTrace: boolean }) => {
      const s = useSimulation(sim, trace.input, withTrace ? { initialTrace: trace } : undefined);
      return createElement("p", null, `${s.step?.label}/${s.steps.length}`);
    };
    const a = renderToString(createElement(Probe, { withTrace: true }));
    const b = renderToString(createElement(Probe, { withTrace: false }));
    expect(a).toBe(b);
    expect(a).toContain("s0/3");
  });
});
