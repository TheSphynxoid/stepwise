import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { TourCard, TourSpotlight } from "../components";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const step = { id: "a", title: "Hello", body: "Body", target: "t" };

describe("tour parts", () => {
  // Rendered in place, a transformed or filtered ancestor (backdrop-blur on a
  // sticky header) becomes the containing block of `position: fixed`.
  it("TourCard renders into <body>, not inside its parent", () => {
    const { container } = render(
      <header style={{ backdropFilter: "blur(4px)" }}>
        <TourCard step={step} index={0} total={2} onNext={() => {}} onBack={() => {}} onEnd={() => {}} />
      </header>
    );
    const card = document.querySelector('[role="dialog"]');
    expect(card).not.toBeNull();
    expect(container.contains(card)).toBe(false);
    expect(card!.parentElement).toBe(document.body);
  });

  it("TourCard takes focus once it is in the page", () => {
    render(<TourCard step={step} index={0} total={2} onNext={() => {}} onBack={() => {}} onEnd={() => {}} />);
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");
  });

  it("TourSpotlight renders into <body> and follows a target that was swapped out", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const box = (top: number) => ({ top, left: 10, width: 50, height: 20, right: 60, bottom: top + 20, x: 10, y: top, toJSON() {} }) as DOMRect;
    const first = document.createElement("div");
    first.id = "t";
    first.getBoundingClientRect = () => box(100);
    first.scrollIntoView = () => {};
    document.body.appendChild(first);

    const { container } = render(
      <div style={{ transform: "translateZ(0)" }}>
        <TourSpotlight target="t" />
      </div>
    );
    act(() => vi.advanceTimersByTime(50));
    const hole = () => document.querySelector<HTMLElement>("[data-stepwise] > div");
    expect(hole()).not.toBeNull();
    expect(container.contains(hole())).toBe(false);
    expect(hole()!.style.top).toBe("94px");

    // An HTMX-style swap: the old node leaves, a new one with the same id arrives.
    first.remove();
    const second = document.createElement("div");
    second.id = "t";
    second.getBoundingClientRect = () => box(300);
    second.scrollIntoView = () => {};
    document.body.appendChild(second);
    act(() => vi.advanceTimersByTime(50));
    expect(hole()!.style.top).toBe("294px");
  });
});
