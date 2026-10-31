"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSteps } from "./use-steps";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

// Layout effects run before paint and before rAF callbacks — what the prepend
// compensation and the seed landing need. No-op'd on the server (SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface LessonStreamOptions {
  /** Lesson to open on (deep link). Clamped. Default 0. */
  seed?: number;
  /** Lessons mounted on each side of the seed initially. Default 1. */
  radius?: number;
  /** Load the next lesson when the last mounted one's bottom is within this many px below the viewport. Default 600. */
  approachBelow?: number;
  /** Load the previous lesson when the first mounted one's top is below `-approachAbove`. Default 300. */
  approachAbove?: number;
  /** Scroll the seed lesson into view before first paint (seed > 0). Default true. */
  scrollToSeed?: boolean;
  /**
   * Fired when the scroll-tracked active lesson changes (not on mount) — sync
   * the URL / document title here. Read through a ref; inline is fine.
   */
  onActiveChange?: (index: number) => void;
}

export interface LessonStream {
  /** Lesson containing the viewport center (the seed until the first measure). */
  active: number;
  /** The seed lesson — SSR'd visible; every other block should fade in. */
  seed: number;
  /** Indices to render, in order (the mounted window). */
  mounted: number[];
  /** The window reaches the last lesson — render an end-of-stream footer. */
  complete: boolean;
  /** Stable callback ref for lesson `i`'s block element (cached per index). */
  refFor: (index: number) => (el: HTMLElement | null) => void;
  /** Mount through lesson `i` (if needed) and scroll to it. */
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  reducedMotion: boolean;
}

/**
 * Continuous reader for a sequence of lessons (a notebook): renders a growing
 * window of lessons around the seed instead of all of them, and tracks the
 * active one by viewport-center containment (invariant 1).
 *
 * - The lesson after the window mounts as the reader approaches its place;
 *   the one before mounts near the top, and a layout effect compensates the
 *   scroll so prepended content never shoves the reader down.
 * - Navigation (`goTo`) expansions are NOT compensated — their scrollIntoView
 *   is absolute, and compensating them displaced the landing.
 * - The cursor is a useSteps core, so it composes with ChapterNav
 *   (`active` + `goTo`) and LessonPager (`prev`/`next`).
 *
 * Headless: the consumer renders `mounted.map(i => <Block ref={refFor(i)} />)`
 * and owns the content; pair blocks with `useFadeIn(i === seed)`.
 */
export function useLessonStream(count: number, opts: LessonStreamOptions = {}): LessonStream {
  const { radius = 1, approachBelow = 600, approachAbove = 300, scrollToSeed = true } = opts;
  const last = count - 1;
  const seed = count === 0 ? -1 : Math.max(0, Math.min(opts.seed ?? 0, last));
  const reducedMotion = usePrefersReducedMotion();

  const core = useSteps(count, { initialIndex: Math.max(0, seed) });
  const coreGoRef = useRef(core.go);
  coreGoRef.current = core.go;
  const activeRef = useRef(core.index);
  activeRef.current = core.index;

  const [range, setRange] = useState(() => ({
    first: Math.max(0, seed - radius),
    last: Math.min(last, seed + radius),
  }));
  // Clamp to the live count (lessons may be removed).
  const first = Math.max(0, Math.min(range.first, last));
  const lastMounted = Math.min(range.last, last);
  const rangeRef = useRef({ first, last: lastMounted });
  rangeRef.current = { first, last: lastMounted };
  const countRef = useRef(count);
  countRef.current = count;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const onActiveRef = useRef(opts.onActiveChange);
  onActiveRef.current = opts.onActiveChange;
  const optsRef = useRef({ approachBelow, approachAbove });
  optsRef.current = { approachBelow, approachAbove };

  const blocks = useRef(new Map<number, HTMLElement>());
  const refCache = useRef(new Map<number, (el: HTMLElement | null) => void>());
  const refFor = useCallback((i: number) => {
    let fn = refCache.current.get(i);
    if (!fn) {
      fn = (el) => {
        if (el) blocks.current.set(i, el);
        else blocks.current.delete(i);
      };
      refCache.current.set(i, fn);
    }
    return fn;
  }, []);

  // Why the window grew: "scroll" preloads are anchored (compensated), "nav"
  // expansions are not.
  const causeRef = useRef<"scroll" | "nav">("scroll");
  const expandTo = useCallback((i: number, cause: "scroll" | "nav") => {
    const r = rangeRef.current;
    if (i >= r.first && i <= r.last) return;
    causeRef.current = cause;
    const grown = { first: Math.min(r.first, i), last: Math.max(r.last, i) };
    rangeRef.current = grown; // a second expansion in the same tick builds on this one
    setRange(grown);
  }, []);
  const scheduleRef = useRef<(() => void) | null>(null);

  // One rAF scroll loop: active tracking + approach loading.
  useEffect(() => {
    if (count === 0) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (blocks.current.size === 0) return;
      const mid = window.innerHeight / 2;
      let best = -1;
      for (const [i, el] of blocks.current) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid && rect.bottom >= mid) best = Math.max(best, i);
      }
      // No block straddles the center: fall back to the first mounted one.
      // NOT "deepest top above center" — right after a route change a stale
      // scroll position puts every block above center and that picks wrong.
      if (best === -1) best = Math.min(...blocks.current.keys());
      if (best !== activeRef.current) {
        activeRef.current = best;
        coreGoRef.current(best);
        onActiveRef.current?.(best);
      }

      const { first: f, last: l } = rangeRef.current;
      const { approachBelow: below, approachAbove: above } = optsRef.current;
      const lastEl = blocks.current.get(l);
      if (lastEl && l < countRef.current - 1 && lastEl.getBoundingClientRect().bottom - window.innerHeight < below) {
        expandTo(l + 1, "scroll");
      }
      const firstEl = blocks.current.get(f);
      if (firstEl && f > 0 && firstEl.getBoundingClientRect().top > -above) {
        expandTo(f - 1, "scroll");
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    scheduleRef.current = onScroll;
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scheduleRef.current = null;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count, expandTo]);

  // Re-run the loop after the window grows: freshly mounted blocks may
  // already satisfy an approach condition without any scroll event.
  useEffect(() => {
    scheduleRef.current?.();
  }, [first, lastMounted]);

  // Prepend anchor: a scroll-driven preload slides content in above the
  // reader; compensate by the prepended height before paint.
  const firstRef = useRef(first);
  useIsoLayoutEffect(() => {
    if (first < firstRef.current && causeRef.current === "scroll") {
      let height = 0;
      for (let i = first; i < firstRef.current; i++) {
        height += blocks.current.get(i)?.getBoundingClientRect().height ?? 0;
      }
      if (height) window.scrollBy({ top: height, behavior: "auto" });
    }
    causeRef.current = "scroll";
    firstRef.current = first;
  }, [first]);

  // Seed landing: exactly once, before first paint — no race with a router's
  // own scroll management.
  useIsoLayoutEffect(() => {
    if (!scrollToSeed || seed <= 0) return;
    blocks.current.get(seed)?.scrollIntoView({ block: "start", behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation scrolls after the expanded window has committed (an effect,
  // not a guessed number of rAFs), then waits one frame for layout to settle.
  const [nav, setNav] = useState<{ target: number } | null>(null);
  useEffect(() => {
    if (!nav) return;
    const raf = requestAnimationFrame(() =>
      blocks.current
        .get(nav.target)
        ?.scrollIntoView({ behavior: reducedRef.current ? "auto" : "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(raf);
  }, [nav]);

  const goTo = useCallback(
    (i: number) => {
      const c = countRef.current;
      if (c === 0) return;
      const target = Math.max(0, Math.min(i, c - 1));
      expandTo(target, "nav");
      setNav({ target });
    },
    [expandTo]
  );
  const next = useCallback(() => goTo(activeRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(activeRef.current - 1), [goTo]);

  const mounted = useMemo(() => {
    const out: number[] = [];
    for (let i = first; i <= lastMounted; i++) out.push(i);
    return out;
  }, [first, lastMounted]);

  return useMemo(
    () => ({
      active: core.index,
      seed,
      mounted,
      complete: count > 0 && lastMounted === last,
      refFor,
      goTo,
      next,
      prev,
      reducedMotion,
    }),
    [core.index, seed, mounted, count, lastMounted, last, refFor, goTo, next, prev, reducedMotion]
  );
}

/**
 * Mount fade for streamed blocks: `false` on the first client render, `true`
 * a frame later (immediately with reduced motion). Pass `initiallyVisible`
 * for server-rendered blocks (the stream's seed) so they never flash.
 */
export function useFadeIn(initiallyVisible = false): boolean {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(initiallyVisible);
  useEffect(() => {
    if (shown) return;
    if (reduced) {
      setShown(true);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [shown, reduced]);
  return shown;
}
