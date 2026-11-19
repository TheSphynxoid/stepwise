import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ChapterNav } from "../components";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const CHAPTERS = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, label: `Chapter ${i}` }));

/** A 200px-wide row; the active chip sits at `chipLeft` (80px wide), in viewport coordinates. */
function layout(chipLeft: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.getAttribute("aria-current") === "true") return { left: chipLeft, right: chipLeft + 80, width: 80 } as DOMRect;
    if (this.classList.contains("overflow-x-auto")) return { left: 0, right: 200, width: 200 } as DOMRect;
    return { left: 0, right: 0, width: 0 } as DOMRect;
  });
}

const row = (c: HTMLElement) => c.querySelector<HTMLElement>(".overflow-x-auto")!;

describe("ChapterNav", () => {
  it("scrolls the row (not the page) to center an active chapter that is out of view", () => {
    layout(500);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<ChapterNav chapters={CHAPTERS} active={9} onNavigate={() => {}} />);
    // 500 - 0 - (200 - 80) / 2
    expect(row(container).scrollLeft).toBe(440);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("leaves the row alone when the active chapter is already visible", () => {
    layout(20);
    const { container, rerender } = render(<ChapterNav chapters={CHAPTERS} active={0} onNavigate={() => {}} />);
    rerender(<ChapterNav chapters={CHAPTERS} active={1} onNavigate={() => {}} />);
    expect(row(container).scrollLeft).toBe(0);
  });
});
