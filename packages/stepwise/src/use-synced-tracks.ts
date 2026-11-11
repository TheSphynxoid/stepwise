"use client";

import { useCallback, useMemo, useRef } from "react";
import { useStepPlayer } from "./use-step-player";
import type { StepPlayer, StepPlayerOptions } from "./use-step-player";
import { alignTracks } from "./core";
import type { AlignedCell, AlignedRow, TrackKeyFn, Tracks } from "./core";
import type { StepTone, StepwiseStep } from "./types";

// The alignment itself is pure and lives in ./core; re-exported so this
// module still reads as the whole comparison-mode surface.
export { alignTracks };
export type { AlignedCell, AlignedRow, TrackKeyFn, Tracks };

export interface TrackView<S> {
  /** The step to render for this track (undefined only for an empty track). */
  step: S | undefined;
  /** Index into the track's own steps; -1 for an empty track. */
  index: number;
  /** The track did not advance on this frame (see `AlignedCell.held`). */
  held: boolean;
  /** The track is on its final step. */
  done: boolean;
  /** Length of the track's own trace. */
  length: number;
}

export interface SyncedTracksOptions<T extends Tracks = Tracks> extends Omit<StepPlayerOptions, "total"> {
  /**
   * Sync-point alignment (see `alignTracks`). Omit to hold shorter tracks on
   * their last frame. Read when the tracks change — pass the same tracks to
   * keep the alignment memoized; an inline function is fine.
   */
  key?: TrackKeyFn<T>;
}

export interface SyncedTracks<T extends Tracks> {
  /** One player over the aligned timeline — pass it to PlayerBar. */
  player: StepPlayer;
  /** Aligned frame to render: 0 before the player starts, -1 when all tracks are empty. */
  frame: number;
  /** Number of aligned frames. */
  total: number;
  /** Per-track view of `frame`. */
  tracks: { [K in keyof T]: TrackView<T[K][number]> };
  /** The full alignment table (stable while the tracks are). */
  rows: readonly AlignedRow<keyof T & string>[];
  /** Stable scrubber accessors: the most severe tone among tracks that moved. */
  toneAt: (i: number) => StepTone;
  /** Stable scrubber accessor: `track: label` for every track that moved. */
  titleAt: (i: number) => string;
}

const TONE_RANK: StepTone[] = ["bad", "good", "write", "accent", "neutral", "idle"];

/**
 * Comparison mode: several traces of the same input (two engines, two
 * algorithms) under ONE player. The cursor walks the aligned timeline from
 * `alignTracks`; each track resolves its own step, so payload types stay
 * per-track. Like `useTrace`, frame 0 renders before playback starts.
 *
 *   const cmp = useSyncedTracks({ bubble: BUBBLE, insertion: INSERTION }, { autoPlay: true });
 *   <Lane step={cmp.tracks.bubble.step} held={cmp.tracks.bubble.held} />
 *   <PlayerBar player={cmp.player} toneAt={cmp.toneAt} titleAt={cmp.titleAt} />
 */
export function useSyncedTracks<T extends Tracks>(tracks: T, opts?: SyncedTracksOptions<T>): SyncedTracks<T> {
  const { key, ...playerOpts } = opts ?? {};
  const keyRef = useRef(key);
  keyRef.current = key;

  // Shallow memo over the track arrays: `{ a, b }` is a fresh object every
  // render, but the arrays inside are what matter.
  const cache = useRef<{ names: string[]; arrays: unknown[]; keyed: boolean; rows: AlignedRow[] } | null>(null);
  const names = Object.keys(tracks);
  const arrays = names.map((n) => tracks[n]);
  const c = cache.current;
  if (
    !c ||
    c.keyed !== !!key ||
    c.names.length !== names.length ||
    names.some((n, i) => c.names[i] !== n || c.arrays[i] !== arrays[i])
  ) {
    cache.current = { names, arrays, keyed: !!key, rows: alignTracks(tracks, keyRef.current) };
  }
  const rows = cache.current!.rows as AlignedRow<keyof T & string>[];

  const player = useStepPlayer({ ...playerOpts, total: rows.length });

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const frame = rows.length === 0 ? -1 : Math.max(0, Math.min(player.index, rows.length - 1));
  const row = frame >= 0 ? rows[frame] : undefined;

  // Per-track view of the frame. `aligned` changes identity exactly when a
  // track array does, so consumers can depend on `tracks`.
  const aligned = cache.current!;
  const view = useMemo(() => {
    const out = {} as { [K in keyof T]: TrackView<T[K][number]> };
    aligned.names.forEach((n, t) => {
      const list = aligned.arrays[t] as readonly StepwiseStep<object>[];
      const cell = row?.[n as keyof T & string];
      const index = cell ? cell.index : list.length === 0 ? -1 : 0;
      out[n as keyof T] = {
        step: index >= 0 ? (list[index] as T[keyof T][number]) : undefined,
        index,
        held: cell?.held ?? false,
        done: list.length > 0 && index === list.length - 1,
        length: list.length,
      };
    });
    return out;
  }, [aligned, row]);

  const moved = useCallback((i: number) => {
    const r = rowsRef.current[i];
    if (!r) return [];
    return Object.keys(r)
      .filter((n) => !r[n as keyof typeof r].held)
      .map((n) => ({ name: n, step: tracksRef.current[n]?.[r[n as keyof typeof r].index] }))
      .filter((m): m is { name: string; step: StepwiseStep<object> } => !!m.step);
  }, []);

  const toneAt = useCallback(
    (i: number): StepTone => {
      const tones = moved(i).map((m) => m.step.tone);
      return TONE_RANK.find((t) => tones.includes(t)) ?? "neutral";
    },
    [moved]
  );
  const titleAt = useCallback(
    (i: number) => {
      const parts = moved(i).map((m) => `${m.name}: ${m.step.label}`);
      return parts.length ? parts.join(" · ") : `frame ${i + 1}`;
    },
    [moved]
  );

  return useMemo(
    () => ({ player, frame, total: rows.length, tracks: view, rows, toneAt, titleAt }),
    [player, frame, rows, view, toneAt, titleAt]
  );
}
