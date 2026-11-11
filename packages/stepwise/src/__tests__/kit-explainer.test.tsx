import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineExplainer, precompute } from "../core";
import type { Simulation } from "../core";
import * as kit from "../kit";
import { Explainer, ExplainerBar, Narration, Stage, createExplainer, useExplainer } from "../kit";
import type { ExplainerApi } from "../kit";
import type { ReactElement } from "react";
import { precomputed } from "../kit/server";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
});

type CountStep = { key: string; tone: "neutral"; label: string; i: number };

const countSim: Simulation<number, CountStep> = function* (n) {
  for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral", label: `step ${i}`, i };
};

const count = defineExplainer({
  name: "count",
  simulation: countSim,
  input: {
    default: 3,
    serialize: String,
    parse: (v: string) => (/^\d+$/.test(v) ? Number(v) : null),
  },
});

// The view under test: prints the frame's `i` and edits the input. It also
// hands the api out, so tests can drive the player directly.
let api: ExplainerApi<number, CountStep>;
function View() {
  const x = useExplainer<number, CountStep>();
  api = x;
  return (
    <div>
      <output data-testid="i">{x.step ? String(x.step.i) : "none"}</output>
      <button type="button" onClick={() => x.setInput(5)}>
        edit
      </button>
    </div>
  );
}

const Count = createExplainer({ definition: count, view: View });

describe("Explainer", () => {
  it("renders the default layout: view, narration, player bar", () => {
    const { container } = render(<Explainer definition={count} view={View} />);
    const root = container.querySelector("section")!;
    expect(root.getAttribute("data-explainer")).toBe("");
    expect(screen.getByTestId("i").textContent).toBe("0");
    const narration = root.querySelector('[aria-live="polite"]')!;
    expect(narration.textContent).toBe("step 0");
    expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
    expect(root.textContent).toContain("0/3");
    // Order: the view comes first, the player bar after the narration.
    const stage = screen.getByTestId("i");
    const bar = screen.getByRole("button", { name: "Next step" });
    expect(stage.compareDocumentPosition(narration) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(narration.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("children replace the default layout", () => {
    const { container } = render(
      <Explainer definition={count} view={View}>
        <Stage />
        <ExplainerBar />
      </Explainer>
    );
    expect(screen.getByTestId("i").textContent).toBe("0");
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
  });

  it("useExplainer outside a provider throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<View />)).toThrow(
      "useExplainer must be used inside <Explainer> (or a component made by createExplainer)."
    );
  });

  it("setInput recomputes and keeps the playhead by key", () => {
    render(<Explainer definition={count} view={View} link={false} />);
    act(() => api.sim.player.seek(2));
    expect(screen.getByTestId("i").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(api.input).toBe(5);
    expect(api.sim.steps).toHaveLength(5);
    expect(api.sim.frame).toBe(2);
    expect(screen.getByTestId("i").textContent).toBe("2");
    expect(api.editable).toBe(true);
    expect(api.predict).toBeNull();
  });

  it("setInput is stable across renders", () => {
    render(<Explainer definition={count} view={View} link={false} />);
    const first = api.setInput;
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(api.setInput).toBe(first);
  });

  it("starts from a matching trace without running the simulation", () => {
    const sim = vi.fn(countSim);
    const def = defineExplainer({ ...count, simulation: sim });
    const trace = precompute(def);
    sim.mockClear();
    render(<Explainer definition={def} view={View} trace={trace} />);
    expect(sim).not.toHaveBeenCalled();
    expect(api.sim.steps).toBe(trace.steps);
    expect(screen.getByTestId("i").textContent).toBe("0");
  });

  it("writes frame and input under plain keys without an id", () => {
    render(<Explainer definition={count} view={View} />);
    expect(window.location.hash).toBe("");
    // Before start the screen shows frame 0, so the first next() lands on 1.
    act(() => api.sim.player.next());
    expect(api.sim.frame).toBe(1);
    expect(window.location.hash).toBe("#frame=1");
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(window.location.hash).toBe("#frame=1&in=5");
  });

  it("namespaces hash keys with an id", () => {
    const { container } = render(<Explainer definition={count} view={View} id="a" />);
    expect(container.querySelector("section")!.getAttribute("data-explainer")).toBe("a");
    act(() => api.sim.player.seek(1));
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(window.location.hash).toBe("#a.frame=1&a.in=5");
    expect(api.id).toBe("a");
  });

  it("link={false} writes nothing to the hash", () => {
    render(<Explainer definition={count} view={View} link={false} />);
    act(() => api.sim.player.seek(1));
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(window.location.hash).toBe("");
  });

  it("link={false} ignores a linked frame and input", () => {
    window.history.replaceState(null, "", "#in=6&frame=2");
    render(<Explainer definition={count} view={View} link={false} />);
    expect(api.input).toBe(3);
    expect(api.sim.frame).toBe(0);
    expect(api.sim.player.index).toBe(-1);
  });

  it("a linked input that differs from the trace recomputes, and the linked frame lands on the new trace", () => {
    window.history.replaceState(null, "", "#in=6&frame=5");
    render(<Explainer definition={count} view={View} trace={precompute(count, 3)} />);
    expect(api.input).toBe(6);
    expect(api.sim.steps).toHaveLength(6);
    expect(api.sim.frame).toBe(5);
    expect(screen.getByTestId("i").textContent).toBe("5");
    expect(window.location.hash).toBe("#in=6&frame=5");
  });

  it("a linked input that fails parse falls back to the default", () => {
    window.history.replaceState(null, "", "#in=banana");
    render(<Explainer definition={count} view={View} />);
    expect(api.input).toBe(3);
    expect(api.sim.steps).toHaveLength(3);
    expect(window.location.hash).toBe("#in=banana");
  });

  it("input props are read once: a new equal literal per render neither recomputes nor resets edits", () => {
    const sim = vi.fn(function* ({ n }: { n: number }) {
      for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `step ${i}`, i };
    });
    const def = defineExplainer({ simulation: sim, input: { default: { n: 2 } } });
    let objApi!: ExplainerApi<{ n: number }, CountStep>;
    function ObjView() {
      objApi = useExplainer<{ n: number }, CountStep>();
      return null;
    }
    const { rerender } = render(<Explainer definition={def} view={ObjView} input={{ n: 3 }} link={false} />);
    expect(objApi.sim.steps).toHaveLength(3);
    expect(sim).toHaveBeenCalledTimes(1);
    rerender(<Explainer definition={def} view={ObjView} input={{ n: 3 }} link={false} />);
    rerender(<Explainer definition={def} view={ObjView} input={{ n: 3 }} link={false} />);
    expect(sim).toHaveBeenCalledTimes(1);
    act(() => objApi.setInput({ n: 4 }));
    expect(sim).toHaveBeenCalledTimes(2);
    rerender(<Explainer definition={def} view={ObjView} input={{ n: 3 }} link={false} />);
    expect(objApi.input).toEqual({ n: 4 });
    expect(objApi.sim.steps).toHaveLength(4);
    expect(sim).toHaveBeenCalledTimes(2);
  });

  it("recorded-only: plays the trace, editable is false, setInput is a no-op", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Recorded = createExplainer<number, CountStep>({ view: View });
    const trace = precompute(count, 4);
    render(<Recorded trace={trace} link={false} />);
    expect(api.editable).toBe(false);
    expect(api.input).toBe(4);
    expect(api.sim.steps).toBe(trace.steps);
    act(() => api.sim.player.seek(3));
    expect(screen.getByTestId("i").textContent).toBe("3");
    const before = api.sim.steps;
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(api.input).toBe(4);
    expect(api.sim.steps).toBe(before);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("setInput");
  });

  it("recorded-only links the frame only", () => {
    const Recorded = createExplainer<number, CountStep>({ view: View });
    render(<Recorded trace={precompute(count, 4)} id="r" />);
    act(() => api.sim.player.seek(2));
    expect(window.location.hash).toBe("#r.frame=2");
  });

  it("recorded-only without a trace throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Recorded = createExplainer<number, CountStep>({ view: View });
    expect(() => render(<Recorded />)).toThrow("createExplainer without a definition needs a `trace` prop.");
  });

  it("renders its shell for an empty trace", () => {
    const Recorded = createExplainer<number, CountStep>({ view: View });
    const { container } = render(<Recorded trace={{ input: 0, seed: 0, steps: [] }} />);
    expect(container.querySelector("section")).toBeTruthy();
    expect(screen.getByTestId("i").textContent).toBe("none");
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe("");
    expect(container.textContent).toContain("—");
  });

  it("createExplainer forwards input field props", () => {
    const sim: Simulation<{ n: number }, CountStep> = function* ({ n }) {
      for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral", label: `step ${i}`, i };
    };
    const Obj = createExplainer({
      definition: defineExplainer({ simulation: sim, input: { default: { n: 3 } } }),
      view: View,
    });
    render(<Obj n={5} link={false} />);
    expect(api.sim.steps).toHaveLength(5);
    expect((api as unknown as ExplainerApi<{ n: number }, CountStep>).input).toEqual({ n: 5 });
  });

  it("known props are not read as input fields", () => {
    const sim: Simulation<{ id: string }, CountStep> = function* ({ id }) {
      yield { key: "a", tone: "neutral", label: id, i: 0 };
    };
    const Obj = createExplainer({
      definition: defineExplainer({ simulation: sim, input: { default: { id: "default" } } }),
      view: View,
    });
    render(<Obj id="ns" link={false} />);
    expect(screen.getByText("default", { selector: "[aria-live]" })).toBeTruthy();
  });

  it("a reserved prop name is not an input field, so server and client resolve the same input", () => {
    const sim = vi.fn(function* ({ id, n }: { id: number; n: number }) {
      for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `${id}:${i}`, i };
    });
    const def = defineExplainer({ name: "reserved", simulation: sim, input: { default: { id: 1, n: 3 } } });
    const Client = createExplainer({ definition: def, view: View });

    // Client path alone: `id` is the namespace, the input keeps id 1.
    render(<Client id="a" link={false} />);
    expect((api as unknown as ExplainerApi<{ id: number; n: number }, CountStep>).input).toEqual({ id: 1, n: 3 });
    cleanup();

    // Server path: the wrapper precomputes once; the client starts from that
    // trace and does not run the simulation again.
    const Wrapped = precomputed(def, Client);
    sim.mockClear();
    const out = (Wrapped as (p: object) => ReactElement)({ id: "a", link: false });
    expect(sim).toHaveBeenCalledTimes(1);
    render(out);
    expect(sim).toHaveBeenCalledTimes(1);
    expect((api as unknown as ExplainerApi<{ id: number; n: number }, CountStep>).input).toEqual({ id: 1, n: 3 });
    expect(api.sim.steps).toBe((out.props as { trace: { steps: unknown } }).trace.steps);
  });

  it("every root carries data-stepwise", () => {
    const withCode = defineExplainer({
      simulation: function* (n: number) {
        for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `s${i}`, i, code: ["x = 1"] };
      },
      input: { default: 2 },
    });
    const { container } = render(<Explainer definition={withCode} view={View} />);
    const section = container.querySelector("section")!;
    expect(section.hasAttribute("data-stepwise")).toBe(true);
    // Every direct child of the shell is a part root.
    expect(section.children.length).toBeGreaterThanOrEqual(4);
    for (const child of Array.from(section.children)) {
      expect(child.hasAttribute("data-stepwise"), child.outerHTML.slice(0, 80)).toBe(true);
    }
    expect(container.textContent).toContain("x = 1");
  });

  it("StepCode renders nothing without code; Narration takes a className", () => {
    const { container } = render(
      <Explainer definition={count} view={View}>
        <Narration className="custom" />
        <kit.StepCode />
      </Explainer>
    );
    const section = container.querySelector("section")!;
    expect(section.children).toHaveLength(1);
    expect(section.children[0].className).toContain("custom");
  });

  it("EndNote takes paragraph children (as MDX writes them) without nesting <p> in <p>", () => {
    const error = vi.spyOn(console, "error");
    vi.useFakeTimers();
    const { container } = render(
      <Explainer definition={count} view={View} link={false} autoPlay>
        <Stage />
        <kit.EndNote>
          <p>Done.</p>
        </kit.EndNote>
      </Explainer>
    );
    // One act per frame: the next timer is armed as each act commits.
    for (let f = 0; f < 3; f++) act(() => void vi.advanceTimersByTime(900));
    expect(api.sim.player.ended).toBe(true);
    expect(container.textContent).toContain("Done.");
    expect(container.querySelector("p p")).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("a throwing simulation surfaces `error` and logs it once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = defineExplainer({
      name: "boom",
      simulation: function* (n: number): Generator<CountStep> {
        yield { key: "k0", tone: "neutral", label: "step 0", i: 0 };
        if (n > 0) throw new Error("bad input");
      },
      input: { default: 1 },
    });
    render(<Explainer definition={boom} view={View} link={false} />);
    expect(api.error).toBeInstanceOf(Error);
    expect((api.error as Error).message).toBe("bad input");
    expect(api.truncated).toBe(false);
    // A rerender with the same error does not log again.
    act(() => api.sim.player.next());
    const logged = error.mock.calls.filter((c) => String(c[0]).startsWith("[stepwise]"));
    expect(logged).toHaveLength(1);
    expect(logged[0][0]).toBe("[stepwise] boom: the simulation threw: bad input");
  });

  it("truncated is exposed; a recorded explainer has error null and truncated false", () => {
    const capped = defineExplainer({ ...count, maxSteps: 2 });
    render(<Explainer definition={capped} view={View} link={false} />);
    expect(api.truncated).toBe(true);
    expect(api.error).toBeNull();
    cleanup();
    const Recorded = createExplainer<number, CountStep>({ view: View });
    render(<Recorded trace={precompute(count, 4)} link={false} />);
    expect(api.error).toBeNull();
    expect(api.truncated).toBe(false);
  });

  it("the kit barrel exports every runtime entry point", () => {
    const expected = ["Explainer", "useExplainer", "createExplainer", "Stage", "Narration", "StepCode", "ExplainerBar", "EndNote"];
    expect(expected.filter((n) => !(n in kit))).toEqual([]);
  });
});
