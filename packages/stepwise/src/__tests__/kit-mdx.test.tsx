// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
import { defineExplainer } from "../core";
import type { PrecomputedTrace } from "../core";
import { GlossaryAppendix, Term } from "../index";
import { EndNote, ExplainerBar, Narration, Predict, PredictToggle, Stage, StepCode } from "../kit";
import { precomputed, stepwiseComponents } from "../kit/mdx";

// Runs under node, not jsdom: `precomputed` is a server component, so it must
// work as a plain function call with no DOM and no hooks.

type CountStep = { key: string; tone: "neutral"; label: string; i: number };
type CountInput = { n: number; from: number };

function makeCount(name = "count") {
  const sim = vi.fn(function* ({ n, from }: CountInput) {
    for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `step ${i}`, i: from + i };
  });
  const def = defineExplainer({ name, simulation: sim, input: { default: { n: 3, from: 0 } } });
  return { sim, def };
}

type ClientProps = { trace?: PrecomputedTrace<CountInput, CountStep>; className?: string; n?: number; from?: number };
function Client(_props: ClientProps): ReactElement | null {
  return null;
}

/** Calls the wrapper the way a server renderer would and returns what it rendered. */
function renderOnce(el: ReactElement): { type: unknown; props: ClientProps } {
  const out = (el.type as (p: unknown) => ReactElement)(el.props);
  expect(isValidElement(out)).toBe(true);
  return out as { type: unknown; props: ClientProps };
}

describe("precomputed", () => {
  it("passes a trace for the default input", () => {
    const { def } = makeCount();
    const Wrapped = precomputed(def, Client);
    const out = renderOnce(<Wrapped />);
    expect(out.type).toBe(Client);
    expect(out.props.trace!.steps).toHaveLength(3);
    expect(out.props.trace!.input).toEqual({ n: 3, from: 0 });
  });

  it("passes a trace for overridden input fields and forwards the props", () => {
    const { def } = makeCount();
    const Wrapped = precomputed(def, Client);
    const out = renderOnce(<Wrapped n={5} from={10} className="hello" />);
    expect(out.props.trace!.input).toEqual({ n: 5, from: 10 });
    expect(out.props.trace!.steps.map((s) => s.i)).toEqual([10, 11, 12, 13, 14]);
    expect(out.props).toMatchObject({ n: 5, from: 10, className: "hello" });
  });

  it("never reads a reserved prop name as an input field", () => {
    const sim = vi.fn(function* ({ id, n }: { id: number; n: number }) {
      for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `${id}:${i}`, i };
    });
    const def = defineExplainer({ name: "reserved", simulation: sim, input: { default: { id: 1, n: 3 } } });
    const Wrapped = precomputed(def, Client as never);
    const out = renderOnce(<Wrapped id="a" />);
    // `id` is the hash namespace, forwarded as a prop; the input keeps its own id.
    expect(out.props.trace!.input).toEqual({ id: 1, n: 3 });
    expect((out.props as { id?: string }).id).toBe("a");
  });

  it("computes once per (definition, input, seed) across renders", () => {
    const { sim, def } = makeCount();
    const Wrapped = precomputed(def, Client);
    const traces = [0, 1, 2].map(() => renderOnce(<Wrapped n={4} />).props.trace);
    expect(sim).toHaveBeenCalledTimes(1);
    expect(traces[1]).toBe(traces[0]);
    expect(traces[2]).toBe(traces[0]);
    // A second wrapper over the same definition shares the cache.
    const Again = precomputed(def, Client);
    expect(renderOnce(<Again n={4} />).props.trace).toBe(traces[0]);
    expect(sim).toHaveBeenCalledTimes(1);
    // Another input is another run.
    renderOnce(<Wrapped n={2} />);
    expect(sim).toHaveBeenCalledTimes(2);
  });

  it("never serves one trace for inputs that only stringify alike", () => {
    const { sim, def } = makeCount("alike");
    const Wrapped = precomputed(def, Client);
    const asNull = renderOnce(<Wrapped n={null as never} />).props.trace!;
    expect(asNull.input).toEqual({ n: null, from: 0 });
    expect(sim).toHaveBeenCalledTimes(1);
    // NaN would key as null too: it is rejected before any lookup, and never run.
    expect(() => renderOnce(<Wrapped n={NaN} />)).toThrow(
      '[stepwise] precompute("alike"): input.n is not JSON-serializable (NaN)'
    );
    expect(sim).toHaveBeenCalledTimes(1);
  });

  it("does not share a trace between definitions that differ only in seed", () => {
    const { sim, def } = makeCount();
    const a = defineExplainer({ ...def, seed: 1 });
    const b = defineExplainer({ ...def, seed: 2 });
    const ta = renderOnce(createElement(precomputed(a, Client))).props.trace!;
    const tb = renderOnce(createElement(precomputed(b, Client))).props.trace!;
    expect(sim).toHaveBeenCalledTimes(2);
    expect(tb).not.toBe(ta);
    expect([ta.seed, tb.seed]).toEqual([1, 2]);
  });

  it("keeps at most 8 traces per definition", () => {
    const { sim, def } = makeCount();
    const Wrapped = precomputed(def, Client);
    for (let n = 1; n <= 9; n++) renderOnce(<Wrapped n={n} />);
    expect(sim).toHaveBeenCalledTimes(9);
    // n = 2..9 are the 8 kept: no rerun.
    for (let n = 2; n <= 9; n++) renderOnce(<Wrapped n={n} />);
    expect(sim).toHaveBeenCalledTimes(9);
    // n = 1 was the oldest and was evicted.
    renderOnce(<Wrapped n={1} />);
    expect(sim).toHaveBeenCalledTimes(10);
  });

  it("propagates precompute's error", () => {
    const boom = defineExplainer({
      name: "boom",
      simulation: function* (): Generator<CountStep> {
        throw new Error("nope");
      },
      input: { default: 0 },
    });
    const Wrapped = precomputed(boom, Client as never);
    expect(() => renderOnce(<Wrapped />)).toThrow('[stepwise] precompute("boom"): simulation threw: nope');
  });

  it("stepwiseComponents maps every listed name to a component", () => {
    expect(stepwiseComponents).toEqual({
      Term,
      GlossaryAppendix,
      Stage,
      Narration,
      StepCode,
      Predict,
      PredictToggle,
      ExplainerBar,
      EndNote,
    });
    for (const [name, component] of Object.entries(stepwiseComponents)) {
      expect(typeof component, name).toBe("function");
    }
  });
});
