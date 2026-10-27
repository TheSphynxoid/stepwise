"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSteps } from "./use-steps";
import type { TourDriver, TourStepInput } from "./types";

export interface GuidedTour {
  /** Active step index, or null when the tour is not running. */
  index: number | null;
  current: TourStepInput | null;
  active: boolean;
  start: () => void;
  end: () => void;
  next: () => void;
  back: () => void;
  goto: (index: number) => void;
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
 */
export function useGuidedTour(steps: TourStepInput[], opts?: GuidedTourOptions): GuidedTour {
  const [running, setRunning] = useState(false);
  const core = useSteps(steps.length);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const driverRef = useRef(opts?.driver);
  driverRef.current = opts?.driver;

  const goTo = useCallback(
    (i: number) => {
      if (stepsRef.current.length === 0) return;
      setRunning(true);
      core.go(Math.max(0, Math.min(i, stepsRef.current.length - 1)));
    },
    [core]
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
    setRunning(true);
    core.first();
  }, [core]);

  const end = useCallback(() => setRunning(false), []);
  const next = useCallback(() => {
    if (core.atEnd) {
      setRunning(false);
      return;
    }
    core.next();
  }, [core]);
  const back = useCallback(() => core.prev(), [core]);

  const current = running ? (stepsRef.current[core.index] ?? null) : null;
  return { index, current, active: running, start, end, next, back, goto: goTo };
}
