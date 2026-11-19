import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineExplainer, precompute } from "../core";
import type { ExplainerDefinition, Simulation } from "../core";
import { Explainer, Predict, PredictToggle, Stage, useExplainer } from "../kit";
import type { ExplainerApi } from "../kit";

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

// Holds on frame 1; the right answer is "up" whenever there is a next frame.
const counting = defineExplainer({
  name: "counting",
  simulation: countSim,
  input: { default: 3 },
  predict: {
    at: (s) => s.i === 1,
    options: ["up", "down"],
    truth: (next) => (next ? "up" : undefined),
    hint: "Look again.",
  },
});

const plain = defineExplainer({ name: "plain", simulation: countSim, input: { default: 3 } });

let api: ExplainerApi<number, CountStep>;
function View() {
  const x = useExplainer<number, CountStep>();
  api = x;
  return <output data-testid="i">{x.step ? String(x.step.i) : "none"}</output>;
}

// The player's default delay is 900ms. One act per frame: the next timer
// is armed by an effect that runs as the act commits.
const tick = (frames = 1) => {
  for (let f = 0; f < frames; f++) {
    act(() => {
      vi.advanceTimersByTime(900);
    });
  }
};

function renderPredict(
  props: { predict?: boolean; definition?: ExplainerDefinition<number, CountStep>; input?: number } = {}
) {
  vi.useFakeTimers();
  const { definition = counting, ...rest } = props;
  return render(
    <Explainer definition={definition} view={View} link={false} autoPlay predict {...rest}>
      <Stage />
      <Predict>Up or down?</Predict>
      <PredictToggle>Predict</PredictToggle>
    </Explainer>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });
const button = (name: string) => screen.getByRole("button", { name });
const feedback = () => document.querySelector('[data-stepwise] [aria-live="polite"]')!;

describe("Predict", () => {
  it("holds autoplay at a matching frame only while enabled", () => {
    renderPredict();
    tick();
    expect(screen.getByTestId("i").textContent).toBe("1");
    expect(api.sim.player.held).toBe(1);
    expect(api.predict!.held).toBe(true);
    tick(3);
    // Still parked: the checkpoint waits for the reader.
    expect(screen.getByTestId("i").textContent).toBe("1");
    cleanup();

    renderPredict({ predict: false });
    expect(api.predict!.enabled).toBe(false);
    tick(3);
    expect(screen.getByTestId("i").textContent).toBe("2");
    expect(api.sim.player.held).toBeNull();
    expect(api.sim.player.ended).toBe(true);
  });

  it("renders the question from children and one radio per option", () => {
    renderPredict();
    tick();
    const group = screen.getByRole("radiogroup");
    expect(group.closest("[data-stepwise]")!.textContent).toContain("Up or down?");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Up", "Down"]);
    expect(radios.every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(radio("Down"));
    expect(radio("Down").getAttribute("aria-checked")).toBe("true");
    expect(radio("Up").getAttribute("aria-checked")).toBe("false");
    expect(api.predict!.guess).toBe("down");
    expect(api.predict!.options).toEqual([
      { value: "up", label: "Up" },
      { value: "down", label: "Down" },
    ]);
  });

  it("takes a paragraph as the question (as MDX writes it) without nesting <p> in <p>", () => {
    const error = vi.spyOn(console, "error");
    vi.useFakeTimers();
    const { container } = render(
      <Explainer definition={counting} view={View} link={false} autoPlay predict>
        <Stage />
        <Predict>
          <p>Up or down?</p>
        </Predict>
      </Explainer>
    );
    tick();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(container.textContent).toContain("Up or down?");
    expect(container.querySelector("p p")).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("at() sees the next step, so it can stop where something is about to change", () => {
    const seen: [number, number | undefined][] = [];
    const lookahead = defineExplainer({
      ...counting,
      input: { default: 4 },
      predict: {
        ...counting.predict!,
        at: (s: CountStep, frame: number, next?: CountStep) => {
          seen.push([frame, next?.i]);
          return next?.i === 2;
        },
      },
    });
    renderPredict({ definition: lookahead });
    tick();
    expect(screen.getByTestId("i").textContent).toBe("1");
    expect(api.sim.player.held).toBe(1);
    expect(seen).toContainEqual([1, 2]);
    expect(seen).toContainEqual([0, 1]);
  });

  it("does not hold on a checkpoint with no next frame; playback ends normally", () => {
    const atLast = defineExplainer({
      ...counting,
      predict: { ...counting.predict!, at: (s: CountStep) => s.i === 2 },
    });
    renderPredict({ definition: atLast });
    tick(3);
    expect(screen.getByTestId("i").textContent).toBe("2");
    expect(api.sim.player.held).toBeNull();
    expect(api.predict!.held).toBe(false);
    expect(api.sim.player.ended).toBe(true);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("uses the default question without children, and renders nothing unless held", () => {
    vi.useFakeTimers();
    render(
      <Explainer definition={counting} view={View} link={false} autoPlay predict>
        <Stage />
        <Predict />
      </Explainer>
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    tick();
    expect(screen.getByRole("radiogroup").parentElement!.textContent).toContain("What happens next?");
  });

  it("check without a guess fails with 'Pick an answer first.'", () => {
    renderPredict();
    tick();
    fireEvent.click(button("Check"));
    expect(api.predict!.status).toBe("fail");
    expect(feedback().textContent).toBe("Pick an answer first.");
    expect(api.predict!.attempts).toBe(1);
  });

  it("a right guess passes and shows Continue; Continue releases", () => {
    renderPredict();
    tick();
    expect(button("Skip")).toBeTruthy();
    fireEvent.click(radio("Up"));
    fireEvent.click(button("Check"));
    expect(api.predict!.status).toBe("pass");
    expect(feedback().textContent).toBe("Right.");
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(button("Continue"));
    expect(api.sim.player.held).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    tick();
    expect(screen.getByTestId("i").textContent).toBe("2");
  });

  it("a wrong guess fails and shows Skip; Skip releases", () => {
    renderPredict();
    tick();
    fireEvent.click(radio("Down"));
    fireEvent.click(button("Check"));
    expect(api.predict!.status).toBe("fail");
    expect(feedback().textContent).toBe("Not quite.");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    fireEvent.click(button("Skip"));
    expect(api.sim.player.held).toBeNull();
    tick();
    expect(screen.getByTestId("i").textContent).toBe("2");
  });

  it("uses the definition's feedback when it returns a string", () => {
    vi.useFakeTimers();
    const withFeedback = defineExplainer({
      ...counting,
      predict: { ...counting.predict!, feedback: (guess, truth, held) => `${guess} vs ${truth} at ${held.i}` },
    });
    renderPredict({ definition: withFeedback });
    tick();
    fireEvent.click(radio("Down"));
    fireEvent.click(button("Check"));
    expect(feedback().textContent).toBe("down vs up at 1");
  });

  it("shows the hint after two failed attempts", () => {
    renderPredict();
    tick();
    fireEvent.click(radio("Down"));
    fireEvent.click(button("Check"));
    expect(feedback().textContent).not.toContain("Look again.");
    fireEvent.click(button("Check"));
    expect(api.predict!.attempts).toBe(2);
    expect(feedback().textContent).toContain("Look again.");
    // A pass hides it again.
    fireEvent.click(radio("Up"));
    fireEvent.click(button("Check"));
    expect(feedback().textContent).toBe("Right.");
  });

  it("guess and verdict reset when a new frame is held", () => {
    const twice = defineExplainer({
      ...counting,
      predict: { ...counting.predict!, at: (s: CountStep) => s.i === 1 || s.i === 3 },
    });
    renderPredict({ definition: twice, input: 5 });
    tick();
    expect(api.sim.player.held).toBe(1);
    fireEvent.click(radio("Down"));
    fireEvent.click(button("Check"));
    expect(api.predict!.attempts).toBe(1);
    fireEvent.click(button("Skip"));
    tick(2);
    expect(api.sim.player.held).toBe(3);
    expect(api.predict!.guess).toBeNull();
    expect(api.predict!.status).toBeNull();
    expect(api.predict!.attempts).toBe(0);
    expect(radio("Down").getAttribute("aria-checked")).toBe("false");
    expect(feedback().textContent).toBe("");
  });

  it("disabling predict on a held frame releases it", () => {
    renderPredict();
    tick();
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(api.predict!.enabled).toBe(false);
    expect(api.sim.player.held).toBeNull();
    expect(api.sim.player.playing).toBe(true);
    tick();
    expect(screen.getByTestId("i").textContent).toBe("2");
  });

  it("manual next is never blocked", () => {
    renderPredict();
    tick();
    expect(api.sim.player.held).toBe(1);
    act(() => api.sim.player.next());
    expect(screen.getByTestId("i").textContent).toBe("2");
    expect(api.sim.player.held).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();

    // Replay to the checkpoint again; stepping back leaves it just as freely.
    act(() => api.sim.player.start());
    tick();
    expect(api.sim.player.held).toBe(1);
    act(() => api.sim.player.prev());
    expect(screen.getByTestId("i").textContent).toBe("0");
    expect(api.sim.player.held).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("an input edit while held drops the stale verdict", () => {
    renderPredict();
    tick();
    fireEvent.click(radio("Up"));
    fireEvent.click(button("Check"));
    expect(api.predict!.status).toBe("pass");
    // On 2 frames, k1 keeps its index but has no next frame: the truth changed.
    act(() => api.setInput(2));
    expect(api.sim.steps).toHaveLength(2);
    expect(api.sim.player.held).toBe(1);
    expect(api.predict!.status).toBeNull();
    expect(api.predict!.attempts).toBe(0);
    expect(api.predict!.guess).toBeNull();
    expect(feedback().textContent).toBe("");
  });

  it("Predict and PredictToggle render nothing without a predict definition", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Explainer definition={plain} view={View} link={false} autoPlay predict>
        <Stage />
        <Predict />
        <PredictToggle />
      </Explainer>
    );
    expect(api.predict).toBeNull();
    tick(3);
    expect(api.sim.player.ended).toBe(true);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(container.querySelector("section")!.children.length).toBe(1);
  });

  it("keeps the api's functions stable across frames", () => {
    renderPredict();
    const first = api.predict!;
    tick();
    const later = api.predict!;
    expect(later).not.toBe(first);
    for (const key of ["setEnabled", "setGuess", "check", "release"] as const) {
      expect(later[key]).toBe(first[key]);
    }
  });

  it("is in the default layout, and recorded-only explainers have no predict", () => {
    vi.useFakeTimers();
    render(<Explainer definition={counting} view={View} link={false} autoPlay predict />);
    tick();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    cleanup();
    render(<Explainer trace={precompute(counting)} view={View} link={false} predict />);
    expect(api.predict).toBeNull();
  });
});
