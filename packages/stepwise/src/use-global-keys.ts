"use client";

import { useEffect, useRef } from "react";

export type KeyMap = Record<string, (e: KeyboardEvent) => void>;

const DEFAULT_IGNORED_TAGS = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"];

export interface GlobalKeysOptions {
  /** Element tags that swallow keys (except Escape). Defaults to form controls and buttons. */
  ignoreTags?: string[];
  /** Gate: bindings fire only while enabled. Boolean or function — checked per event. */
  enabled?: boolean | (() => boolean);
}

/**
 * Bind global keyboard shortcuts. Keys are matched against `event.key`
 * (exact first, then lowercase). Handlers fire with preventDefault applied;
 * Escape always fires, even from ignored targets, and is never prevented.
 */
export function useGlobalKeys(map: KeyMap, opts?: GlobalKeysOptions): void {
  const mapRef = useRef(map);
  mapRef.current = map;
  const ignoreRef = useRef<Set<string>>(new Set(opts?.ignoreTags ?? DEFAULT_IGNORED_TAGS));
  const enabledRef = useRef(opts?.enabled ?? true);
  enabledRef.current = opts?.enabled ?? true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const gate = enabledRef.current;
      const enabled = typeof gate === "function" ? gate() : gate;
      if (!enabled && e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key !== "Escape" && tag && ignoreRef.current.has(tag)) return;
      const fn = mapRef.current[e.key] ?? mapRef.current[e.key.toLowerCase()];
      if (!fn) return;
      if (e.key !== "Escape") e.preventDefault();
      fn(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
