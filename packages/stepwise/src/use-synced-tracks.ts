"use client";

import { useCallback, useMemo, useRef } from "react";
import { useStepPlayer } from "./use-step-player";
import type { StepPlayer, StepPlayerOptions } from "./use-step-player";
import type { StepTone, StepwiseStep } from "./types";

/** Named traces to play side by side: `{ bubble: stepsA, insertion: stepsB }`. */
export type Tracks = Record<string, readonly StepwiseStep<object>[]>;

/**
 * Sync-point key for a step. Steps with the same key in two or more tracks
 * land on the same aligned frame; `null`/`undefined` marks a free step. The
 * n-th occurrence of a key in one track pairs with the n-th in another.
 */
export type TrackKeyFn<T extends Tracks = Tracks> = (
  step: T[keyof T][number],
  index: number,
  track: keyof T & string
) => string | null | undefined;

/** One track's slot in one aligned frame. */
export interface AlignedCell {
  /** Index into the track's own steps; -1 only for an empty track. */
  index: number;
  /**
   * The track did not advance on this frame: it is holding its last frame
   * (finished, or waiting for a sync point), or waiting at frame 0 for its
   * first sync point.
   */
  held: boolean;
}

export type AlignedRow<K extends string = string> = Record<K, AlignedCell>;

/**
 * Align several traces into one timeline. Pure — use it directly for server
 * rendering or tests; `useSyncedTracks` memoizes it per track identity.
 *
 * - No `key` (hold): frame i shows step i of every track; a shorter track
 *   holds its last frame once it runs out. Length = the longest track.
 * - With `key`: tracks advance together frame by frame, but a track whose
 *   next step is a sync point holds until every other track that shares the
 *   point has reached it, so matching steps share a frame. Keys must occur
 *   in the same relative order across tracks; where they conflict, that
 *   frame degrades to lockstep instead of deadlocking.
 */
export function alignTracks<T extends Tracks>(tracks: T, key?: TrackKeyFn<T>): AlignedRow<keyof T & string>[] {
  type K = keyof T & string;
  const names = Object.keys(tracks) as K[];
  const lens = names.map((n) => tracks[n].length);
  const rows: AlignedRow<K>[] = [];
  const holdCell = (len: number, at: number): AlignedCell => ({ index: len === 0 ? -1 : Math.min(at, len - 1), held: true });

  if (!key) {
    const length = Math.max(0, ...lens);
    for (let i = 0; i < length; i++) {
      const row = {} as AlignedRow<K>;
      names.forEach((n, t) => {
        row[n] = i < lens[t] ? { index: i, held: false } : holdCell(lens[t], i);
      });
      rows.push(row);
    }
    return rows;
  }

  // Occurrence-qualified keys: "k\0n" is the n-th "k" in that track.
  const keyed = names.map((n) =>
    tracks[n].map((step, i) => {
      const k = key(step as T[keyof T][number], i, n);
      return k == null ? null : k;
    })
  );
  const qualified = keyed.map((ks) => {
    const seen = new Map<string, number>();
    return ks.map((k) => {
      if (k === null) return null;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return `${k}\u0000${n}`;
    });
  });
  // Sync point → position in each track that has it (only keys in ≥2 tracks).
  const where = new Map<string, Map<number, number>>();
  qualified.forEach((ks, t) =>
    ks.forEach((k, i) => {
      if (k === null) return;
      let m = where.get(k);
      if (!m) where.set(k, (m = new Map()));
      m.set(t, i);
    })
  );
  for (const [k, m] of where) if (m.size < 2) where.delete(k);

  const pos = names.map(() => 0);
  while (pos.some((p, t) => p < lens[t])) {
    const live = names.map((_, t) => pos[t] < lens[t]);
    const blocked = names.map((_, t) => {
      if (!live[t]) return false;
      const k = qualified[t][pos[t]];
      const m = k === null ? undefined : where.get(k);
      if (!m) return false;
      for (const [u, at] of m) if (u !== t && at > pos[u]) return true;
      return false;
    });
    const anyFree = live.some((l, t) => l && !blocked[t]);
    const row = {} as AlignedRow<K>;
    names.forEach((n, t) => {
      if (live[t] && (!blocked[t] || !anyFree)) {
        row[n] = { index: pos[t], held: false };
        pos[t]++;
      } else {
        row[n] = holdCell(lens[t], Math.max(0, pos[t] - 1));
      }
    });
    rows.push(row);
  }
  return rows;
}

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
