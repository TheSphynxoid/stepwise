import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { defineExplainer } from "../core";
import type { Simulation } from "../core";
import { Explainer, useExplainer } from "../kit";
import { __resetRegistryForTests } from "../kit/registry";

type CountStep = { key: string; tone: "neutral"; label: string; i: number };

const countSim: Simulation<number, CountStep> = function* (n) {
  for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral", label: `step ${i}`, i };
};
const count = defineExplainer({ name: "count", simulation: countSim, input: { default: 4 } });

// Each explainer prints its own frame, keyed by id, so a test can see which
// one a key reached.
function View() {
  const x = useExplainer<number, CountStep>();
  return <output data-testid={`i-${x.id ?? "solo"}`}>{x.step ? String(x.step.i) : "none"}</output>;
}

const frame = (id: string) => document.querySelector(`[data-testid="i-${id}"]`)!.textContent;
const press = (key: string) => fireEvent.keyDown(window, { key });

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetRegistryForTests();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("explainer keyboard routing", () => {
  it("with one explainer, arrows and space drive it", () => {
    render(<Explainer definition={count} view={View} link={false} />);
    press("ArrowRight");
    press("ArrowRight");
    expect(frame("solo")).toBe("2");
    press("ArrowLeft");
    expect(frame("solo")).toBe("1");
    // Space toggles playback: it starts the run (and must not scroll the page).
    const ev = new KeyboardEvent("keydown", { key: " ", cancelable: true, bubbles: true });
    act(() => void window.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true);
  });

  it("with two, keys go to the first until the second is interacted with", () => {
    render(
      <>
        <Explainer definition={count} view={View} id="a" />
        <Explainer definition={count} view={View} id="b" />
      </>
    );
    press("ArrowRight");
    expect(frame("a")).toBe("1");
    expect(frame("b")).toBe("0");
    const b = document.querySelector('[data-explainer="b"]')!;
    fireEvent.pointerDown(b);
    press("ArrowRight");
    expect(frame("a")).toBe("1");
    expect(frame("b")).toBe("1");
  });

  it("focus inside an explainer makes it active", () => {
    render(
      <>
        <Explainer definition={count} view={View} id="a" />
        <Explainer definition={count} view={View} id="b" />
      </>
    );
    const button = document.querySelector('[data-explainer="b"] button') as HTMLButtonElement;
    act(() => button.focus());
    // Keys typed on the focused button are ignored by useGlobalKeys, so send
    // them from the window as a reader's arrow press would arrive.
    press("ArrowRight");
    expect(frame("a")).toBe("0");
    expect(frame("b")).toBe("1");
  });

  it("keys={false} opts out", () => {
    render(<Explainer definition={count} view={View} link={false} keys={false} />);
    press("ArrowRight");
    expect(frame("solo")).toBe("0");
  });

  it("unmounting the active explainer hands keys to the first remaining one", () => {
    const tree = (ids: string[]) => (
      <>
        {ids.map((id) => (
          <Explainer key={id} definition={count} view={View} id={id} />
        ))}
      </>
    );
    const { rerender } = render(tree(["a", "b", "c"]));
    fireEvent.pointerDown(document.querySelector('[data-explainer="c"]')!);
    press("ArrowRight");
    expect(frame("c")).toBe("1");
    rerender(tree(["a", "b"]));
    press("ArrowRight");
    expect(frame("a")).toBe("1");
    expect(frame("b")).toBe("0");
  });

  it("two explainers sharing a hash namespace warn once in dev", () => {
    render(
      <>
        <Explainer definition={count} view={View} />
        <Explainer definition={count} view={View} />
        <Explainer definition={count} view={View} />
      </>
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[stepwise] Two explainers share the hash keys "frame" and "in". Give each an `id` prop.'
    );
  });

  it("distinct ids do not warn; link={false} explainers are not counted", () => {
    render(
      <>
        <Explainer definition={count} view={View} id="a" />
        <Explainer definition={count} view={View} id="b" />
        <Explainer definition={count} view={View} link={false} />
        <Explainer definition={count} view={View} link={false} />
      </>
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
