"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { reanchor, sameSteps, stepKey } from "./core";
import { useStepPlayer } from "./use-step-player";
import type { StepPlayer, StepPlayerOptions } from "./use-step-player";
import type { StepTone, StepwiseStep } from "./types";

export interface TraceOptions<S extends StepwiseStep> extends Omit<StepPlayerOptions, "total" | "holdAt"> {
  /**
   * Checkpoints (see `StepPlayerOptions.holdAt`), with the step at hand:
   * `holdAt: (_, step) => step?.kind === "compare"`. Always sees the current
   * trace, also after it's recomputed.
   */
  holdAt?: (frame: number, step: S | undefined) => boolean;
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
  const { keyOf, holdAt, ...playerOpts } = opts ?? {};
  const stepsRef = useRef(steps);
  // The player keeps the latest holdAt in a ref, so a fresh wrapper per
  // render is fine; it resolves the step from the current trace.
  const player = useStepPlayer({
    ...playerOpts,
    total: steps.length,
    holdAt: holdAt ? (f) => holdAt(f, stepsRef.current[f]) : undefined,
  });
  stepsRef.current = steps;
  const keyFn = (keyOf ?? stepKey) as (step: S, index: number) => string | undefined;

  // What was on screen at the last commit. When the trace is replaced, the
  // anchored index is derived here, during render, so the very first frame
  // drawn against the new trace is already the right one; the layout effect
  // then moves the player's cursor to match.
  const shownRef = useRef<{ steps: readonly S[]; index: number }>({ steps, index: player.index });
  const shown = shownRef.current;
  let anchored: number | null = null;
  // A new array with the same steps (a page deriving `BUILDS.slice(0, n)` in
  // render) is not a new trace: re-anchoring it from the last shown frame
  // would undo whatever moved the player in this render.
  if (shown.steps !== steps && shown.index >= 0 && !sameSteps(shown.steps, steps, keyFn)) {
    // Fast path for appends (streams, live edges): the step on screen has
    // the same key at the same index in the new trace, so nothing moves.
    const i = shown.index;
    const k = i < shown.steps.length ? keyFn(shown.steps[i], i) : undefined;
    if (k !== undefined && i < steps.length && keyFn(steps[i], i) === k) anchored = i;
    else if (steps.some((s, j) => keyFn(s, j) !== undefined)) anchored = reanchor(shown.steps, i, steps, keyFn);
  }
  const index = anchored ?? player.index;

  const { jump } = player;
  // The anchored index lives only in this render. When it moved the cursor,
  // follow it with one real state change: if something else moves the cursor
  // back in the same commit (a page restoring a linked frame), the player's
  // state nets out unchanged and React would bail out of the re-render,
  // leaving the screen on the anchored frame while the player sits elsewhere.
  // When it didn't move (an equal trace, rebuilt by the page every render),
  // the screen already shows the player's frame: forcing a commit there
  // renders a new array, which anchors again, forever (React #185).
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useIsomorphicLayoutEffect(() => {
    shownRef.current = { steps, index };
    if (anchored === null || anchored === player.index) return;
    if (anchored >= 0) jump(anchored);
    rerender();
  });

  const frame = steps.length === 0 ? -1 : Math.max(0, Math.min(index, steps.length - 1));
  const step = frame >= 0 ? steps[frame] : undefined;

  const toneAt = useCallback((i: number) => stepsRef.current[i]?.tone ?? "neutral", []);
  const titleAt = useCallback((i: number) => stepsRef.current[i]?.label ?? `step ${i + 1}`, []);

  return useMemo(() => ({ player, step, frame, toneAt, titleAt }), [player, step, frame, toneAt, titleAt]);
}
