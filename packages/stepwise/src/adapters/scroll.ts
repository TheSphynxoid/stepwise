"use client";

import type { PlayerEngine, PlayerEngineApi, PlayerEngineHandle } from "../types";

export interface ScrollEngineOptions {
  /** The scrollytelling section whose scroll progress drives the frames. */
  getContainer: () => HTMLElement | null;
  /** Frames in the current timeline. Recreate the engine when it changes. */
  total: number;
}

/**
 * PlayerEngine driven by scroll progress through a container section — the
 * scrollytelling mode. Scrolling maps to frame indices; manual stepping seeks
 * the scroll position; "play" smooth-scrolls to the end of the section.
 * Dependency-free (a scrollama replacement for this specific job).
 *
 *   const engine = useMemo(
 *     () => createScrollPlayerEngine({ getContainer: () => sectionRef.current, total: frames.length }),
 *     [frames.length]
 *   );
 */
export function createScrollPlayerEngine(opts: ScrollEngineOptions): PlayerEngine {
  return {
    connect(api: PlayerEngineApi): PlayerEngineHandle {
      let playing = false;
      let silent = false;

      const progressToFrame = (progress: number) =>
        Math.min(api.total - 1, Math.max(0, Math.floor(progress * api.total)));

      const emitFromScroll = () => {
        if (silent || !api) return;
        const el = opts.getContainer();
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        if (scrollable <= 0) return;
        const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
        const frame = progressToFrame(progress);
        api.onFrame(frame);
        if (playing && frame >= api.total - 1) {
          playing = false;
          api.onEnd();
        }
      };

      /** Scroll the window so the section sits at `progress` (0..1). */
      const scrollToProgress = (progress: number, smooth: boolean) => {
        const el = opts.getContainer();
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        if (scrollable <= 0) return;
        const top = window.scrollY + rect.top + scrollable * Math.min(1, Math.max(0, progress));
        silent = true;
        window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
        // Silence the synthetic scroll events until the scroll settles.
        window.setTimeout(() => {
          silent = false;
        }, smooth ? 700 : 50);
      };

      const onScroll = () => emitFromScroll();

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);

      return {
        play: () => {
          playing = true;
          const el = opts.getContainer();
          if (!el) return;
          scrollToProgress(1, true);
        },
        pause: () => {
          playing = false;
        },
        seek: (frame) => {
          const progress = api.total > 1 ? frame / api.total : 0;
          scrollToProgress(progress, false);
          api.onFrame(Math.min(frame, api.total - 1));
        },
        setRate: () => {
          // Scroll position is user-driven; rate has no meaning here.
        },
        disconnect: () => {
          playing = false;
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        },
      };
    },
  };
}
