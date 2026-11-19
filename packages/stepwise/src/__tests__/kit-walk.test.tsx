import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineExplainer, precompute } from "../core";
import type { WalkSimulation, WalkStep } from "../core";
import { Choices, EndNote, Explainer, ExplainerBar, Narration, StepCode, StepParts, useExplainer } from "../kit";
import { useTrace } from "../use-trace";
import { PlayerBar } from "../components";
import { precomputed } from "../kit/mdx";
import { createExplainer } from "../kit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
});

// ─── StepParts: the step parts around a plain player ─────────────────────────

type Plain = { tone: "neutral"; label: string; code?: string[] };
const PLAIN: Plain[] = [
  { tone: "neutral", label: "first", code: ["let a = 1;"] },
  { tone: "neutral", label: "second" },
];

function PlainPage() {
  const trace = useTrace(PLAIN);
  return (
    <StepParts source={trace}>
      <Narration />
      <StepCode />
      <ExplainerBar />
      <EndNote />
    </StepParts>
  );
}

describe("StepParts", () => {
  it("runs the step parts around a useTrace player", () => {
    const { container } = render(<PlainPage />);
    const narration = container.querySelector('[aria-live="polite"]')!;
    expect(narration.textContent).toBe("first");
    expect(container.textContent).toContain("let a = 1;");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(narration.textContent).toBe("second");
    // The second step has no code.
    expect(container.textContent).not.toContain("let a = 1;");
  });

  it("a part outside both providers says where it belongs", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Narration />)).toThrow("must be inside <Explainer> or <StepParts>");
  });
});

// ─── Walk explainers ─────────────────────────────────────────────────────────

type AB = "a" | "b";
type Fork = WalkStep & { key: string; tone: "neutral"; label: string };

let runs = 0;
const forkWalk: WalkSimulation<null, Fork, AB> = function* () {
  runs++;
  const c1 = yield { key: "start", tone: "neutral", label: "start", await: true };
  yield { key: `after.${c1}`, tone: "neutral", label: `took ${c1}` };
  const c2 = yield { key: `fork2.${c1}`, tone: "neutral", label: "second fork", await: true };
  yield { key: `end.${c1}.${c2}`, tone: "neutral", label: `end ${c1} ${c2}` };
};

const forks = defineExplainer({
  name: "forks",
  walk: forkWalk,
  choose: { options: ["a", { value: "b", label: "Bee" }] },
});

function Blank() {
  return null;
}

const narration = (c: HTMLElement) => c.querySelector('[aria-live="polite"]')!.textContent;
const choice = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("walk explainer", () => {
  it("defaults the input to null and keeps the walk", () => {
    expect(forks.input.default).toBeNull();
    expect(forks.walk).toBe(forkWalk);
    expect(Object.isFrozen(forks)).toBe(true);
  });

  it("asks at a choice point, moves past it on a choice, and disables the choices off one", () => {
    const { container } = render(<Explainer definition={forks} view={Blank} link={false} />);
    expect(narration(container)).toBe("start");
    expect(screen.getByRole("group", { name: "Choose" })).toBeTruthy();
    expect(choice("A").disabled).toBe(false);
    expect(choice("Bee").disabled).toBe(false);

    fireEvent.click(choice("A"));
    expect(narration(container)).toBe("took a");
    expect(choice("A").disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(narration(container)).toBe("second fork");
    fireEvent.click(choice("Bee"));
    expect(narration(container)).toBe("end a b");

    // Back on the first choice point, the answer given there is pressed.
    act(() => {
      for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    });
    expect(narration(container)).toBe("start");
    expect(choice("A").getAttribute("aria-pressed")).toBe("true");
    expect(choice("Bee").getAttribute("aria-pressed")).toBe("false");
  });

  it("exposes the walk to custom parts, and null for a simulation", () => {
    let seen: ReturnType<typeof useExplainer>["walk"] = null;
    function Spy() {
      seen = useExplainer().walk;
      return null;
    }
    render(
      <Explainer definition={forks} view={Blank} link={false}>
        <Spy />
      </Explainer>
    );
    expect(seen).not.toBeNull();
    expect(seen!.asking).toBe(true);
    expect(seen!.awaiting).toBe(true);
    expect(seen!.options).toEqual([
      { value: "a", label: "A" },
      { value: "b", label: "Bee" },
    ]);
    act(() => seen!.choose("b"));
    expect(seen!.choices).toEqual(["b"]);
    expect(seen!.choiceAt(0)).toBe("b");
  });

  it("writes the choices to the link and restores them, then the frame", () => {
    render(<Explainer definition={forks} view={Blank} id="w" />);
    fireEvent.click(choice("Bee"));
    expect(window.location.hash).toContain("w.path=b");
    cleanup();

    window.history.replaceState(null, "", "#w.frame=3&w.path=a.b");
    const { container } = render(<Explainer definition={forks} view={Blank} id="w" />);
    expect(narration(container)).toBe("end a b");
  });

  it("restores a link pasted into the same tab", () => {
    const { container } = render(<Explainer definition={forks} view={Blank} id="w" />);
    act(() => {
      window.history.replaceState(null, "", "#w.frame=1&w.path=b");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(narration(container)).toBe("took b");
  });

  it("ignores a linked choice that isn't an option", () => {
    window.history.replaceState(null, "", "#w.path=zz");
    const { container } = render(<Explainer definition={forks} view={Blank} id="w" />);
    expect(narration(container)).toBe("start");
  });

  it("per-step options and a custom parse", () => {
    const perStep = defineExplainer({
      walk: forkWalk,
      choose: {
        options: (step: Fork) => (step.key === "start" ? ["a"] : ["a", "b"]),
        parse: (v: string) => (v === "a" || v === "b" ? v : null),
      },
    });
    render(<Explainer definition={perStep} view={Blank} link={false} />);
    expect(screen.queryByRole("button", { name: "B" })).toBeNull();
    fireEvent.click(choice("A"));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(choice("B").disabled).toBe(false);
  });

  it("Choices renders nothing for a simulation", () => {
    const sim = defineExplainer({
      simulation: function* () {
        yield { tone: "neutral" as const, label: "only" };
      },
    });
    render(
      <Explainer definition={sim} view={Blank} link={false}>
        <Choices />
      </Explainer>
    );
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("plain JS that passes both a simulation and a walk is told at once", () => {
    const both = { simulation: function* () {}, walk: forkWalk, choose: { options: ["a"] } };
    expect(() => defineExplainer(both as never)).toThrow("a simulation or a walk, not both");
  });
});

describe("precompute (walk)", () => {
  it("replays the start, or a path of choices", () => {
    const start = precompute(forks);
    expect(start.steps.map((s) => s.key)).toEqual(["start"]);
    expect(start.choices).toEqual([]);
    const path = precompute(forks, null, ["a", "b"]);
    expect(path.steps.map((s) => s.key)).toEqual(["start", "after.a", "fork2.a", "end.a.b"]);
    expect(path.choices).toEqual(["a", "b"]);
    // Extra choices aren't kept: the walk ended before using them.
    expect(precompute(forks, null, ["a", "b", "a"]).choices).toEqual(["a", "b"]);
  });

  it("labels a walk that throws", () => {
    const boom = defineExplainer({
      name: "boom",
      walk: function* (): Generator<Fork, unknown, AB | undefined> {
        throw new Error("nope");
      },
      choose: { options: ["a"] },
    });
    expect(() => precompute(boom)).toThrow('[stepwise] precompute("boom"): simulation threw: nope');
  });

  it("a precomputed path plays without running the walk on the client", () => {
    const trace = precompute(forks, null, ["b"]);
    runs = 0;
    const { container } = render(<Explainer definition={forks} view={Blank} link={false} trace={trace} />);
    expect(runs).toBe(0);
    // It starts partway down the walk: the first answer is already given.
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(narration(container)).toBe("took b");
    // A new answer runs it for real.
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(narration(container)).toBe("start");
    fireEvent.click(choice("A"));
    expect(runs).toBeGreaterThan(0);
    expect(narration(container)).toBe("took a");
  });

  it("precomputed wraps a walk explainer like any other", () => {
    const Forks = createExplainer({ definition: forks, view: Blank });
    const Wrapped = precomputed(forks, Forks);
    runs = 0;
    const { container } = render(<Wrapped link={false} />);
    // The server-side run is the one counted; the client reuses it.
    expect(runs).toBe(1);
    expect(narration(container)).toBe("start");
  });
});

describe("step-only bar", () => {
  const buttons = (root: HTMLElement) =>
    Array.from(root.querySelectorAll("button, [role=slider]")).map(
      (el) => el.getAttribute("aria-label") ?? el.getAttribute("role") ?? el.textContent
    );

  it('PlayerBar controls="step": arrows on either side of the scrubber, no Play', () => {
    const player = { total: 3, index: 0, playing: false, atEnd: false, next: vi.fn(), prev: vi.fn(), toggle: vi.fn(), seek: vi.fn() };
    const { container } = render(<PlayerBar player={player} controls="step" />);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    const order = buttons(container);
    expect(order[0]).toBe("Previous step");
    expect(order[order.length - 1]).toBe("Next step");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(player.next).toHaveBeenCalled();
  });

  it("a walk explainer's bar defaults to the step layout; controls=\"full\" brings Play back", () => {
    render(<Explainer definition={forks} view={Blank} link={false} />);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    cleanup();
    render(
      <Explainer definition={forks} view={Blank} link={false}>
        <ExplainerBar controls="full" />
      </Explainer>
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("a simulation explainer keeps Play", () => {
    const sim = defineExplainer({
      simulation: function* () {
        yield { tone: "neutral" as const, label: "only" };
      },
    });
    render(<Explainer definition={sim} view={Blank} link={false} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("Space doesn't play a walk; the arrows still step it", () => {
    const { container } = render(<Explainer definition={forks} view={Blank} link={false} />);
    fireEvent.click(choice("A"));
    fireEvent.pointerDown(container.querySelector("section")!);
    const space = new KeyboardEvent("keydown", { key: " ", cancelable: true });
    act(() => void window.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(false);
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(narration(container)).toBe("second fork");
  });
});
