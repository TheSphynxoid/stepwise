"use client";

import { useMemo } from "react";
import { runSimulation } from "./simulation";
import type { Simulation, SimulationResult, SimulationRunOptions } from "./simulation";
import { useTrace } from "./use-trace";
import type { TraceOptions, TracePlayer } from "./use-trace";
import type { StepwiseStep } from "./types";

export interface SimulationOptions<S extends StepwiseStep> extends TraceOptions<S>, SimulationRunOptions {}

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
  opts?: SimulationOptions<S>
): SimulationPlayer<S> {
  const { seed, maxSteps, ...traceOpts } = opts ?? {};
  const result: SimulationResult<S> = useMemo(
    () => runSimulation(simulation, input, { seed, maxSteps }),
    [simulation, input, seed, maxSteps]
  );
  const trace = useTrace(result.steps, traceOpts);
  return useMemo(
    () => ({ ...trace, steps: result.steps, truncated: result.truncated, error: result.error, seed: result.seed }),
    [trace, result]
  );
}
