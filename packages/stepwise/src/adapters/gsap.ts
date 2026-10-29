"use client";

import gsap from "gsap";
import type { PlayerEngine, PlayerEngineApi, PlayerEngineHandle } from "../types";

export interface GsapEngineOptions {
  /** Frames in the current timeline. Recreate the engine when it changes. */
  total: number;
  /** Wall-clock time per frame at 1× speed. */
  baseDelayMs?: number;
}

/**
 * PlayerEngine backed by a GSAP tween. The playhead maps 1:1 onto frame
 * indices, so play/pause/seek/rate come from GSAP and frames stream back
 * through onUpdate. Swap-in for useStepPlayer's built-in timer:
 *
 *   const engine = useMemo(
 *     () => createGsapPlayerEngine({ total: frames.length, baseDelayMs: 900 }),
 *     [frames.length]
 *   );
 *   const player = useStepPlayer({ total: frames.length, engine });
 */
export function createGsapPlayerEngine(opts: GsapEngineOptions): PlayerEngine {
  return {
    connect(api: PlayerEngineApi): PlayerEngineHandle {
      const last = Math.max(0, opts.total - 1);
      const proxy = { frame: 0 };
      const duration = Math.max(0.001, (opts.total * (opts.baseDelayMs ?? 900)) / 1000);
      // Port contract: onEnd fires once per run, on the transition into the
      // final frame — not on every parked tick. Rewinding (seek below the
      // last frame) re-arms it.
      let endFired = false;
      const tween = gsap.to(proxy, {
        frame: last,
        duration,
        ease: "none",
        paused: true,
        onUpdate: () => {
          const frame = Math.min(Math.max(Math.floor(proxy.frame), 0), api.total - 1);
          api.onFrame(frame);
          if (!endFired && frame >= api.total - 1) {
            endFired = true;
            api.onEnd();
          }
        },
      });
      return {
        play: () => {
          tween.play();
        },
        pause: () => {
          tween.pause();
        },
        seek: (frame) => {
          tween.pause(Math.min(frame, last));
          if (frame < last) endFired = false;
        },
        setRate: (rate) => {
          tween.timeScale(rate);
        },
        disconnect: () => {
          tween.kill();
        },
      };
    },
  };
}
