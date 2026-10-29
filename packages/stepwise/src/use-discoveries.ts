"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Discovery ledger: which named things (features, tutorials, chapters) has
// this user already seen? A set of opaque id strings plus a persistence seam.
// The id scheme belongs to the consumer — encode versions in the id
// ("sort:v2") to re-show improved tours.

export interface DiscoveryStore {
  /** All discovered ids (best-effort; corrupted/absent storage reads as empty). */
  read(): string[];
  /** Persist the full set (write-through, not a delta). */
  write(ids: string[]): void;
}

/** localStorage-backed store — the default. Survives reloads, per-browser. */
export function localStorageStore(key = "stepwise.discoveries"): DiscoveryStore {
  return {
    read() {
      if (typeof window === "undefined") return [];
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    },
    write(ids) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, JSON.stringify(ids));
      } catch {
        // private mode / quota exceeded — discovery state is best-effort
      }
    },
  };
}

/**
 * Cookie-backed store — only when the SERVER must know during SSR (e.g. to
 * render "NEW" badges without a hydration flash). Costs request bytes; prefer
 * localStorage otherwise. Values are JSON-encoded and URI-escaped.
 */
export function cookieStore(key = "stepwise.discoveries"): DiscoveryStore {
  const read = (): string[] => {
    if (typeof document === "undefined") return [];
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
    if (!match) return [];
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  return {
    read,
    write(ids) {
      if (typeof document === "undefined") return;
      document.cookie = `${key}=${encodeURIComponent(JSON.stringify(ids))}; max-age=31536000; path=/; SameSite=Lax`;
    },
  };
}

/** In-memory store — tests, storybook, SSR fallbacks, "always show" previews. */
export function memoryStore(seed: string[] = []): DiscoveryStore {
  let ids = [...seed];
  return {
    read: () => [...ids],
    write(next) {
      ids = [...next];
    },
  };
}

export interface DiscoveriesOptions {
  /**
   * Storage seam. Defaults to localStorage. Swap in cookieStore when SSR
   * markup must know, or your own store (backend sync for cross-device).
   */
  store?: DiscoveryStore;
  /** Storage key used by the built-in stores. */
  key?: string;
}

export interface Discoveries {
  /** Discovered ids. Empty until hydration — gate triggers on `ready`. */
  discovered: Set<string>;
  /** False during SSR and before the first client hydration pass. */
  ready: boolean;
  /** Ref-backed check for event handlers; prefer `discovered.has` in render. */
  isDiscovered: (id: string) => boolean;
  /** Record ids as discovered and persist the merged set. */
  markDiscovered: (id: string | string[]) => void;
  /** Forget everything (debug / "show me the tour again"). */
  reset: () => void;
}

/**
 * A persisted set of discovered ids, hydrated after mount (SSR-safe: the
 * server renders the undiscovered state, the client corrects it in an
 * effect — same pattern as usePrefersReducedMotion). Compose with
 * useGuidedTour: `pending = features.filter(f => !discovered.has(f.id))`,
 * auto-start the first pending tour, `markDiscovered` on completion.
 */
export function useDiscoveries(opts?: DiscoveriesOptions): Discoveries {
  // The default store is built once (key captured at first call); an
  // explicitly passed store always wins and may change identity per render.
  const defaultStoreRef = useRef<DiscoveryStore | null>(null);
  const storeRef = useRef<DiscoveryStore | null>(null);
  if (opts?.store) {
    storeRef.current = opts.store;
  } else {
    if (!defaultStoreRef.current) defaultStoreRef.current = localStorageStore(opts?.key);
    storeRef.current = defaultStoreRef.current;
  }

  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    setIds(new Set(storeRef.current!.read()));
    setReady(true);
  }, []);

  const markDiscovered = useCallback((id: string | string[]) => {
    const additions = Array.isArray(id) ? id : [id];
    const merged = new Set(idsRef.current);
    let changed = false;
    for (const x of additions) {
      if (!merged.has(x)) {
        merged.add(x);
        changed = true;
      }
    }
    if (!changed) return;
    idsRef.current = merged;
    setIds(merged);
    storeRef.current!.write([...merged]);
  }, []);

  const reset = useCallback(() => {
    const empty = new Set<string>();
    idsRef.current = empty;
    setIds(empty);
    storeRef.current!.write([]);
  }, []);

  const isDiscovered = useCallback((id: string) => idsRef.current.has(id), []);

  return useMemo(
    () => ({ discovered: ids, ready, isDiscovered, markDiscovered, reset }),
    [ids, ready, isDiscovered, markDiscovered, reset]
  );
}
