"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSteps } from "./use-steps";
import { flattenChapters } from "./flatten";
import type { Chapter } from "./types";

export interface ChaptersApi {
  /** Index of the chapter currently in view (flattened order). */
  active: number;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
}

export { flattenChapters };

/**
 * Scroll-tracked chapter navigation for multi-section pages. Active = the
 * section containing the viewport center: a chapter becomes active when it
 * reaches the middle of the screen, not the moment its top scrolls past an
 * offset. Sections are resolved by DOM id; give each section CSS scroll-mt
 * so `goTo`'s scrollIntoView clears any sticky header. Composed on useSteps —
 * the scroll position is an external input driving the cursor.
 */
export function useChapters(chapters: Chapter[]): ChaptersApi {
  const [mounted, setMounted] = useState(false);
  const flat = useMemo(() => flattenChapters(chapters), [chapters]);
  const flatRef = useRef(flat);
  flatRef.current = flat;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const core = useSteps(flat.length, { initialIndex: 0 });
  // core.go is referentially stable; the tracker reaches it through a ref so
  // the effect below never depends on the core identity (which churns with
  // the index).
  const coreGoRef = useRef(core.go);
  coreGoRef.current = core.go;

  // Scroll → cursor (external input drives the sequence). Depending only on
  // `mounted` (+ the chapter count) matters: if this effect re-ran on every
  // cursor change, a programmatic goTo would be snapped back to the rect-
  // derived chapter before the smooth scroll has moved the viewport.
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const flat = flatRef.current;
      const mid = window.innerHeight / 2;
      let best = -1;
      for (let i = 0; i < flat.length; i++) {
        const el = document.getElementById(flat[i].chapter.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid && rect.bottom >= mid) best = i;
      }
      if (best === -1) {
        // No section contains the center (tall gap or beyond the ends): keep
        // the deepest section whose top is above center, else the first.
        for (let i = 0; i < flat.length; i++) {
          const el = document.getElementById(flat[i].chapter.id);
          if (el && el.getBoundingClientRect().top <= mid) best = i;
        }
        if (best === -1) best = 0;
      }
      if (best !== activeRef.current) {
        setActive(best);
        coreGoRef.current(best);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted, flat.length]);

  useEffect(() => setMounted(true), []);

  const goTo = useCallback((i: number) => {
    const entry = flatRef.current[i];
    if (!entry) return;
    setActive(i);
    coreGoRef.current(i);
    const el = document.getElementById(entry.chapter.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const next = useCallback(() => {
    if (activeRef.current < flatRef.current.length - 1) goTo(activeRef.current + 1);
  }, [goTo]);
  const prev = useCallback(() => {
    if (activeRef.current > 0) goTo(activeRef.current - 1);
  }, [goTo]);

  return { active: core.index, goTo, next, prev };
}
