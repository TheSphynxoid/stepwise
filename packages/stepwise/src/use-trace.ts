"use client";

import { useCallback, useMemo, useRef } from "react";
import { useStepPlayer } from "./use-step-player";
import type { StepPlayer, StepPlayerOptions } from "./use-step-player";
import type { StepTone, StepwiseStep } from "./types";

export interface TracePlayer<S extends StepwiseStep> {
  /** The underlying player — pass it to PlayerBar. */
  player: StepPlayer;
  /**
   * The frame to render. Never undefined for a non-empty trace: before the
   * player starts (`player.index === -1`) this is frame 0, not the last one.
   */
  step: S | undefined;
  /** Index of `step` in the trace (0 before start; -1 for an empty trace). */
  frame: number;
  /** Stable `toneAt` for PlayerBar / StepScrubber. */
  toneAt: (i: number) => StepTone;
  /** Stable `titleAt` for PlayerBar / StepScrubber. */
  titleAt: (i: number) => string;
}

/**
 * A player bound to a concrete trace: the steps array is the timeline, and
 * the hook resolves the frame to render (frame 0 before start — invariant
 * "index -1 means not started"), plus scrubber accessors that read the
 * latest steps through a ref. Replaces the per-page
 * `player.index >= 0 ? … : 0` boilerplate.
 *
 *   const trace = useTrace(STEPS, { autoPlay: true });
 *   <Viz arr={trace.step.arr} />
 *   <PlayerBar player={trace.player} toneAt={trace.toneAt} titleAt={trace.titleAt} />
 */
export function useTrace<S extends StepwiseStep>(
  steps: readonly S[],
  opts?: Omit<StepPlayerOptions, "total">
): TracePlayer<S> {
  const player = useStepPlayer({ ...opts, total: steps.length });
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const frame = steps.length === 0 ? -1 : Math.max(0, Math.min(player.index, steps.length - 1));
  const step = frame >= 0 ? steps[frame] : undefined;

  const toneAt = useCallback((i: number) => stepsRef.current[i]?.tone ?? "neutral", []);
  const titleAt = useCallback((i: number) => stepsRef.current[i]?.label ?? `step ${i + 1}`, []);

  return useMemo(() => ({ player, step, frame, toneAt, titleAt }), [player, step, frame, toneAt, titleAt]);
}
