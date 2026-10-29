import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useChapters } from "../use-chapters";
import type { Chapter } from "../types";

const CHAPTERS: Chapter[] = [
  { id: "intro", label: "Intro" },
  { id: "middle", label: "Middle" },
  { id: "outro", label: "Outro" },
];

interface Rect {
  top: number;
  bottom: number;
}

const rects = new Map<string, Rect>();
const scrollIntoViewMock = vi.fn();

function setRect(id: string, top: number, bottom: number) {
  rects.set(id, { top, bottom });
}

// jsdom innerHeight is 768, so the tracked point is y = 384.
async function flushScroll() {
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

beforeAll(() => {
  document.body.innerHTML =
    '<div id="intro"></div><div id="middle"></div><div id="outro"></div>';
  for (const id of ["intro", "middle", "outro"]) {
    const el = document.getElementById(id)!;
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const r = rects.get(id) ?? { top: 0, bottom: 0 };
        return {
          top: r.top,
          bottom: r.bottom,
          left: 0,
          right: 800,
          width: 800,
          height: r.bottom - r.top,
          x: 0,
          y: r.top,
          toJSON: () => ({}),
        } as DOMRect;
      },
    });
  }
  Element.prototype.scrollIntoView =
    scrollIntoViewMock as unknown as typeof Element.prototype.scrollIntoView;

  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(cleanup);
afterAll(() => {
  document.body.innerHTML = "";
});

describe("useChapters", () => {
  beforeEach(() => scrollIntoViewMock.mockClear());

  it("starts on the section containing the viewport center", () => {
    setRect("intro", -100, 400); // contains y=384
    setRect("middle", 400, 1200);
    setRect("outro", 1200, 2000);
    const { result } = renderHook(() => useChapters(CHAPTERS));
    expect(result.current.active).toBe(0);
  });

  it("scroll updates the active chapter via center containment", async () => {
    setRect("intro", -100, 400);
    setRect("middle", 400, 1200);
    setRect("outro", 1200, 2000);
    const { result } = renderHook(() => useChapters(CHAPTERS));
    expect(result.current.active).toBe(0);

    setRect("intro", -600, 200);
    setRect("middle", 200, 1300); // now contains y=384
    setRect("outro", 1300, 2200);
    await flushScroll();
    expect(result.current.active).toBe(1);
  });

  it("falls back to the deepest section above center when none contains it", () => {
    setRect("intro", -2000, -1500);
    setRect("middle", 4000, 5000);
    setRect("outro", -500, 200); // deepest top above y=384
    const { result } = renderHook(() => useChapters(CHAPTERS));
    expect(result.current.active).toBe(2);
  });

  it("goTo scrolls to the chapter and activates it immediately", () => {
    setRect("intro", -100, 400);
    setRect("middle", 400, 1200);
    setRect("outro", 1200, 2000);
    const { result } = renderHook(() => useChapters(CHAPTERS));
    scrollIntoViewMock.mockClear();
    act(() => result.current.goTo(2));
    expect(result.current.active).toBe(2);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock.mock.contexts[0]).toBe(document.getElementById("outro"));
  });

  it("goTo ignores out-of-range indices", () => {
    setRect("intro", -100, 400);
    setRect("middle", 400, 1200);
    setRect("outro", 1200, 2000);
    const { result } = renderHook(() => useChapters(CHAPTERS));
    act(() => result.current.goTo(9));
    expect(result.current.active).toBe(0);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("next/prev respect bounds and delegate to goTo", () => {
    setRect("intro", -100, 400);
    setRect("middle", 400, 1200);
    setRect("outro", 1200, 2000);
    const { result } = renderHook(() => useChapters(CHAPTERS));
    scrollIntoViewMock.mockClear();
    act(() => result.current.prev());
    expect(result.current.active).toBe(0);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    act(() => result.current.next());
    expect(result.current.active).toBe(1);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });
});
