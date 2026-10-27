"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseStepsOptions {
  /** Initial focus. Clamped. Defaults to 0. */
  initialIndex?: number;
  /** Fired whenever the focus index changes. */
  onChange?: (index: number) => void;
}

export interface StepsCore {
  /** Number of steps in the sequence. */
  count: number;
  /** Clamped focus: 0..count-1, or -1 when the sequence is empty. */
  index: number;
  atStart: boolean;
  atEnd: boolean;
  canNext: boolean;
  canPrev: boolean;
  /** Clamped jump. No-op on an empty sequence. */
  go: (index: number) => void;
  /** Clamped forward step. */
  next: () => void;
  /** Clamped backward step. */
  prev: () => void;
  /** Jump to the first step. */
  first: () => void;
}

/**
 * The core primitive every stepwise machine composes: a clamped cursor over an
 * ordered sequence. Frames in a trace, chapters in a lesson, lessons in a
 * notebook, and tour steps are all the same thing at this layer — timers,
 * effects, and scroll-tracking are policies layered on top by consumers.
 *
 * All callbacks are referentially stable; `count` may change dynamically (a
 * new timeline, a mounted window) and the cursor re-clamps automatically.
 */
export function useSteps<T>(items: readonly T[] | number, opts?: UseStepsOptions): StepsCore {
  const count = typeof items === "number" ? items : items.length;
  const countRef = useRef(count);
  countRef.current = count;
  const onChangeRef = useRef(opts?.onChange);
  onChangeRef.current = opts?.onChange;

  const [cursor, setCursor] = useState(() => {
    const initial = opts?.initialIndex ?? 0;
    return count === 0 ? -1 : Math.max(0, Math.min(initial, count - 1));
  });

  const index = count === 0 ? -1 : Math.max(0, Math.min(cursor, count - 1));
  const indexRef = useRef(index);
  indexRef.current = index;

  // Re-clamp when the sequence shrinks.
  useEffect(() => {
    if (count === 0) {
      if (cursor !== -1) setCursor(-1);
    } else if (cursor < 0 || cursor > count - 1) {
      setCursor(Math.max(0, Math.min(cursor, count - 1)));
    }
  }, [count, cursor]);

  const go = useCallback((i: number) => {
    const c = countRef.current;
    if (c === 0) return;
    const clamped = Math.max(0, Math.min(i, c - 1));
    if (clamped === indexRef.current) return;
    indexRef.current = clamped;
    setCursor(clamped);
    onChangeRef.current?.(clamped);
  }, []);

  const next = useCallback(() => {
    go(indexRef.current + 1);
  }, [go]);

  const prev = useCallback(() => {
    go(indexRef.current - 1);
  }, [go]);

  const first = useCallback(() => {
    go(0);
  }, [go]);

  return useMemo(
    () => ({
      count,
      index,
      atStart: index <= 0,
      atEnd: count > 0 && index >= count - 1,
      canNext: count > 0 && index < count - 1,
      canPrev: count > 0 && index > 0,
      go,
      next,
      prev,
      first,
    }),
    [count, index, go, next, prev, first]
  );
}
