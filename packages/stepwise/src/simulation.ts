import type { StepwiseStep } from "./types";

// Simulations: a trace computed from an input by a generator, instead of a
// hand-recorded array. Deterministic by construction: the only randomness
// available is the seeded `rng` in the context, so (simulation, input, seed)
// always yields the same trace, and a `#seed=…&frame=…` link replays exactly.

/** Deterministic pseudo-random source (mulberry32). */
export interface Rng {
  /** The seed this generator was created from (numbers pass through; strings are hashed). */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (Fisher-Yates); the input is not modified. */
  shuffle<T>(items: readonly T[]): T[];
}

/** FNV-1a: strings become 32-bit seeds, so `"demo"` is as valid as `42`. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number | string = 0): Rng {
  const base = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  let state = base;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    seed: base,
    next,
    int,
    pick(items) {
      if (items.length === 0) throw new RangeError("rng.pick: empty array");
      return items[int(0, items.length - 1)];
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export interface SimulationContext {
  /** Seeded randomness. Use it instead of Math.random to keep runs replayable. */
  rng: Rng;
}

/**
 * A simulation turns an input into a trace. Write it as a generator that
 * yields one step per moment worth showing (or return an array):
 *
 *   function* bubble(input: number[]): Generator<SortStep> {
 *     const arr = [...input];
 *     for (let pass = 0; …) {
 *       yield { key: `p${pass}:j${j}`, tone: "neutral", label: "compare", arr: [...arr] };
 *     }
 *   }
 *
 * Yield snapshots (copies), not live references: every step is kept.
 * Give steps a `key` so the playhead stays put when the input changes.
 */
export type Simulation<Input, S extends StepwiseStep> = (input: Input, ctx: SimulationContext) => Iterable<S>;

export interface SimulationRunOptions {
  /** Seed for `ctx.rng`. Default 0. */
  seed?: number | string;
  /**
   * Safety cap: stop collecting after this many steps and report
   * `truncated` (a non-terminating simulation shouldn't hang the page).
   * Default 10 000.
   */
  maxSteps?: number;
}

export interface SimulationResult<S> {
  steps: S[];
  /** True when `maxSteps` cut the run short. */
  truncated: boolean;
  /** What the simulation threw, if it did; `steps` holds what it yielded before. */
  error: unknown;
  /** The numeric seed actually used (strings are hashed). */
  seed: number;
}

/** Run a simulation to completion (or the cap). Pure; safe at module scope and on the server. */
export function runSimulation<Input, S extends StepwiseStep>(
  simulation: Simulation<Input, S>,
  input: Input,
  opts?: SimulationRunOptions
): SimulationResult<S> {
  const maxSteps = opts?.maxSteps ?? 10_000;
  const rng = createRng(opts?.seed ?? 0);
  const steps: S[] = [];
  let truncated = false;
  let error: unknown = null;
  try {
    for (const step of simulation(input, { rng })) {
      if (steps.length >= maxSteps) {
        truncated = true;
        break;
      }
      steps.push(step);
    }
  } catch (e) {
    error = e;
  }
  return { steps, truncated, error, seed: rng.seed };
}
