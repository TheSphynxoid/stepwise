"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { reanchor, stepKey } from "./reanchor";
import { useStepPlayer } from "./use-step-player";
import type { StepPlayer, StepPlayerOptions } from "./use-step-player";
import type { StepTone, StepwiseStep } from "./types";

export interface TraceOptions<S extends StepwiseStep> extends Omit<StepPlayerOptions, "total"> {
  /**
   * Step identity used to keep the playhead in place when `steps` changes
   * (see `reanchor`). Defaults to each step's `key` field. Traces without
   * keys keep the old behavior: the same index, clamped.
   */
  keyOf?: (step: S, index: number) => string | undefined;
}

// Re-anchoring must land before paint, or the old index flashes against the
// new trace for a frame. Layout effects don't run on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
 *
 * `steps` may change (new input, new seed — see `useSimulation`). Keyed
 * steps re-anchor: the playhead stays on the same logical step, and playback
 * state is untouched.
 */
export function useTrace<S extends StepwiseStep>(
  steps: readonly S[],
  opts?: TraceOptions<S>
): TracePlayer<S> {
  const { keyOf, ...playerOpts } = opts ?? {};
  const player = useStepPlayer({ ...playerOpts, total: steps.length });
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const keyFn = (keyOf ?? stepKey) as (step: S, index: number) => string | undefined;

  // What was on screen at the last commit. When the trace is replaced, the
  // anchored index is derived here, during render, so the very first frame
  // drawn against the new trace is already the right one; the layout effect
  // then moves the player's cursor to match.
  const shownRef = useRef<{ steps: readonly S[]; index: number }>({ steps, index: player.index });
  const shown = shownRef.current;
  let anchored: number | null = null;
  if (shown.steps !== steps && shown.index >= 0 && steps.some((s, i) => keyFn(s, i) !== undefined)) {
    anchored = reanchor(shown.steps, shown.index, steps, keyFn as (s: S, i: number) => string | undefined);
  }
  const index = anchored ?? player.index;

  const { jump } = player;
  useIsomorphicLayoutEffect(() => {
    if (anchored !== null && anchored >= 0 && anchored !== player.index) jump(anchored);
    shownRef.current = { steps, index };
  });

  const frame = steps.length === 0 ? -1 : Math.max(0, Math.min(index, steps.length - 1));
  const step = frame >= 0 ? steps[frame] : undefined;

  const toneAt = useCallback((i: number) => stepsRef.current[i]?.tone ?? "neutral", []);
  const titleAt = useCallback((i: number) => stepsRef.current[i]?.label ?? `step ${i + 1}`, []);

  return useMemo(() => ({ player, step, frame, toneAt, titleAt }), [player, step, frame, toneAt, titleAt]);
}
