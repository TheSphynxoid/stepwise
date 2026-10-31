import type { StepwiseStep } from "./types";

export interface TraceBuilder<Data extends object> {
  /** Append one frame. Returns the builder, so calls chain. */
  step(step: StepwiseStep<Data>): TraceBuilder<Data>;
  /** Frames appended so far. */
  readonly length: number;
  /** The most recently appended frame (handy for "carry the state forward"). */
  last(): StepwiseStep<Data> | undefined;
  /** Snapshot the trace. A fresh array each call — the builder stays usable. */
  build(): StepwiseStep<Data>[];
}

/**
 * Typed trace builder. Authors run their algorithm at module scope and record
 * frames as they go — no IIFE, no pre-declared `const STEPS = []` that a
 * component might read before it is filled (invariant 6):
 *
 *   const t = createTrace<{ arr: number[] }>();
 *   for (…) t.step({ tone: "write", label: "swap", arr: [...arr] });
 *   export const STEPS = t.build();
 *
 * Pure data — no React, safe on the server.
 */
export function createTrace<Data extends object = Record<never, never>>(): TraceBuilder<Data> {
  const frames: StepwiseStep<Data>[] = [];
  const builder: TraceBuilder<Data> = {
    step(step) {
      frames.push(step);
      return builder;
    },
    get length() {
      return frames.length;
    },
    last() {
      return frames[frames.length - 1];
    },
    build() {
      return frames.slice();
    },
  };
  return builder;
}
