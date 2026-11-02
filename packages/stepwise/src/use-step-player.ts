"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSteps } from "./use-steps";
import type { PlayerEngine } from "./types";

export interface StepPlayerOptions {
  /** Number of frames in the current timeline (0 = no timeline loaded). */
  total: number;
  /** Delay per frame at 1× speed (built-in timer engine). */
  baseDelayMs?: number;
  /** Start playing immediately (used when a timeline exists on first render). */
  autoPlay?: boolean;
  /**
   * Alternate frame source (GSAP timeline, scroll progress, …). Replaces the
   * built-in timer. Memoize the engine per timeline — identity changes
   * reconnect it.
   */
  engine?: PlayerEngine;
  /**
   * Deep-link the current frame into the URL hash (`#<key>=<index>`), opt-in.
   * The initial hash is honored once on mount. Only this key is written —
   * other `&`-separated hash parts (anchors, other players' keys) are kept.
   */
  syncHash?: string;
  /**
   * Fired once when playback runs to the final frame on its own (built-in
   * timer or engine `onEnd`). Cleared by any cursor movement (seek/step/
   * reset/new timeline) — the next full playthrough fires it again.
   */
  onEnd?: () => void;
  /**
   * Honor `prefers-reduced-motion: reduce` by not auto-advancing: with
   * `autoPlay`, the player still lands on frame 0 but stays paused until the
   * user presses play. Default true.
   */
  respectReducedMotion?: boolean;
  /**
   * Checkpoints: when it returns true for the frame playback just reached,
   * the built-in timer pauses there and reports `held` until `release()` —
   * "stop and predict what happens next". Manual stepping and seeks are never
   * held (the reader keeps control). Ignored when a custom `engine` drives
   * playback. Each checkpoint holds once per playthrough.
   */
  holdAt?: (frame: number) => boolean;
  /**
   * Follow the live edge of a growing timeline (a stream, a log, a game's
   * move history). When frames are appended while the reader is live
   * (playing, or parked on the last frame), playback continues through them
   * at the normal pace. A reader who scrubbed back or paused mid-trace stays
   * put — `live` turns false and `goLive()` returns them. With `autoPlay`, a
   * player that mounts empty starts on the first frames. Checkpoints still
   * hold; a custom `engine` owns its own timing and ignores this.
   */
  follow?: boolean;
}

export interface StepPlayer {
  /** Total frames in the current timeline. */
  total: number;
  /** Raw frame counter; -1 means "no timeline / before first frame". */
  frame: number;
  /** Frame clamped into [0, total-1]; -1 when there is nothing to show. */
  index: number;
  playing: boolean;
  speed: number;
  /** Position flag: the cursor is parked on the final frame (seek counts too). */
  atEnd: boolean;
  /**
   * Completion state: playback ran to the final frame on its own and nothing
   * has moved the cursor since. Unlike `atEnd`, a seek to the last frame does
   * not set it — `toggle()` at `ended` replays from frame 0.
   */
  ended: boolean;
  /**
   * The checkpoint frame playback is paused on (see `holdAt`), or null.
   * Cleared by `release()` or any cursor movement.
   */
  held: number | null;
  /** Release the current checkpoint and resume playing. No-op when not held. */
  release: () => void;
  /**
   * Move the cursor without touching playback state: playing stays playing,
   * completion and checkpoints are kept. For re-anchoring after the timeline
   * changes underneath (`useTrace` with keyed steps) — user-facing moves
   * should use `seek`.
   */
  jump: (frame: number) => void;
  /**
   * With `follow`: the reader is at the live edge (playing toward it, parked
   * on the last frame, or waiting to start), so appended frames will play.
   * Always false without `follow`.
   */
  live: boolean;
  /** Move to the last frame (paused, so new frames play from there with `follow`). */
  goLive: () => void;
  /** Jump to frame 0 and play. */
  start: () => void;
  /** Clear the player (frame = -1, paused). */
  reset: () => void;
  seek: (frame: number) => void;
  /** Step forward; pauses first. `onEmpty` fires when there is no timeline. */
  next: (onEmpty?: () => void) => void;
  /** Step backward; pauses first. */
  prev: () => void;
  /** Play/pause; replays from 0 at the end. `onEmpty` fires when there is no timeline. */
  toggle: (onEmpty?: () => void) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
}

export function useStepPlayer({
  total,
  baseDelayMs = 900,
  autoPlay = false,
  engine,
  syncHash,
  onEnd,
  respectReducedMotion = true,
  holdAt,
  follow = false,
}: StepPlayerOptions): StepPlayer {
  const core = useSteps(total);
  // useSteps' movement callbacks are referentially stable; depend on them
  // alone, never on `core` itself (its identity churns with the index).
  const { go, next: coreNext, prev: corePrev, first } = core;
  const [started, setStarted] = useState(autoPlay && total > 0);
  // A following autoPlay player may mount empty: it waits "playing" (not yet
  // started) and starts when the first frames arrive.
  const [playing, setPlaying] = useState(autoPlay && (total > 0 || follow));
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const holdAtRef = useRef(holdAt);
  holdAtRef.current = holdAt;
  // Checkpoint state: the frame playback is held on, and the frames already
  // released this playthrough (so resuming doesn't immediately re-hold).
  const [held, setHeld] = useState<number | null>(null);
  const releasedRef = useRef(new Set<number>());

  // Completion transitions are idempotent: adapters may repeat `onEnd`
  // (the port allows it); the option callback fires once per run.
  const markEnded = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    onEndRef.current?.();
  }, []);

  const clearEnded = useCallback(() => {
    if (!endedRef.current) return;
    endedRef.current = false;
    setEnded(false);
  }, []);

  const index = started && core.index >= 0 ? core.index : -1;
  const atEnd = total > 0 && index >= 0 && index >= total - 1;
  const live = follow && held === null && (started ? playing || atEnd : playing);

  // Live values for the public callbacks — read through refs so every
  // returned function keeps one identity for the player's lifetime.
  const totalRef = useRef(total);
  totalRef.current = total;
  const cursorRef = useRef(core.index);
  cursorRef.current = core.index;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const atEndRef = useRef(atEnd);
  atEndRef.current = atEnd;
  const heldRef = useRef(held);
  heldRef.current = held;
  const startedRef = useRef(started);
  startedRef.current = started;

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const engineApiRef = useRef<{
    play?(): void;
    pause?(): void;
    seek?(frame: number): void;
    rate?(rate: number): void;
  }>({});

  // Engine lifecycle — reconnect only when the engine identity changes
  // (`go` and `markEnded` are stable).
  useEffect(() => {
    if (!engine) return;
    const handle = engine.connect({
      get total() {
        return totalRef.current;
      },
      onFrame: (f) => go(f),
      onEnd: () => {
        markEnded();
        setPlaying(false);
      },
    });
    engineApiRef.current = {
      play: () => handle.play(),
      pause: () => handle.pause(),
      seek: (f) => handle.seek(f),
      rate: (r) => handle.setRate(r),
    };
    return () => {
      engineApiRef.current = {};
      handle.disconnect();
    };
  }, [engine, go, markEnded]);

  // Reduced motion: an autoPlay player lands on frame 0, paused. Checked once
  // on mount (before the first timer tick), not tracked live — a preference
  // flip mid-playback shouldn't yank control from the user.
  useEffect(() => {
    if (!respectReducedMotion || !autoPlay) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlaying(false);
    engineApiRef.current.pause?.();
    // Mount-only by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    setPlaying(true);
    clearEnded();
    setHeld(null);
    releasedRef.current = new Set();
    first();
    if (engineRef.current) {
      engineApiRef.current.seek?.(0);
      engineApiRef.current.play?.();
    }
  }, [first, clearEnded]);

  const reset = useCallback(() => {
    setStarted(false);
    setPlaying(false);
    clearEnded();
    setHeld(null);
    releasedRef.current = new Set();
    if (engineRef.current) engineApiRef.current.pause?.();
  }, [clearEnded]);

  const seek = useCallback(
    (f: number) => {
      const t = totalRef.current;
      if (t === 0) return;
      setStarted(true);
      setPlaying(false);
      clearEnded();
      setHeld(null);
      go(Math.max(0, Math.min(f, t - 1)));
      if (engineRef.current) {
        engineApiRef.current.pause?.();
        engineApiRef.current.seek?.(f);
      }
    },
    [go, clearEnded]
  );

  const next = useCallback(
    (onEmpty?: () => void) => {
      setPlaying(false);
      const t = totalRef.current;
      if (t === 0) {
        onEmpty?.();
        return;
      }
      setStarted(true);
      clearEnded();
      setHeld(null);
      const target = Math.min(cursorRef.current + 1, t - 1);
      coreNext();
      if (engineRef.current) {
        engineApiRef.current.pause?.();
        engineApiRef.current.seek?.(target);
      }
    },
    [coreNext, clearEnded]
  );

  const prev = useCallback(() => {
    setPlaying(false);
    clearEnded();
    setHeld(null);
    const target = Math.max(0, cursorRef.current - 1);
    corePrev();
    if (engineRef.current) {
      engineApiRef.current.pause?.();
      engineApiRef.current.seek?.(target);
    }
  }, [corePrev, clearEnded]);

  const toggle = useCallback(
    (onEmpty?: () => void) => {
      if (totalRef.current === 0) {
        onEmpty?.();
        return;
      }
      if (!playingRef.current && atEndRef.current) {
        start();
        return;
      }
      const nextPlaying = !playingRef.current;
      setPlaying(nextPlaying);
      setStarted(true);
      // Pressing play is an explicit release of the frame you're on, whether
      // playback was held there or you seeked onto a checkpoint.
      if (nextPlaying) {
        releasedRef.current.add(cursorRef.current);
        setHeld(null);
      }
      if (engineRef.current) {
        if (nextPlaying) engineApiRef.current.play?.();
        else engineApiRef.current.pause?.();
      }
    },
    [start]
  );

  const release = useCallback(() => {
    const h = heldRef.current;
    if (h === null) return;
    releasedRef.current.add(h);
    setHeld(null);
    setPlaying(true);
  }, []);

  const jump = useCallback(
    (f: number) => {
      const t = totalRef.current;
      if (t === 0) return;
      setStarted(true);
      go(Math.max(0, Math.min(f, t - 1)));
      if (engineRef.current) engineApiRef.current.seek?.(f);
    },
    [go]
  );

  const goLive = useCallback(() => {
    const t = totalRef.current;
    if (t === 0) return;
    setStarted(true);
    setPlaying(false);
    clearEnded();
    setHeld(null);
    go(t - 1);
    if (engineRef.current) {
      engineApiRef.current.pause?.();
      engineApiRef.current.seek?.(t - 1);
    }
  }, [go, clearEnded]);

  const changeSpeed = useCallback((s: number) => {
    setSpeed(s);
    if (engineRef.current) engineApiRef.current.rate?.(s);
  }, []);

  // A new timeline wipes completion — the next playthrough ends it fresh.
  useEffect(() => {
    clearEnded();
  }, [total, clearEnded]);

  // Following the live edge: when frames are appended, a reader who was live
  // keeps playing into them. Liveness is judged against the timeline as it
  // was (the old last frame), since `atEnd` already reflects the new total.
  // A timer that paused at the old end is re-armed by resuming playback.
  const prevTotal = useRef(total);
  useEffect(() => {
    const before = prevTotal.current;
    prevTotal.current = total;
    if (!follow || engineRef.current || total <= before) return;
    if (heldRef.current !== null) return;
    if (!startedRef.current) {
      if (playingRef.current) setStarted(true);
      return;
    }
    if (playingRef.current || cursorRef.current >= before - 1) setPlaying(true);
  }, [total, follow]);

  // A hold belongs to the frame it was reached on: moving off it (a jump
  // after the timeline changed, an engine frame) clears it.
  useEffect(() => {
    if (held !== null && held !== core.index) setHeld(null);
  }, [held, core.index]);

  // Built-in timer loop — skipped entirely when a custom engine takes over.
  useEffect(() => {
    if (engineRef.current) return;
    if (!playing || !started || total === 0) return;
    // Checkpoint: playback stops on this frame until released. Checked
    // before the end, so a checkpoint on the last frame holds too (a walk
    // waiting for a choice); released, playback then ends normally.
    if (holdAtRef.current?.(core.index) && !releasedRef.current.has(core.index)) {
      setHeld(core.index);
      setPlaying(false);
      return;
    }
    if (core.index >= total - 1) {
      markEnded();
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => coreNext(), baseDelayMs / speed);
    return () => clearTimeout(id);
  }, [playing, started, core.index, coreNext, total, speed, baseDelayMs, markEnded]);

  // Deep-linking: honor #<key>=<index> on mount and external hash edits only.
  // The hash values the player itself writes are ignored, and readHash never
  // re-runs on render churn (stable deps) — reading a lagging hash during
  // playback would ping-pong the cursor.
  const lastWrittenHash = useRef("");
  // A frame just read from the hash, until the cursor reflects it. The read
  // and the write effects run in the same commit, before go(f) re-renders:
  // without this the writer would briefly put the stale index back into the
  // URL, and anything else reading the hash in that commit would see it.
  const pendingRead = useRef<number | null>(null);
  const readHash = useCallback(() => {
    const t = totalRef.current;
    if (!syncHash || typeof window === "undefined" || t === 0) return;
    const hash = window.location.hash;
    if (hash === lastWrittenHash.current) return;
    const value = readHashParam(hash, syncHash);
    if (value === null || !/^\d+$/.test(value)) return;
    const f = Number(value);
    if (f < t) {
      pendingRead.current = f;
      setStarted(true);
      go(f);
    }
  }, [syncHash, go]);

  // The hash is read on mount, on real hashchange events, and once more when
  // a timeline first arrives (mounted empty, loaded later), but not on every
  // `total` change: when a trace is recomputed, the frame in the URL still
  // describes the old trace, and other code may have just rewritten its own
  // hash part, which would make it look like a fresh external link.
  const linkedRead = useRef(false);
  useEffect(() => {
    readHash();
    linkedRead.current = totalRef.current > 0;
    const onHashChange = () => readHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [readHash]);
  useEffect(() => {
    if (linkedRead.current || total === 0) return;
    linkedRead.current = true;
    readHash();
  }, [total, readHash]);

  useEffect(() => {
    if (!syncHash || index < 0 || typeof window === "undefined") return;
    // Skip the one write that would race a just-applied hash read.
    const pending = pendingRead.current;
    pendingRead.current = null;
    if (pending !== null && pending !== index) return;
    const next = writeHashParam(window.location.hash, syncHash, String(index));
    if (window.location.hash !== next) {
      lastWrittenHash.current = next;
      window.history.replaceState(null, "", next);
    }
  }, [syncHash, index]);

  return useMemo(
    () => ({
      total,
      frame: index,
      index,
      playing,
      speed,
      atEnd,
      ended,
      held,
      release,
      jump,
      live,
      goLive,
      start,
      reset,
      seek,
      next,
      prev,
      toggle,
      setPlaying,
      setSpeed: changeSpeed,
    }),
    [total, index, playing, speed, atEnd, ended, held, release, jump, live, goLive, start, reset, seek, next, prev, toggle, changeSpeed]
  );
}

// ── Hash params ──────────────────────────────────────────────────────────────
// The fragment is read as `&`-separated parts: `key=value` parts are params,
// anything else (a plain `#section` anchor) is kept verbatim. The player only
// ever touches its own key, so it coexists with other hash users. Keys are
// compared literally — no regex, so any key string is safe.

function hashParts(hash: string): string[] {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  return body ? body.split("&") : [];
}

/** Value of `key` in the hash, or null when absent. */
export function readHashParam(hash: string, key: string): string | null {
  for (const part of hashParts(hash)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === key) return part.slice(eq + 1);
  }
  return null;
}

/** The hash with `key` set to `value` — replaced in place, else appended. */
export function writeHashParam(hash: string, key: string, value: string): string {
  const parts = hashParts(hash);
  const pair = `${key}=${value}`;
  const i = parts.findIndex((p) => p.startsWith(`${key}=`));
  if (i >= 0) parts[i] = pair;
  else parts.push(pair);
  return `#${parts.join("&")}`;
}
