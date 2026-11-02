"use client";

import { useMemo, useRef } from "react";
import { runSimulation } from "./simulation";
import type { Simulation, SimulationResult, SimulationRunOptions } from "./simulation";
import { useTrace } from "./use-trace";
import type { TraceOptions, TracePlayer } from "./use-trace";
import { inputPart, useRunLinks } from "./use-run-links";
import type { SyncInputOptions } from "./use-run-links";
import type { StepwiseStep } from "./types";

export type { SyncInputOptions };

export interface SimulationOptions<S extends StepwiseStep, Input = unknown>
  extends TraceOptions<S>,
    SimulationRunOptions {
  /**
   * Deep-link the input too (see `SyncInputOptions`). On mount the linked
   * input is restored first, and a linked `syncHash` frame is applied to
   * the trace computed from it, not to the default input's trace.
   */
  syncInput?: SyncInputOptions<Input>;
}

export interface SimulationPlayer<S extends StepwiseStep> extends TracePlayer<S> {
  /** The computed trace. */
  steps: readonly S[];
  /** True when `maxSteps` cut the run short. */
  truncated: boolean;
  /** What the simulation threw, if anything (the trace holds the steps before it). */
  error: unknown;
  /** The numeric seed used for this run. */
  seed: number;
}

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

/**
 * A live trace: run `simulation` on `input` and play the result. Change the
 * input (or the seed) and the trace is recomputed; keyed steps keep the
 * playhead on the same logical moment, and a playing player keeps playing.
 *
 *   const [input, setInput] = useState([5, 2, 8, 1]);
 *   const sim = useSimulation(bubbleSort, input, { autoPlay: true, syncHash: "frame" });
 *   <Bars arr={sim.step!.arr} />
 *   <PlayerBar player={sim.player} toneAt={sim.toneAt} titleAt={sim.titleAt} />
 *
 * The trace is recomputed when `simulation`, `input`, `seed` or `maxSteps`
 * change identity: define the simulation at module scope, and keep object
 * inputs in state (or memoize them) rather than rebuilding them per render.
 */
export function useSimulation<Input, S extends StepwiseStep>(
  simulation: Simulation<Input, S>,
  input: Input,
  opts?: SimulationOptions<S, Input>
): SimulationPlayer<S> {
  const { seed, maxSteps, syncInput, ...traceOpts } = opts ?? {};
  const result: SimulationResult<S> = useMemo(
    () => runSimulation(simulation, input, { seed, maxSteps }),
    [simulation, input, seed, maxSteps]
  );
  const trace = useTrace(result.steps, traceOpts);

  useRebuiltInputWarning(input);

  // Declared after useTrace, so the linked frame lands after re-anchoring.
  useRunLinks([inputPart(syncInput, input)], traceOpts.syncHash, trace.player.jump);

  return useMemo(
    () => ({ ...trace, steps: result.steps, truncated: result.truncated, error: result.error, seed: result.seed }),
    [trace, result]
  );
}

/**
 * Dev-only: an input rebuilt on every render (`useSimulation(sim, { arr, target })`
 * inline) recomputes the trace each render without any error. Warn once when
 * the identity keeps changing while the content doesn't.
 */
export function useRebuiltInputWarning(input: unknown, hook = "useSimulation") {
  const prev = useRef<{ input: unknown; json: string | undefined; streak: number; warned: boolean }>({
    input,
    json: undefined,
    streak: 0,
    warned: false,
  });
  if (!isDev) return;
  const p = prev.current;
  if (p.warned || input === p.input || typeof input !== "object" || input === null) {
    p.input = input;
    return;
  }
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    json = undefined;
  }
  p.streak = json !== undefined && json === p.json ? p.streak + 1 : 0;
  p.input = input;
  p.json = json;
  if (p.streak >= 3) {
    p.warned = true;
    console.warn(
      `[stepwise] ${hook}: \`input\` is a new object on every render with the same content, so the trace ` +
        "is recomputed each render. Keep it in state or wrap it in useMemo."
    );
  }
}
