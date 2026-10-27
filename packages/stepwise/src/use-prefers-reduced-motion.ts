"use client";

import { useEffect, useState } from "react";

/**
 * True when the user asks the OS to reduce motion. Consumers should disable
 * transitions, smooth scrolls, and entry animations when this is true.
 * SSR-safe: false on the server, corrected after mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
