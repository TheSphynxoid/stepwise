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

  it("the input is not editable after the first answer under lock", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Explainer definition={counting} view={View} link={false} predict>
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
    render(<Explainer definition={counting} view={View} id="q" predict />);
    act(() => api.sim.player.next());
    act(() => api.sim.player.next());
    fireEvent.click(screen.getByRole("radio", { name: "Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(window.location.hash).toContain("q.a=up");
    expect(window.location.hash).toContain("q.frame=");
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

    // With `prompts`: the same options, answered through the prompts run.
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
    expect(choice("A").disabled).toBe(false);
    fireEvent.click(choice("Bee"));
    expect(choice("Bee").getAttribute("aria-pressed")).toBe("true");
    expect(seen!.walk!.choices).toEqual(["b"]);
    act(() => seen!.sim.player.next());
    expect(seen!.sim.step!.label).toBe("took b");
    expect(choice("A").disabled).toBe(true);
    // Walk defaults: re-answering is free (retries Infinity), and cuts off the old future.
    act(() => seen!.sim.player.prev());
    fireEvent.click(choice("A"));
    expect(seen!.walk!.choices).toEqual(["a"]);
    act(() => seen!.sim.player.next());
    expect(seen!.sim.step!.label).toBe("took a");
  });
});
