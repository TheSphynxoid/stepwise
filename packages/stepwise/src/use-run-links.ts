"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { readHashParam, writeHashParam } from "./use-step-player";

// Shared by useSimulation (syncInput) and useWalk (syncInput + syncChoices):
// a run's identity in the URL hash, next to the player's frame. On mount the
// linked parts are restored first, then the linked frame is applied to the
// trace computed from them (not to the default run's trace, where that frame
// may not exist). Edits are written back.

/**
 * Keep the simulation's input in the URL hash next to the frame, so a copied
 * link replays the exact run. You still own the input state: `onRestore`
 * hands you the linked input on mount (pass your state setter).
 */
export interface SyncInputOptions<Input> {
  /** Hash key for the input (`#in=…`). Must differ from `syncHash`. */
  key: string;
  /** Input → hash value. Keep it URL-safe (`[5,2,8]` → `"5.2.8"`). */
  serialize: (input: Input) => string;
  /** Hash value → input, or null to ignore a malformed or hostile value. */
  parse: (value: string) => Input | null;
  /** Receives the linked input once on mount. Usually your `setInput`. */
  onRestore: (input: Input) => void;
}

/** A linked part: its key, how to read and write it, the live value and its restore. */
interface LinkPart<T> {
  key: string;
  read: (raw: string) => T | null;
  write: (value: T) => string;
  value: T;
  restore: (value: T) => void;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const NONE = Symbol("none");

export function useRunLinks(
  parts: readonly (LinkPart<unknown> | null)[],
  frameKey: string | undefined,
  jump: (frame: number) => void
) {
  const partsRef = useRef(parts);
  partsRef.current = parts;
  // Per part: the value last written or restored. Comparing against it (not
  // "skip the first run") keeps StrictMode's double effects from writing the
  // default over a linked value.
  const written = useRef<unknown[]>(parts.map((p) => (p ? p.value : NONE)));
  const linked = useRef<{ values: unknown[]; frame: number | null } | null>(null);
  // The hash as the page was opened, captured during the first render: by
  // the time effects run, the player may already have written its own frame
  // (when the linked frame doesn't exist in the default run's trace).
  // A ref, so reading it on the client can't cause a hydration mismatch.
  const openedHash = useRef<string | null>(null);
  if (openedHash.current === null && typeof window !== "undefined") openedHash.current = window.location.hash;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = openedHash.current ?? window.location.hash;
    const values = partsRef.current.map((p) => {
      if (!p) return NONE;
      const raw = readHashParam(hash, p.key);
      const parsed = raw === null ? null : p.read(raw);
      return parsed === null ? NONE : parsed;
    });
    if (values.every((v) => v === NONE)) return;
    const f = frameKey ? readHashParam(hash, frameKey) : null;
    linked.current = { values, frame: f !== null && /^\d+$/.test(f) ? Number(f) : null };
    values.forEach((v, i) => {
      if (v === NONE) return;
      written.current[i] = v;
      partsRef.current[i]!.restore(v);
    });
    // Mount only: later hash edits by hand don't re-import the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Declared after useTrace by the caller, so it runs after the re-anchoring
  // layout effect of the same commit and has the last word on the cursor.
  const values = parts.map((p) => (p ? p.value : NONE));
  useIsomorphicLayoutEffect(() => {
    const l = linked.current;
    if (!l || !l.values.every((v, i) => v === NONE || v === values[i])) return;
    linked.current = null;
    if (l.frame !== null) jump(l.frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...values, jump]);

  // Write edits back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let next = window.location.hash;
    partsRef.current.forEach((p, i) => {
      if (!p || p.value === written.current[i]) return;
      written.current[i] = p.value;
      next = writeHashParam(next, p.key, p.write(p.value));
    });
    if (next !== window.location.hash) window.history.replaceState(null, "", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, values);
}

/** The link part for `syncInput`. */
export function inputPart<Input>(sync: SyncInputOptions<Input> | undefined, input: Input): LinkPart<unknown> | null {
  if (!sync) return null;
  return {
    key: sync.key,
    read: (raw) => sync.parse(decodeURIComponent(raw)),
    write: (v) => encodeURIComponent(sync.serialize(v as Input)),
    value: input,
    restore: (v) => sync.onRestore(v as Input),
  };
}
