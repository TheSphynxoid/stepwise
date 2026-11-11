import { runSimulation } from "./simulation";
import type { Simulation } from "./simulation";
import type { StepwiseStep } from "./types";

// Explainer definitions: one object that says what to simulate, what the
// default input is, and (optionally) where to stop and ask the reader to
// predict. Pure data plus pure functions, so a server component can run it at
// build time (`precompute`) and ship the finished trace as JSON, while the
// client re-runs the same definition when the reader edits the input.

export interface PredictOption {
  value: string;
  label: string;
}

export interface ExplainerPredict<S> {
  at: (step: S, frame: number) => boolean;
  options: readonly (string | PredictOption)[];
  /** The correct option value, judged from the frame after the held one. */
  truth: (next: S | undefined, held: S) => string | undefined;
  feedback?: (guess: string, truth: string, held: S) => string | undefined;
  /** Shown after two failed attempts. */
  hint?: string;
}

export interface ExplainerInput<Input> {
  default: Input;
  serialize?: (input: Input) => string;
  parse?: (value: string) => Input | null;
}

export interface ExplainerDefinition<Input, S extends StepwiseStep> {
  /** Used in error messages. */
  name?: string;
  simulation: Simulation<Input, S>;
  seed?: number | string;
  maxSteps?: number;
  input: ExplainerInput<Input>;
  predict?: ExplainerPredict<S>;
}

export interface PrecomputedTrace<Input, S> {
  input: Input;
  seed: number;
  steps: S[];
}

/** Freezes the definition itself (shallowly); the simulation and callbacks stay yours. */
export function defineExplainer<Input, S extends StepwiseStep>(
  def: ExplainerDefinition<Input, S>
): Readonly<ExplainerDefinition<Input, S>> {
  return Object.freeze(def);
}

/** The first non-JSON value under `value`, as a path and a kind; null when it is all JSON. */
function findNonJson(value: unknown, path: string): { path: string; kind: string } | null {
  if (value === null || typeof value === "boolean" || typeof value === "string") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : { path, kind: String(value) };
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      // A hole or undefined inside an array becomes null in JSON, which is a silent change.
      const bad = value[i] === undefined ? { path: `${path}[${i}]`, kind: "undefined" } : findNonJson(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      const name = (proto as { constructor?: { name?: string } }).constructor?.name;
      return { path, kind: name || "object with a custom prototype" };
    }
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      // An undefined field is dropped by JSON.stringify, which round-trips to "absent": allowed.
      if (child === undefined) continue;
      const bad = findNonJson(child, `${path}.${key}`);
      if (bad) return bad;
    }
    return null;
  }
  return { path, kind: typeof value };
}

/**
 * Run a definition to a JSON-safe trace. Throws (with the definition's name)
 * when the simulation throws, hits `maxSteps`, or yields something that would
 * not survive being serialized, so a broken explainer fails the build instead
 * of shipping a trace the client then disagrees with.
 */
export function precompute<Input, S extends StepwiseStep>(
  def: ExplainerDefinition<Input, S>,
  input?: Input
): PrecomputedTrace<Input, S> {
  const label = `[stepwise] precompute(${JSON.stringify(def.name ?? "explainer")})`;
  const used = input === undefined ? def.input.default : input;
  const run = runSimulation(def.simulation, used, { seed: def.seed, maxSteps: def.maxSteps });
  if (run.error !== null && run.error !== undefined) {
    const e = run.error;
    throw new Error(`${label}: simulation threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (run.truncated) {
    throw new Error(`${label}: simulation hit maxSteps (${def.maxSteps ?? 10_000}); raise maxSteps or fix a non-terminating run`);
  }
  for (let i = 0; i < run.steps.length; i++) {
    const bad = findNonJson(run.steps[i], `steps[${i}]`);
    if (bad) throw new Error(`${label}: ${bad.path} is not JSON-serializable (${bad.kind})`);
  }
  return { input: used, seed: run.seed, steps: run.steps };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** `input` wins; otherwise own keys of a plain-object default are overridden by same-named fields. */
export function resolveInput<Input>(
  def: { input: ExplainerInput<Input> },
  props?: { input?: Input } & Record<string, unknown>
): Input {
  if (props && props.input !== undefined) return props.input;
  const base = def.input.default;
  if (!props || !isPlainObject(base)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out as Input;
}

/** Bare strings become options with a capitalized label: "left" is { value: "left", label: "Left" }. */
export function normalizeOptions(options: readonly (string | PredictOption)[]): PredictOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o
  );
}
