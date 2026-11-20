import type { Prompt, PromptContext, PromptSpec } from "./prompts";
import { runSimulation } from "./simulation";
import type { Simulation } from "./simulation";
import type { EvaluatorResult, StepwiseStep } from "./types";
import { isChoicePoint, runWalk } from "./walk";
import type { WalkSimulation, WalkStep } from "./walk";

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
  /**
   * Whether to stop on this frame and ask. `next` is the frame the answer is
   * judged from, so a checkpoint can depend on what is about to happen ("stop
   * where a new category starts") without a lookahead field in the trace.
   * Never called for the last frame: a checkpoint needs a next frame.
   */
  at: (step: S, frame: number, next: S) => boolean;
  options: readonly (string | PredictOption)[];
  /** The correct option value, judged from the frame after the held one. */
  truth: (next: S | undefined, held: S) => string | undefined;
  feedback?: (guess: string, truth: string, held: S) => string | undefined;
  /** Shown with the feedback after a miss while a retry remains (see `prompts.retries`). */
  hint?: string;
}

/**
 * EXPERIMENTAL. A definition's prompt settings (see `usePrompts`): overlay
 * prompts (`ask`), a judge for prompts without one, and the run's rules.
 * Answers are strings in the kit. Defaults as `usePrompts`, except a walk:
 * `retries: Infinity` and `onInputChange: "keep"` (a walk's choices stay free).
 */
export interface ExplainerPrompts<S, A = string> {
  /** A prompt for a frame, or null. `steps` is the trace (on a walk, the path so far). */
  ask?: (step: S, frame: number, steps: readonly S[]) => Prompt<A, S> | null;
  /** Judges every prompt that has no `judge` of its own. May be async. */
  judge?: (answer: A, prompt: PromptSpec<A>, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>;
  /** Changes allowed after the first answer (default 0; a prompt's own `retries` wins). */
  retries?: number;
  /** "gate" (default): forward moves stop at an unsettled prompt. "free": they pass it. */
  navigation?: "gate" | "free";
  /** Move on as soon as a prompt settles (default false: wait for Continue). */
  autoContinue?: boolean;
  /** What an input edit does to the answers (default "lock" once a judged prompt is reached, else "keep"). */
  onInputChange?: "lock" | "clear" | "keep";
  /**
   * Link the answers in the hash (`${id}.a`; a walk's `${id}.path`). Default:
   * only when the definition has no judged prompts (no `predict`, `judge` or
   * `ask`), since a link would carry the answers. A walk whose steps' prompts
   * carry an `answer` should set false.
   */
  linkAnswers?: boolean;
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
  /** Kept for one release: an `ask` overlay over the frame after the checkpoint. */
  predict?: ExplainerPredict<S>;
  prompts?: ExplainerPrompts<S>;
  /** A definition has a `simulation` or a `walk`, never both. */
  walk?: undefined;
  choose?: undefined;
  anchor?: undefined;
}

/** A choice the reader can make: a bare value (labelled like a predict option) or a value and its label. */
export type ChoiceOption<Choice extends string = string> = Choice | { value: Choice; label: string };

/** What a walk explainer offers at its choice points. */
export interface ExplainerChoose<S, Choice extends string> {
  /** The same options everywhere, or per step (called with the step on the playhead). */
  options: readonly ChoiceOption<Choice>[] | ((step: S) => readonly ChoiceOption<Choice>[]);
  /**
   * A choice read from a link, or null to reject the linked path. Default:
   * one of `options` when it is an array, any non-empty string otherwise.
   */
  parse?: (value: string) => Choice | null;
}

// As in graph.ts: inference skips this position (a NoInfer that works before TS 5.4).
type NoInferHere<T> = [T][T extends unknown ? 0 : never];

/**
 * An explainer over a walk (see `WalkSimulation`): the run stops at every
 * `await: true` step until the reader picks one of `choose.options`. The
 * path is replayed from (input, seed, choices), so it links and precomputes
 * like a simulation. No `predict`: the choices are already the question.
 */
export interface WalkExplainerDefinition<Input, S extends StepwiseStep, Choice extends string = string> {
  /** Used in error messages. */
  name?: string;
  /** Mark a choice point with `await: true` (steps are `WalkStep`s). */
  walk: WalkSimulation<Input, S & WalkStep, Choice>;
  seed?: number | string;
  maxSteps?: number;
  input: ExplainerInput<Input>;
  choose: ExplainerChoose<S, Choice>;
  /** Where the playhead stays when an input edit replays the walk (see useWalk). Default "key". */
  anchor?: "key" | "index";
  /** Prompt settings; the walk's choice points (and any `prompt` on a step) are its prompts. */
  prompts?: ExplainerPrompts<S & WalkStep>;
  simulation?: undefined;
  predict?: undefined;
}

/** Either kind of definition, as the kit and precompute take it. */
export type AnyExplainerDefinition<Input, S extends StepwiseStep> =
  | ExplainerDefinition<Input, S>
  | WalkExplainerDefinition<Input, S, string>;

export interface PrecomputedTrace<Input, S> {
  input: Input;
  seed: number;
  steps: S[];
  /** A walk's answered choices, in order (absent for a simulation). */
  choices?: string[];
}

/**
 * Freezes the definition itself (shallowly); the simulation and callbacks stay yours.
 *
 * Leave out `input` for an explainer with nothing to edit (a recorded
 * walkthrough): its input is `null`, and it takes no field props. A
 * simulation that reads an input must declare one.
 */
export function defineExplainer<S extends WalkStep, Choice extends string>(
  def: Omit<WalkExplainerDefinition<null, S, Choice>, "input" | "walk" | "choose"> & {
    walk: WalkSimulation<null, S, Choice>;
    choose: ExplainerChoose<S, NoInferHere<Choice>>;
    input?: undefined;
  }
): Readonly<WalkExplainerDefinition<null, S, Choice>>;
export function defineExplainer<Input, S extends WalkStep, Choice extends string>(
  def: Omit<WalkExplainerDefinition<Input, S, Choice>, "walk" | "choose"> & {
    walk: WalkSimulation<Input, S, Choice>;
    choose: ExplainerChoose<S, NoInferHere<Choice>>;
  }
): Readonly<WalkExplainerDefinition<Input, S, Choice>>;
export function defineExplainer<S extends StepwiseStep>(
  def: Omit<ExplainerDefinition<null, S>, "input"> & { input?: undefined }
): Readonly<ExplainerDefinition<null, S>>;
export function defineExplainer<Input, S extends StepwiseStep>(
  def: ExplainerDefinition<Input, S>
): Readonly<ExplainerDefinition<Input, S>>;
export function defineExplainer<Input, S extends StepwiseStep>(
  def: { input?: ExplainerInput<Input>; walk?: unknown; simulation?: unknown }
): Readonly<AnyExplainerDefinition<Input, S>> {
  // The types already forbid both; plain JS gets told at once.
  if (def.walk && def.simulation) throw new Error("[stepwise] defineExplainer: pass a simulation or a walk, not both.");
  return Object.freeze(
    (def.input ? def : { ...def, input: { default: null as Input } }) as AnyExplainerDefinition<Input, S>
  );
}

/**
 * The first non-JSON value under `value`, as a path and a kind; null when it
 * is all JSON. `ancestors` holds the objects on the current path: a value
 * that contains itself is a cycle (JSON.stringify would throw), while the same
 * object reached twice by different paths is fine (it is just copied).
 */
function findNonJson(value: unknown, path: string, ancestors = new Set<object>()): { path: string; kind: string } | null {
  if (value === null || typeof value === "boolean" || typeof value === "string") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : { path, kind: String(value) };
  if (typeof value !== "object") return { path, kind: typeof value };
  if (ancestors.has(value)) return { path, kind: "cycle" };
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        // A hole or undefined inside an array becomes null in JSON, which is a silent change.
        const bad =
          value[i] === undefined
            ? { path: `${path}[${i}]`, kind: "undefined" }
            : findNonJson(value[i], `${path}[${i}]`, ancestors);
        if (bad) return bad;
      }
      return null;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      const name = (proto as { constructor?: { name?: string } }).constructor?.name;
      return { path, kind: name || "object with a custom prototype" };
    }
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      // An undefined field is dropped by JSON.stringify, which round-trips to "absent": allowed.
      if (child === undefined) continue;
      const bad = findNonJson(child, `${path}.${key}`, ancestors);
      if (bad) return bad;
    }
    return null;
  } finally {
    ancestors.delete(value);
  }
}

/** A simulation (any iterable) as a walk: the values sent back are ignored. */
function asWalkOf<Input, S extends StepwiseStep>(sim: Simulation<Input, S>): WalkSimulation<Input, S & WalkStep, unknown> {
  return function* (input, ctx) {
    yield* sim(input, ctx) as Iterable<S & WalkStep>;
  };
}

const precomputeLabel = (def: { name?: string }) => `[stepwise] precompute(${JSON.stringify(def.name ?? "explainer")})`;

/**
 * Throws precompute's labelled error when `input` would not survive JSON. A
 * precomputed trace is plain JSON, input included, and anything keyed by the
 * input's JSON (a trace cache, a link) would otherwise conflate inputs that
 * stringify alike (NaN and null, a Map and {}).
 */
export function assertJsonInput(def: { name?: string }, input: unknown): void {
  const bad = findNonJson(input, "input");
  if (bad) throw new Error(`${precomputeLabel(def)}: ${bad.path} is not JSON-serializable (${bad.kind})`);
}

/**
 * Run a definition to a JSON-safe trace. Throws (with the definition's name)
 * when the simulation throws, hits `maxSteps`, or yields something that would
 * not survive being serialized, so a broken explainer fails the build instead
 * of shipping a trace the client then disagrees with.
 */
export function precompute<Input, S extends StepwiseStep>(
  def: AnyExplainerDefinition<Input, S>,
  input?: Input,
  /** A walk's choices to replay (ignored for a simulation). Default: none, the start of the walk. */
  choices?: readonly string[]
): PrecomputedTrace<Input, S> {
  const label = precomputeLabel(def);
  const used = input === undefined ? def.input.default : input;
  assertJsonInput(def, used);
  // Precompute the way the client will play it. A walk may end on an
  // unanswered choice point: that is where the reader starts. A simulation
  // with prompts or predict runs on prompts on the client (any iterable, sent
  // values ignored), so it stops at its first step prompt too. A plain
  // simulation plays through useSimulation, which runs to the end whatever its
  // steps look like, so it is precomputed whole.
  const prompted = Boolean(def.walk || def.prompts || def.predict);
  const run = def.walk
    ? runWalk(def.walk, used, { seed: def.seed, maxSteps: def.maxSteps, choices: choices ?? [] })
    : prompted
      ? runWalk(asWalkOf(def.simulation!), used, { seed: def.seed, maxSteps: def.maxSteps })
      : { ...runSimulation(def.simulation!, used, { seed: def.seed, maxSteps: def.maxSteps }), choicePoints: [] as number[], used: 0 };
  if (run.error !== null && run.error !== undefined) {
    const e = run.error;
    throw new Error(`${label}: simulation threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (run.truncated) {
    const cap = def.maxSteps ?? 10_000;
    const sincePrompt = prompted && run.steps.some((st) => isChoicePoint(st as WalkStep));
    throw new Error(
      sincePrompt
        ? `${label}: simulation hit maxSteps (${cap} steps since the last prompt); raise maxSteps or fix a non-terminating run`
        : `${label}: simulation hit maxSteps (${cap}); raise maxSteps or fix a non-terminating run`
    );
  }
  for (let i = 0; i < run.steps.length; i++) {
    const bad = findNonJson(run.steps[i], `steps[${i}]`);
    if (bad) throw new Error(`${label}: ${bad.path} is not JSON-serializable (${bad.kind})`);
  }
  if (def.walk) return { input: used, seed: run.seed, steps: run.steps, choices: (choices ?? []).slice(0, run.used) };
  // `choices` only where a prompt was met: a trace without one stays as it was.
  if (run.choicePoints.length > 0) return { input: used, seed: run.seed, steps: run.steps, choices: [] };
  return { input: used, seed: run.seed, steps: run.steps };
}

/**
 * Every prop name an explainer component takes for itself. None of them is
 * ever read as an input field, on the server (`precomputed`) or the client,
 * so both sides resolve the same input: a default with an `id` field keeps
 * its own `id` when the explainer gets `id="a"`. Override such a field with
 * `input={...}`.
 */
export const EXPLAINER_PROP_NAMES = [
  "definition",
  "view",
  "trace",
  "input",
  "id",
  "predict",
  "promptsEnabled",
  "keys",
  "link",
  "autoPlay",
  "theme",
  "className",
  "children",
] as const;

export type ExplainerPropName = (typeof EXPLAINER_PROP_NAMES)[number];

/**
 * The input fields an explainer component accepts as props: the own keys of
 * a plain-object input, minus the reserved prop names. Nothing for arrays and
 * primitives (pass `input` instead).
 *
 * A field prop only takes effect for a key present in the default input
 * value: an optional field the default leaves out is typed here but ignored
 * at runtime (pass `input` to set it). A field named like a reserved prop
 * (`id`, `link`, `theme`, ...) can't be overridden by a field prop either;
 * that name is always the prop. Use `input` for both.
 *
 * An input typed with an index signature (`Record<string, …>`) has no known
 * fields, so it gets no field props: mapped through `Omit`, its index
 * signature would claim every prop name, reserved ones included.
 */
export type FieldOverrides<Input> = Input extends readonly unknown[]
  ? {}
  : Input extends object
    ? string extends keyof Input
      ? {}
      : Partial<Omit<Input, ExplainerPropName>>
    : {};

const RESERVED = new Set<string>(EXPLAINER_PROP_NAMES);

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * `input` wins; otherwise own keys of a plain-object default are overridden
 * by same-named fields, except the reserved prop names (EXPLAINER_PROP_NAMES).
 */
export function resolveInput<Input>(
  def: { input: ExplainerInput<Input> },
  props?: { input?: Input } & Record<string, unknown>
): Input {
  if (props && props.input !== undefined) return props.input;
  const base = def.input.default;
  if (!props || !isPlainObject(base)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (!RESERVED.has(key) && props[key] !== undefined) out[key] = props[key];
  }
  return out as Input;
}

/** Bare strings become options with a capitalized label: "left" is { value: "left", label: "Left" }. */
export function normalizeOptions(options: readonly (string | PredictOption)[]): PredictOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o
  );
}
