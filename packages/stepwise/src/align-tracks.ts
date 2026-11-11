// Pure: no React, no "use client". useSyncedTracks memoizes it per track
// identity; servers and tests call it directly through ./core.
import type { StepwiseStep } from "./types";

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
