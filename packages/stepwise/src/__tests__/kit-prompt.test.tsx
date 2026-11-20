import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineExplainer, precompute } from "../core";
import type { Simulation, WalkSimulation, WalkStep } from "../core";
import { Choices, Explainer, Prompt, PredictToggle, Stage, useExplainer } from "../kit";
import type { ExplainerApi } from "../kit";
import type { PromptsRun } from "../use-prompts";
import type { StepwiseStep } from "../types";

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

// Asks on frame 1: the right answer is "up" whenever there is a next frame.
const counting = defineExplainer({
  name: "counting",
  simulation: countSim,
  input: { default: 3, serialize: String, parse: (v: string) => (/^\d+$/.test(v) ? Number(v) : null) },
  predict: {
    at: (s) => s.i === 1,
    options: ["up", "down"],
    truth: (next) => (next ? "up" : undefined),
  },
});

let api: ExplainerApi<number, CountStep>;
function View() {
  const x = useExplainer<number, CountStep>();
  api = x;
  return <output data-testid="i">{x.step ? String(x.step.i) : "none"}</output>;
}


describe("Prompt part", () => {
  it("render prop receives the run", () => {
    const seen: PromptsRun<StepwiseStep, string>[] = [];
    render(
      <Explainer definition={counting} view={View} link={false} predict>
        <Stage />
        <Prompt
          render={(run) => {
            seen.push(run);
            return (
              <button type="button" onClick={() => run.respond("up")}>
                custom {run.active?.frame}
              </button>
            );
          }}
        />
      </Explainer>
    );
    // Off a prompt the render prop is not called.
    expect(screen.queryByRole("button", { name: /custom/ })).toBeNull();
    act(() => api.sim.player.next());
    expect(screen.getByTestId("i").textContent).toBe("1");
    expect(seen.at(-1)).toBe(api.prompts);
    fireEvent.click(screen.getByRole("button", { name: "custom 1" }));
    expect(api.prompts!.status).toBe("pass");
  });

  it("promptsEnabled forces prompts on with no toggle", () => {
    render(
      <Explainer definition={counting} view={View} link={false} promptsEnabled>
        <Stage />
        <Prompt />
        <PredictToggle />
      </Explainer>
    );
    expect(screen.queryByRole("switch")).toBeNull();
    expect(api.prompts!.enabled).toBe(true);
    act(() => api.prompts!.setEnabled(false));
    expect(api.prompts!.enabled).toBe(true);
    act(() => api.sim.player.next());
    act(() => api.sim.player.next());
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    cleanup();

    // Forced off: no question, and still no toggle.
    render(
      <Explainer definition={counting} view={View} link={false} promptsEnabled={false} predict>
        <Stage />
        <Prompt />
        <PredictToggle />
      </Explainer>
    );
    expect(screen.queryByRole("switch")).toBeNull();
    act(() => api.sim.player.next());
    expect(screen.getByTestId("i").textContent).toBe("1");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // Off, the prompt doesn't gate either.
    act(() => api.sim.player.next());
    expect(screen.getByTestId("i").textContent).toBe("2");
  });

  it("a predict explainer stays editable after an answer, and an edit clears the answers", () => {
    render(
      <Explainer definition={counting} view={View} link={false} predict>
        <Stage />
        <Prompt />
        <PredictToggle />
      </Explainer>
    );
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Down" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(api.prompts!.status).toBe("fail");
    expect(api.prompts!.inputLocked).toBe(false);
    expect(api.editable).toBe(true);
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    act(() => api.setInput(4));
    expect(api.sim.steps).toHaveLength(4);
    expect(api.prompts!.record.entries.some((e) => e.settled)).toBe(false);
    expect(api.prompts!.score.answered).toBe(0);
  });

  it("a definition that keeps the lock shows Start over, which unlocks", () => {
    const locking = defineExplainer({ ...counting, prompts: { onInputChange: "lock" } });
    render(
      <Explainer definition={locking} view={View} link={false} predict>
        <Stage />
        <Prompt />
      </Explainer>
    );
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(api.editable).toBe(false);
    // Off the prompt too: the way out stays on screen while the input is locked.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByTestId("i").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(api.editable).toBe(true);
    expect(screen.getByTestId("i").textContent).toBe("0");
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    act(() => api.setInput(5));
    expect(api.sim.steps).toHaveLength(5);
  });

  it("a free-text prompt without render draws no options, and warns once in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const free = defineExplainer({
      name: "free",
      simulation: countSim,
      input: { default: 3 },
      prompts: { ask: (s: CountStep) => (s.i === 1 ? {} : null) },
    });
    render(
      <Explainer definition={free} view={View} link={false}>
        <Stage />
        <Prompt />
      </Explainer>
    );
    act(() => api.sim.player.next());
    expect(api.prompts!.active?.frame).toBe(1);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    const calls = warn.mock.calls.filter((c) => String(c[0]).includes("render"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toMatch(/^\[stepwise\] Prompt/);
  });

  it("the input is not editable after the first answer under lock", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const locking = defineExplainer({ ...counting, prompts: { onInputChange: "lock" } });
    render(
      <Explainer definition={locking} view={View} link={false} predict>
        <Stage />
        <Prompt />
        <PredictToggle />
      </Explainer>
    );
    expect(api.editable).toBe(true);
    act(() => api.setInput(4));
    expect(api.sim.steps).toHaveLength(4);
    act(() => api.sim.player.next());
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Down" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(api.prompts!.inputLocked).toBe(true);
    expect(api.editable).toBe(false);
    // The toggle stays on screen, disabled: turning prompts off is the same escape.
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
    act(() => api.setInput(5));
    expect(api.sim.steps).toHaveLength(4);
    expect(warn).toHaveBeenCalledTimes(1);
    // restart() unlocks it.
    act(() => api.prompts!.restart());
    expect(api.editable).toBe(true);
    act(() => api.setInput(5));
    expect(api.sim.steps).toHaveLength(5);
  });

  it("links the answers under the explainer's id", () => {
    // A judged run links its answers only when the definition opts in.
    const linked = defineExplainer({ ...counting, prompts: { linkAnswers: true } });
    render(<Explainer definition={linked} view={View} id="q" predict />);
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(window.location.hash).toContain("q.a=up");
    expect(window.location.hash).toContain("q.frame=");
  });

  it("a predict quiz writes no answers to the link by default", () => {
    render(<Explainer definition={counting} view={View} id="q" predict />);
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    act(() => api.prompts!.proceed());
    expect(window.location.hash).toContain("q.frame=");
    expect(window.location.hash).not.toContain("q.a=");
  });

  it("recorded-only explainers have no prompts", () => {
    render(<Explainer trace={precompute(counting)} view={View} link={false} />);
    expect(api.prompts).toBeNull();
  });
});

type AB = "a" | "b";
type Fork = WalkStep & { key: string; tone: "neutral"; label: string };
const forkWalk: WalkSimulation<null, Fork, AB> = function* () {
  const c1 = yield { key: "start", tone: "neutral", label: "start", await: true };
  yield { key: `after.${c1}`, tone: "neutral", label: `took ${c1}` };
};
const forks = defineExplainer({ name: "forks", walk: forkWalk, choose: { options: ["a", { value: "b", label: "Bee" }] } });
const promptedForks = defineExplainer({ ...forks, prompts: {} });

function Blank() {
  return null;
}
const choice = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const narration = (c: HTMLElement) => c.querySelector('[aria-live="polite"]')!.textContent;

describe("Choices", () => {
  it("Choices still draws a walk's options", () => {
    // Without `prompts`: the walk runs on useWalk, a choice moves on at once.
    const r = render(<Explainer definition={forks} view={Blank} link={false} />);
    expect(choice("A").disabled).toBe(false);
    fireEvent.click(choice("Bee"));
    expect(narration(r.container)).toBe("took b");
    cleanup();

    // With `prompts`: Choices is Prompt, answered through the prompts run.
    let seen: ExplainerApi | null = null;
    function Spy() {
      seen = useExplainer();
      return null;
    }
    render(
      <Explainer definition={promptedForks} view={Blank} link={false}>
        <Spy />
        <Choices />
      </Explainer>
    );
    expect(seen!.prompts).not.toBeNull();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Bee" }));
    expect(screen.getByRole("radio", { name: "Bee" }).getAttribute("aria-checked")).toBe("true");
    expect(seen!.walk!.choices).toEqual(["b"]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(seen!.sim.step!.label).toBe("took b");
    // Off a prompt there is nothing to answer.
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // Walk defaults: re-answering is free (retries Infinity), and cuts off the old future.
    act(() => seen!.sim.player.prev());
    expect((screen.getByRole("radio", { name: "A" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(seen!.walk!.choices).toEqual(["a"]);
    act(() => seen!.sim.player.next());
    expect(seen!.sim.step!.label).toBe("took a");
  });
});

type Line = WalkStep & { key: string; tone: "neutral"; label: string };
const lineWalk: WalkSimulation<null, Line, AB> = function* () {
  const c = yield { key: "pick", tone: "neutral", label: "pick", await: true };
  yield { key: "quiz", tone: "neutral", label: `quiz ${c}` };
  yield { key: "end", tone: "neutral", label: "end" };
};
const quizWalk = defineExplainer({
  name: "quizWalk",
  walk: lineWalk,
  choose: { options: ["a", "b"] },
  prompts: { ask: (step: Line) => (step.key === "quiz" ? { options: ["x", "y"], answer: "x" } : null) },
});

describe("walk with prompts in the default layout", () => {
  it("asks a walk's overlay prompt: Next stays put until it is answered", () => {
    let seen: ExplainerApi | null = null;
    function Spy() {
      seen = useExplainer();
      return null;
    }
    render(<Explainer definition={quizWalk} view={Spy} link={false} />);
    const nextStep = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    // The generator's choice point, drawn by Prompt with the walk's options.
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    nextStep();
    expect(seen!.sim.step!.label).toBe("quiz a");
    // The overlay prompt gates.
    nextStep();
    expect(seen!.sim.step!.label).toBe("quiz a");
    fireEvent.click(screen.getByRole("radio", { name: "X" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(seen!.prompts!.status).toBe("pass");
    nextStep();
    expect(seen!.sim.step!.label).toBe("end");
  });

  it("links a walk's choices under its path key by default", () => {
    render(<Explainer definition={promptedForks} view={Blank} id="w" />);
    fireEvent.click(screen.getByRole("radio", { name: "Bee" }));
    expect(window.location.hash).toContain("w.path=b");
  });

  it("a linked path outside choose's option list is rejected", () => {
    let seen: ExplainerApi | null = null;
    function Spy() {
      seen = useExplainer();
      return null;
    }
    window.history.replaceState(null, "", "#w.path=zz&w.frame=1");
    render(<Explainer definition={promptedForks} view={Spy} id="w" />);
    expect(seen!.walk!.choices).toEqual([]);
    cleanup();
    window.history.replaceState(null, "", "#w.path=b&w.frame=1");
    render(<Explainer definition={promptedForks} view={Spy} id="w" />);
    expect(seen!.walk!.choices).toEqual(["b"]);
    expect(seen!.sim.step!.label).toBe("took b");
  });

  it("a linked path accepts a step's own prompt option outside choose's list", () => {
    const ownWalk: WalkSimulation<null, Fork, string> = function* () {
      const c = yield { key: "start", tone: "neutral", label: "start", prompt: { options: ["x", "y"] } };
      yield { key: `after.${c}`, tone: "neutral", label: `took ${c}` };
    };
    const own = defineExplainer({ name: "own", walk: ownWalk, choose: { options: ["a", "b"] }, prompts: {} });
    let seen: ExplainerApi | null = null;
    function Spy() {
      seen = useExplainer();
      return null;
    }
    window.history.replaceState(null, "", "#o.path=x&o.frame=1");
    render(<Explainer definition={own} view={Spy} id="o" />);
    expect(seen!.walk!.choices).toEqual(["x"]);
    expect(seen!.sim.step!.label).toBe("took x");
  });
});
