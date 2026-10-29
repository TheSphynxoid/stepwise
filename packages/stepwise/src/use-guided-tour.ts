"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSteps } from "./use-steps";
import type { TourDriver, TourStepInput } from "./types";

export interface GuidedTour {
  /** Active step index, or null when the tour is not running. */
  index: number | null;
  current: TourStepInput | null;
  active: boolean;
  /**
   * True while the active step's `gate` returns false: `next()` is a no-op
   * until the gate opens. Present the `blocked` state (disable Next, pulse
   * the waitHint) so the user knows what is being waited on.
   */
  blocked: boolean;
  start: () => void;
  end: () => void;
  next: () => void;
  back: () => void;
  goto: (index: number) => void;
  /** Jump to the step with this id. No-op when the id is unknown. */
  gotoId: (id: string) => void;
}

export interface GuidedTourOptions {
  /**
   * Alternate presenter (driver.js, Shepherd, …). When set, the hook drives it
   * imperatively — show/hide per step, with transition controls wired — and
   * the app should not render the built-in TourSpotlight/TourCard. Without a
   * driver, the app renders the built-in presentation itself.
   */
  driver?: TourDriver;
}

/**
 * Tour state whose steps are effects over app state: `onEnter` fires whenever
 * the active step changes, reading the latest `steps` via ref so closures stay
 * fresh without re-triggering the effect on every render. Composed on
 * useSteps — a tour is a step sequence whose `next` past the end exits.
 *
 * On top of the linear cursor, steps may declare `when` (skip on arrival),
 * `gate` (block `next` until true), and `next` (edge override by step id) —
 * a small state machine where states are steps, edges are `next` functions,
 * and guards are gates. The cursor itself stays a cursor: skipped steps are
 * never landed on, and skipped/gated behavior is evaluated at transition
 * time, not on every render.
 */
export function useGuidedTour(steps: TourStepInput[], opts?: GuidedTourOptions): GuidedTour {
  const [running, setRunning] = useState(false);
  const runningRef = useRef(running);
  runningRef.current = running;
  const core = useSteps(steps.length);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const driverRef = useRef(opts?.driver);
  driverRef.current = opts?.driver;
  // core.go is referentially stable; reach it through a ref so the callbacks
  // below (and the driver effect) don't churn with the cursor.
  const coreGoRef = useRef(core.go);
  coreGoRef.current = core.go;

  const isSkipped = useCallback(
    (i: number) => stepsRef.current[i]?.when?.() === false,
    []
  );

  /**
   * Land on `start` when eligible; otherwise walk in `dir` past skipped
   * steps. Forward exhaustion (or an all-skipped tour) returns null, which
   * ends the run; backward exhaustion restarts at the first eligible step.
   */
  const settle = useCallback(
    (start: number, dir: 1 | -1): number | null => {
      const len = stepsRef.current.length;
      let i = start;
      while (i >= 0 && i < len && isSkipped(i)) i += dir;
      if (i >= 0 && i < len) return i;
      if (dir === 1) return null;
      for (let j = 0; j < len; j++) if (!isSkipped(j)) return j;
      return null;
    },
    [isSkipped]
  );

  /** Enter the tour at (or, past skipped steps in direction `dir`) index `i`. */
  const arrive = useCallback(
    (i: number, dir: 1 | -1) => {
      const target = settle(i, dir);
      if (target === null) {
        setRunning(false);
        return;
      }
      setRunning(true);
      coreGoRef.current(target);
    },
    [settle]
  );

  const goTo = useCallback(
    (i: number) => {
      if (stepsRef.current.length === 0) return;
      arrive(Math.max(0, Math.min(i, stepsRef.current.length - 1)), 1);
    },
    [arrive]
  );

  const goToId = useCallback(
    (id: string) => {
      const i = stepsRef.current.findIndex((s) => s.id === id);
      if (i >= 0) goTo(i);
    },
    [goTo]
  );

  const index = running ? core.index : null;

  useEffect(() => {
    if (!running) return;
    stepsRef.current[core.index]?.onEnter?.();
  }, [running, core.index]);

  // Custom driver lifecycle — show the active step, hide on end/unmount.
  useEffect(() => {
    const driver = driverRef.current;
    if (!driver) return;
    if (!running) {
      driver.hide();
      return;
    }
    const step = stepsRef.current[core.index];
    if (!step) {
      driver.hide();
      return;
    }
    driver.show(step, {
      index: core.index,
      total: stepsRef.current.length,
      next: () => goTo(core.index + 1),
      back: () => goTo(core.index - 1),
      end: () => setRunning(false),
    });
  }, [running, core.index, goTo, core]);

  // Hide the driver if the tour unmounts mid-step.
  useEffect(() => () => driverRef.current?.hide(), []);

  const start = useCallback(() => {
    if (stepsRef.current.length === 0) return;
    arrive(0, 1);
  }, [arrive]);

  const end = useCallback(() => setRunning(false), []);

  /** Edge target of step i: explicit next() id resolved to an index, else i+1. */
  const resolveNext = useCallback((i: number): number => {
    const list = stepsRef.current;
    const edge = list[i]?.next?.();
    if (edge != null) {
      const t = list.findIndex((s) => s.id === edge);
      if (t >= 0) return t;
    }
    return i + 1;
  }, []);

  const next = useCallback(() => {
    if (!runningRef.current) return;
    const i = core.index;
    // A closed gate blocks the advance — the app surfaces `blocked`.
    if (stepsRef.current[i]?.gate?.() === false) return;
    const target = resolveNext(i);
    if (target > stepsRef.current.length - 1) {
      setRunning(false); // linear past the end — the tour exits
      return;
    }
    arrive(target, 1);
  }, [core, arrive, resolveNext]);

  const back = useCallback(() => {
    if (!runningRef.current) return;
    const i = core.index;
    if (i <= 0) return;
    arrive(i - 1, -1);
  }, [core, arrive]);

  const current = running ? (stepsRef.current[core.index] ?? null) : null;
  const blocked = current?.gate?.() === false;
  return { index, current, active: running, blocked, start, end, next, back, goto: goTo, gotoId: goToId };
}
