import { createRng } from "./simulation";
import type { SimulationContext, SimulationRunOptions } from "./simulation";
import type { PromptSpec } from "./prompts";
import type { StepwiseStep } from "./types";

// Walks: simulations that branch on the reader's choices. A step marked
// `await: true` is a choice point; the generator receives the choice as the
// value of that `yield`:
//
//   function* lesson(input) {
//     const pick = yield { key: "fork", await: true, label: "Which pivot?" };
//     if (pick === "first") yield* worstCase(input); else yield* median(input);
//   }
//
// A walk is fully described by (simulation, input, seed, choices): the steps
// are a path through a graph of possible steps, and `runWalk` replays it.
// Linear simulations are walks without choice points.

/** A step that may be a choice point. */
export type WalkStep = StepwiseStep & {
  /** The walk pauses after this step until a choice arrives (`choose`). */
  await?: boolean;
  /**
   * A prompt on the step; also makes it a choice point (the answer is the
   * choice). Only an object counts: a string, `null` or an array under this
   * name is ordinary step data.
   */
  prompt?: PromptSpec;
};

/** A choice point is an `await: true` step or a step whose `prompt` is an object. */
export function isChoicePoint(step: WalkStep): boolean {
  const p: unknown = step.prompt;
  return step.await === true || (typeof p === "object" && p !== null && !Array.isArray(p));
}

/** A generator whose `yield` at a choice point returns the reader's choice. */
export type WalkSimulation<Input, S extends WalkStep, Choice> = (
  input: Input,
  ctx: SimulationContext
) => Generator<S, unknown, Choice | undefined>;

export interface WalkRunOptions<Choice> extends SimulationRunOptions {
  /** Answers to the choice points, in the order they're reached (`undefined` is a skipped prompt). */
  choices?: readonly (Choice | undefined)[];
}

export interface WalkResult<S> {
  /** The path: every step up to the end, or up to the first unanswered choice point. */
  steps: S[];
  /** Indices (into `steps`) of the choice points on the path. */
  choicePoints: number[];
  /** True when the path ends on a choice point that has no answer yet. */
  awaiting: boolean;
  /** How many of `choices` were used (extra ones are ignored). */
  used: number;
  truncated: boolean;
  /** What the simulation threw, if it did; `steps` holds what it yielded before. */
  error: unknown;
  seed: number;
}

/** Replay a walk: run the simulation, feeding `choices` to its choice points. Pure. */
export function runWalk<Input, S extends WalkStep, Choice>(
  simulation: WalkSimulation<Input, S, Choice>,
  input: Input,
  opts?: WalkRunOptions<Choice>
): WalkResult<S> {
  const maxSteps = opts?.maxSteps ?? 10_000;
  const choices = opts?.choices ?? [];
  const rng = createRng(opts?.seed ?? 0);
  const steps: S[] = [];
  const choicePoints: number[] = [];
  let used = 0;
  // maxSteps bounds a run between prompts, not the whole run.
  let sinceChoice = 0;
  let awaiting = false;
  let truncated = false;
  let error: unknown = null;
  let gen: Generator<S, unknown, Choice | undefined> | undefined;
  try {
    gen = simulation(input, { rng });
    let it = gen.next();
    while (!it.done) {
      if (sinceChoice >= maxSteps) {
        truncated = true;
        break;
      }
      const step = it.value;
      steps.push(step);
      sinceChoice++;
      if (isChoicePoint(step)) {
        sinceChoice = 0;
        choicePoints.push(steps.length - 1);
        if (used >= choices.length) {
          awaiting = true;
          break;
        }
        it = gen.next(choices[used++]);
      } else {
        it = gen.next(undefined);
      }
    }
  } catch (e) {
    error = e;
  }
  // Stopped early (awaiting, capped): let the generator's finally blocks run.
  if (error === null && (awaiting || truncated)) {
    try {
      gen?.return(undefined);
    } catch {
      // A throwing finally block doesn't change the path we have.
    }
  }
  return { steps, choicePoints, awaiting, used, truncated, error, seed: rng.seed };
}
