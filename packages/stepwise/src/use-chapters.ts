"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const flatCount = flattenChapters(chapters).length;
  const core = useSteps(flatCount, { initialIndex: 0 });

  // Scroll → cursor (external input drives the sequence).
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const flat = flattenChapters(chaptersRef.current);
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
        core.go(best);
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
  }, [mounted, core]);

  useEffect(() => setMounted(true), []);

  const goTo = useCallback(
    (i: number) => {
      const flat = flattenChapters(chaptersRef.current);
      const entry = flat[i];
      if (!entry) return;
      setActive(i);
      core.go(i);
      const el = document.getElementById(entry.chapter.id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [core]
  );

  const next = useCallback(() => {
    if (core.canNext) goTo(activeRef.current + 1);
  }, [goTo, core]);
  const prev = useCallback(() => {
    if (core.canPrev) goTo(activeRef.current - 1);
  }, [goTo, core]);

  return { active: core.index, goTo, next, prev };
}
