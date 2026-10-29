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
   * The initial hash is honored once on mount.
   */
  syncHash?: string;
  /**
   * Fired once when playback runs to the final frame on its own (built-in
   * timer or engine `onEnd`). Cleared by any cursor movement (seek/step/
   * reset/new timeline) — the next full playthrough fires it again.
   */
  onEnd?: () => void;
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

export function useStepPlayer({ total, baseDelayMs = 900, autoPlay = false, engine, syncHash, onEnd }: StepPlayerOptions): StepPlayer {
  const core = useSteps(total);
  const [started, setStarted] = useState(autoPlay && total > 0);
  const [playing, setPlaying] = useState(autoPlay && total > 0);
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

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

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const totalRef = useRef(total);
  totalRef.current = total;
  const engineApiRef = useRef<{
    play?(): void;
    pause?(): void;
    seek?(frame: number): void;
    rate?(rate: number): void;
  }>({});

  // Engine lifecycle — reconnect only when the engine identity changes.
  useEffect(() => {
    if (!engine) return;
    const handle = engine.connect({
      get total() {
        return totalRef.current;
      },
      onFrame: (f) => core.go(f),
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
    // `core` identity churns with the index; the connect API reads live state
    // via refs — only the engine identity may reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const start = useCallback(() => {
    setStarted(true);
    setPlaying(true);
    clearEnded();
    core.first();
    if (engineRef.current) {
      engineApiRef.current.seek?.(0);
      engineApiRef.current.play?.();
    }
  }, [core]);

  const reset = useCallback(() => {
    setStarted(false);
    setPlaying(false);
    clearEnded();
    if (engineRef.current) engineApiRef.current.pause?.();
  }, [clearEnded]);

  const seek = useCallback(
    (f: number) => {
      if (total === 0) return;
      setStarted(true);
      setPlaying(false);
      clearEnded();
      core.go(Math.max(0, Math.min(f, total - 1)));
      if (engineRef.current) {
        engineApiRef.current.pause?.();
        engineApiRef.current.seek?.(f);
      }
    },
    [total, core, clearEnded]
  );

  const next = useCallback(
    (onEmpty?: () => void) => {
      setPlaying(false);
      if (total === 0) {
        onEmpty?.();
        return;
      }
      setStarted(true);
      clearEnded();
      core.next();
      if (engineRef.current) {
        engineApiRef.current.pause?.();
        engineApiRef.current.seek?.(Math.min(core.index + 1, total - 1));
      }
    },
    [total, core, clearEnded]
  );

  const prev = useCallback(() => {
    setPlaying(false);
    clearEnded();
    core.prev();
    if (engineRef.current) {
      engineApiRef.current.pause?.();
      engineApiRef.current.seek?.(Math.max(0, core.index - 1));
    }
  }, [core, clearEnded]);

  const toggle = useCallback(
    (onEmpty?: () => void) => {
      if (total === 0) {
        onEmpty?.();
        return;
      }
      if (!playing && atEnd) {
        setStarted(true);
        setPlaying(true);
        clearEnded();
        core.first();
        if (engineRef.current) {
          engineApiRef.current.seek?.(0);
          engineApiRef.current.play?.();
        }
        return;
      }
      const nextPlaying = !playing;
      setPlaying(nextPlaying);
      setStarted(true);
      if (engineRef.current) {
        if (nextPlaying) engineApiRef.current.play?.();
        else engineApiRef.current.pause?.();
      }
    },
    [total, playing, atEnd, core, clearEnded]
  );

  const changeSpeed = useCallback((s: number) => {
    setSpeed(s);
    if (engineRef.current) engineApiRef.current.rate?.(s);
  }, []);

  // A new timeline wipes completion — the next playthrough ends it fresh.
  useEffect(() => {
    clearEnded();
  }, [total, clearEnded]);

  // Built-in timer loop — skipped entirely when a custom engine takes over.
  useEffect(() => {
    if (engineRef.current) return;
    if (!playing || !started || total === 0) return;
    if (core.index >= total - 1) {
      markEnded();
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => core.next(), baseDelayMs / speed);
    return () => clearTimeout(id);
  }, [playing, started, core, total, speed, baseDelayMs, markEnded]);

  // Deep-linking: honor #<key>=<index> on mount and external hash edits only.
  // The hash values the player itself writes are ignored, and readHash never
  // re-runs on render churn (stable deps; go reached through a ref) — reading
  // a lagging hash during playback would ping-pong the cursor.
  const hashKey = syncHash;
  const coreGoRef = useRef(core.go);
  coreGoRef.current = core.go;
  const lastWrittenHash = useRef("");
  const readHash = useCallback(() => {
    if (!hashKey || typeof window === "undefined" || total === 0) return;
    const hash = window.location.hash;
    if (hash === lastWrittenHash.current) return;
    const match = hash.match(new RegExp(`[#&]${hashKey}=(\\d+)`));
    if (!match) return;
    const f = Number(match[1]);
    if (Number.isFinite(f) && f >= 0 && f < total) {
      setStarted(true);
      coreGoRef.current(f);
    }
  }, [hashKey, total]);

  useEffect(() => {
    readHash();
    const onHashChange = () => readHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [readHash]);

  useEffect(() => {
    if (!syncHash || index < 0 || typeof window === "undefined") return;
    const next = `#${syncHash}=${index}`;
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
      start,
      reset,
      seek,
      next,
      prev,
      toggle,
      setPlaying,
      setSpeed: changeSpeed,
    }),
    [total, index, playing, speed, atEnd, ended, start, reset, seek, next, prev, toggle, changeSpeed]
  );
}
