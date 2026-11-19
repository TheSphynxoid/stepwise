import { createRng } from "./simulation";
import { isChoicePoint } from "./walk";
import type { WalkResult, WalkSimulation, WalkStep } from "./walk";

// A walk run that goes forward without replaying. `runWalk` replays the path
// from (input, seed, choices) on every call, which grows without bound for a
// long interactive run (a game). A session keeps the generator alive at the
// choice point it stopped on and, when the next call's choices extend the
// previous call's (same prefix, by Object.is), sends it the new answers. It
// replays only when it must: a changed earlier answer, a dead generator
// (ended, capped, threw, closed). A generator can't be rewound, so replay
// stays the way back.
//
// Continuing equals replaying: the cap (counted since the last choice point)
// and the choice-point rule are the same as `runWalk`'s, so a session's result
// for some choices is the result `runWalk` gives for them. Its state is a pure
// function of the choices fed so far, so a result computed and then thrown
// away (a discarded render) can't leave it out of step with a replay.

export interface WalkSessionOptions {
  seed?: number | string;
  /** Steps allowed between choice points (default 10,000), as for `runWalk`. */
  maxSteps?: number;
}

export interface WalkSession<S, Choice> {
  /** The walk for `choices`, continuing the live generator when it can. Results are never mutated. */
  run: (choices: readonly (Choice | undefined)[]) => WalkResult<S>;
  /** Close the live generator (its finally blocks run). The next `run` replays. */
  close: () => void;
}

interface Live<S, Choice> {
  gen: Generator<S, unknown, Choice | undefined>;
  steps: S[];
  choicePoints: number[];
  used: number;
  sinceChoice: number;
}

export function createWalkSession<Input, S extends WalkStep, Choice>(
  simulation: WalkSimulation<Input, S, Choice>,
  input: Input,
  opts?: WalkSessionOptions
): WalkSession<S, Choice> {
  const maxSteps = opts?.maxSteps ?? 10_000;
  const seed = opts?.seed ?? 0;
  const seedNumber = createRng(seed).seed;
  // Set only while the generator is paused on an unanswered choice point.
  let live: Live<S, Choice> | null = null;
  let last: { choices: readonly (Choice | undefined)[]; result: WalkResult<S> } | null = null;

  const close = () => {
    const l = live;
    live = null;
    last = null;
    if (!l) return;
    try {
      l.gen.return(undefined);
    } catch {
      // A throwing finally block doesn't change any path we returned.
    }
  };

  const run = (choices: readonly (Choice | undefined)[]): WalkResult<S> => {
    if (last && sameChoices(last.choices, choices)) return last.result;
    // Live means the previous call ended awaiting, having used all its choices.
    const resume = live !== null && last !== null && isPrefix(last.choices, choices);
    if (!resume) close();

    let error: unknown = null;
    let truncated = false;
    let awaiting = false;
    let state: Live<S, Choice> | null = resume ? live : null;
    live = null;
    try {
      let it: IteratorResult<S, unknown>;
      if (state) {
        it = state.gen.next(choices[state.used++]);
      } else {
        state = { gen: simulation(input, { rng: createRng(seed) }), steps: [], choicePoints: [], used: 0, sinceChoice: 0 };
        it = state.gen.next();
      }
      while (!it.done) {
        if (state.sinceChoice >= maxSteps) {
          truncated = true;
          break;
        }
        const step = it.value;
        state.steps.push(step);
        state.sinceChoice++;
        if (isChoicePoint(step)) {
          state.sinceChoice = 0;
          state.choicePoints.push(state.steps.length - 1);
          if (state.used >= choices.length) {
            awaiting = true;
            break;
          }
          it = state.gen.next(choices[state.used++]);
        } else {
          it = state.gen.next(undefined);
        }
      }
    } catch (e) {
      error = e;
    }
    if (error === null && awaiting) {
      live = state;
    } else if (error === null && truncated) {
      // Capped: let the generator's finally blocks run, as runWalk does.
      try {
        state?.gen.return(undefined);
      } catch {
        // As above.
      }
    }
    const result: WalkResult<S> = {
      steps: state ? state.steps.slice() : [],
      choicePoints: state ? state.choicePoints.slice() : [],
      awaiting,
      used: state ? state.used : 0,
      truncated,
      error,
      seed: seedNumber,
    };
    last = { choices: choices.slice(), result };
    return result;
  };

  return { run, close };
}

function sameChoices(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && isPrefix(a, b);
}

function isPrefix(prefix: readonly unknown[], of: readonly unknown[]): boolean {
  return prefix.length <= of.length && prefix.every((c, i) => Object.is(c, of[i]));
}
