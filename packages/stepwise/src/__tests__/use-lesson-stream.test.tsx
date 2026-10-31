import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { useFadeIn, useLessonStream } from "../use-lesson-stream";
import type { LessonStream, LessonStreamOptions } from "../use-lesson-stream";

// Virtual page: lesson i occupies [i*1000, (i+1)*1000) in document space,
// viewed through `scrollY`. jsdom innerHeight is 768 → center y = 384.
let scrollY = 0;
const scrollBy = vi.fn();
const scrollIntoView = vi.fn();

function Harness({ count, opts, out }: { count: number; opts?: LessonStreamOptions; out: { current?: LessonStream } }) {
  const stream = useLessonStream(count, opts);
  out.current = stream;
  return (
    <div>
      {stream.mounted.map((i) => (
        <section key={i} data-i={i} ref={stream.refFor(i)} />
      ))}
    </div>
  );
}

async function scrollTo(y: number) {
  scrollY = y;
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 30));
  });
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: HTMLElement) {
      const i = Number(this.dataset.i);
      const top = i * 1000 - scrollY;
      return { top, bottom: top + 1000, height: 1000, left: 0, right: 800, width: 800, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    },
  });
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }
});

beforeEach(() => {
  scrollBy.mockClear();
  scrollIntoView.mockClear();
});
afterEach(cleanup);
afterAll(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("useLessonStream", () => {
  it("mounts a window around the seed and lands on it before paint", () => {
    scrollY = 2000;
    const out: { current?: LessonStream } = {};
    render(<Harness count={6} opts={{ seed: 2 }} out={out} />);
    expect(out.current!.mounted).toEqual([1, 2, 3]);
    expect(out.current!.active).toBe(2);
    expect(out.current!.seed).toBe(2);
    expect(out.current!.complete).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("tracks the lesson containing the viewport center and reports changes", async () => {
    scrollY = 2000;
    const onActiveChange = vi.fn();
    const out: { current?: LessonStream } = {};
    render(<Harness count={6} opts={{ seed: 2, onActiveChange }} out={out} />);
    expect(onActiveChange).not.toHaveBeenCalled();
    await scrollTo(2700); // center at 3084 → lesson 3
    expect(out.current!.active).toBe(3);
    expect(onActiveChange).toHaveBeenLastCalledWith(3);
  });

  it("loads the next lesson on approach, without compensating", async () => {
    scrollY = 2000;
    const out: { current?: LessonStream } = {};
    render(<Harness count={6} opts={{ seed: 2 }} out={out} />);
    await scrollTo(2500); // lesson 3 bottom 1500 → 732px below the fold: not yet
    expect(out.current!.mounted).toEqual([1, 2, 3]);
    await scrollTo(2700); // 532px < 600 → load lesson 4
    expect(out.current!.mounted).toEqual([1, 2, 3, 4]);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("prepends the previous lesson near the top and compensates by its height", async () => {
    scrollY = 2000;
    const out: { current?: LessonStream } = {};
    render(<Harness count={6} opts={{ seed: 2 }} out={out} />);
    await scrollTo(1200); // lesson 1 top at -200 > -300 → load lesson 0
    expect(out.current!.mounted[0]).toBe(0);
    expect(scrollBy).toHaveBeenCalledWith({ top: 1000, behavior: "auto" });
  });

  it("goTo expands the window without compensation and scrolls to the target", async () => {
    scrollY = 2000;
    const out: { current?: LessonStream } = {};
    render(<Harness count={6} opts={{ seed: 2 }} out={out} />);
    scrollIntoView.mockClear();
    act(() => out.current!.goTo(5));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50)); // the post-commit animation frame
    });
    expect(out.current!.mounted).toEqual([1, 2, 3, 4, 5]);
    expect(out.current!.complete).toBe(true);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("returns stable callbacks", async () => {
    scrollY = 0;
    const out: { current?: LessonStream } = {};
    const { rerender } = render(<Harness count={3} out={out} />);
    const { goTo, next, prev, refFor } = out.current!;
    const ref0 = refFor(0);
    rerender(<Harness count={3} out={out} />);
    expect(out.current!.goTo).toBe(goTo);
    expect(out.current!.next).toBe(next);
    expect(out.current!.prev).toBe(prev);
    expect(out.current!.refFor(0)).toBe(ref0);
  });

  it("is empty-safe", () => {
    const out: { current?: LessonStream } = {};
    render(<Harness count={0} out={out} />);
    expect(out.current!.mounted).toEqual([]);
    expect(out.current!.active).toBe(-1);
    expect(out.current!.complete).toBe(false);
    act(() => out.current!.goTo(3));
  });
});

describe("useFadeIn", () => {
  it("starts hidden and shows a frame later", async () => {
    const { result } = renderHook(() => useFadeIn());
    expect(result.current).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(result.current).toBe(true);
  });

  it("initially visible blocks never flash", () => {
    const { result } = renderHook(() => useFadeIn(true));
    expect(result.current).toBe(true);
  });
});
