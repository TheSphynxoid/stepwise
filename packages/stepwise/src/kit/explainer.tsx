"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../cn";
import { normalizeOptions, resolveInput } from "../core";
import type {
  AnyExplainerDefinition,
  ExplainerDefinition,
  FieldOverrides,
  PrecomputedTrace,
  PredictOption,
  VerdictStatus,
  WalkExplainerDefinition,
  WalkSimulation,
  WalkStep,
} from "../core";
import { defaultTheme, type StepwiseTheme } from "../theme";
import { useGlobalKeys } from "../use-global-keys";
import type { PromptsRun } from "../use-prompts";
import { useSimulation } from "../use-simulation";
import type { SyncInputOptions } from "../use-simulation";
import { useTrace } from "../use-trace";
import type { TracePlayer } from "../use-trace";
import { useWalk } from "../use-walk";
import type { SyncChoicesOptions } from "../use-walk";
import type { StepwiseStep } from "../types";
import { Choices, EndNote, ExplainerBar, Narration, Stage, StepCode } from "./parts";
import { StepParts } from "./step-parts";
import { Predict } from "./predict";
import { PromptsExplainer } from "./prompts-explainer";
import { activate, isActive, register } from "./registry";

// The explainer kit: one provider around useSimulation (useWalk for a walk,
// useTrace for a recorded run) plus flat part components that read it from
// context. An
// author writes a definition and a view; the shell, the player wiring, the
// hash links and the layout come from here. Parts are flat PascalCase
// components with serializable props, so they compose from MDX as well.

export interface ExplainerProps<Input, S extends StepwiseStep> {
  /** What to simulate or walk. Omitted: a recorded-only explainer that plays `trace`. */
  definition?: AnyExplainerDefinition<Input, S>;
  /** Draws the current frame; it takes no props and calls `useExplainer()`. */
  view: ComponentType;
  /** A precomputed run (see `precompute`): the first render needs no simulation. */
  trace?: PrecomputedTrace<Input, S>;
  /** Replaces the default input. On a component from createExplainer, fields of an object default can also be passed as props. */
  input?: Input;
  /** Hash namespace: `${id}.frame`, `${id}.in` (and `${id}.path` for a walk's choices). Needed for two explainers on one page. */
  id?: string;
  /**
   * Ask the definition's overlay prompts (`predict`, `prompts.ask`). Read once, at mount: the starting state of
   * the reader's toggle (PredictToggle). Default: off for a `predict` block, on for `prompts`.
   */
  predict?: boolean;
  /** Overlay prompts forced on (an exam) or off, with no reader toggle. Generator prompts are always on. */
  promptsEnabled?: boolean;
  /** Keyboard shortcuts (arrows, Space), once the reader has clicked or focused this explainer. Default true. */
  keys?: boolean;
  /** Keep the frame (and the input, when the definition can serialize it) in the URL hash. Default true. */
  link?: boolean;
  /** Default false. */
  autoPlay?: boolean;
  theme?: StepwiseTheme;
  className?: string;
  /** Replaces the default layout (Stage, Narration, Choices, Predict, StepCode, ExplainerBar, EndNote). */
  children?: ReactNode;
}

/**
 * The props of a component made by createExplainer: every ExplainerProps
 * except the two it binds, plus the default input's fields (typed from the
 * input; a field named like a reserved prop is overridden through `input`).
 */
export type ExplainerInstanceProps<Input, S extends StepwiseStep> = Omit<ExplainerProps<Input, S>, "definition" | "view"> &
  FieldOverrides<Input>;

/**
 * The question on the playhead, for custom parts: a thin layer over
 * `ExplainerApi.prompts` that holds the picked option until Check. Kept one
 * release under its predict-mode name. Functions are stable.
 */
export interface PredictApi {
  /** Overlay prompts (checkpoints) ask only while enabled. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** The playhead is on a prompt. */
  held: boolean;
  /** The prompt's options (a walk's choice point: the definition's `choose.options`). */
  options: readonly PredictOption[];
  /** The picked option's value; cleared at every new prompt. */
  guess: string | null;
  setGuess: (value: string) => void;
  /** Answer with the guess (`prompts.respond`); without one, only says "Pick an answer first." */
  check: () => void;
  /** null until answered. */
  status: VerdictStatus | null;
  /** The verdict's feedback, with the definition's hint after a miss while a retry remains. */
  feedback: ReactNode;
  attempts: number;
  /** Once the prompt is settled: move on (`prompts.proceed`). */
  release: () => void;
}

/** A walk explainer's choices, exposed to custom parts (the `Choices` part draws them). Functions are stable. */
export interface WalkApi<Choice extends string = string> {
  /** The answers given so far, in order. With the input, they are the walk. */
  choices: readonly Choice[];
  /** Answer the choice point on the playhead (see useWalk's `choose`: a new answer cuts off the old future). */
  choose: (choice: Choice) => void;
  /** The answer given at `frame`, if it is an answered choice point. */
  choiceAt: (frame: number) => Choice | undefined;
  /** The playhead is on a choice point (answered or not). */
  asking: boolean;
  /** The path ends on a choice point with no answer yet. */
  awaiting: boolean;
  /** The definition's options for the step on the playhead, labelled. */
  options: readonly { value: Choice; label: string }[];
}

export interface ExplainerApi<Input = unknown, S extends StepwiseStep = StepwiseStep> {
  sim: TracePlayer<S> & { steps: readonly S[] };
  /** The frame to render (frame 0 before start; undefined for an empty trace). */
  step: S | undefined;
  input: Input;
  /** Stable. A no-op (with a dev warning) when the explainer is not editable. */
  setInput: (next: Input | ((prev: Input) => Input)) => void;
  /** True when there is a definition to re-run and its input isn't locked by answers (see `prompts.inputLocked`). */
  editable: boolean;
  /** What the simulation threw (the trace keeps the steps before it); null when it ran clean, and for a recorded explainer. */
  error: unknown;
  /** The run hit `maxSteps` and was cut short. Always false for a recorded explainer. */
  truncated: boolean;
  /** EXPERIMENTAL. The prompts run (see `usePrompts`); null unless the definition has `predict` or `prompts`. */
  prompts: PromptsRun<S & WalkStep, string> | null;
  /** Non-null whenever `prompts` is. */
  predict: PredictApi | null;
  /** null unless the definition is a walk. */
  walk: WalkApi | null;
  id: string | undefined;
  theme: StepwiseTheme;
}

const ExplainerContext = createContext<ExplainerApi<unknown, StepwiseStep> | null>(null);
// Whether PredictToggle has something to toggle: overlay prompts, not forced on or off.
const ToggleContext = createContext(false);
/** For PredictToggle (internal). */
export const usePromptsToggle = (): boolean => useContext(ToggleContext);
// The view lives apart from the api: it is the author's component, not state.
const ViewContext = createContext<ComponentType | null>(null);

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

export function useExplainer<Input = unknown, S extends StepwiseStep = StepwiseStep>(): ExplainerApi<Input, S> {
  const api = useContext(ExplainerContext);
  if (!api) {
    throw new Error("useExplainer must be used inside <Explainer> (or a component made by createExplainer).");
  }
  return api as unknown as ExplainerApi<Input, S>;
}

/** For Stage: the view the provider was given. */
export function useExplainerView(): ComponentType {
  const view = useContext(ViewContext);
  if (!view) {
    throw new Error("useExplainer must be used inside <Explainer> (or a component made by createExplainer).");
  }
  return view;
}

export const hashKey = (id: string | undefined, key: string) => (id ? `${id}.${key}` : key);

/**
 * The explainer shell: runs `definition` (or plays a recorded `trace`) and
 * provides it to the parts. Without children it renders the default layout.
 *
 *   <Explainer definition={sorting} view={Bars} trace={precomputed} />
 */
export function Explainer<Input, S extends StepwiseStep>(props: ExplainerProps<Input, S>): ReactElement {
  // One component per kind, because hooks can't be conditional: a live run
  // needs input state and a simulation, a walk the same plus its choices, a
  // recorded one only a player.
  const def = props.definition;
  if (def && (def.prompts || def.predict)) return <PromptsExplainer {...props} definition={def} />;
  if (def?.walk) return <WalkExplainer {...props} definition={def} />;
  if (def) return <LiveExplainer {...props} definition={def as ExplainerDefinition<Input, S>} />;
  if (!props.trace) throw new Error("createExplainer without a definition needs a `trace` prop.");
  return <RecordedExplainer {...props} trace={props.trace} />;
}

function LiveExplainer<Input, S extends StepwiseStep>(
  props: ExplainerProps<Input, S> & { definition: ExplainerDefinition<Input, S> }
) {
  const { definition, trace, id, link = true, autoPlay = false } = props;
  // Input props are read once, at mount: a page that re-renders with a new
  // but equal literal must neither recompute nor wipe the reader's edits.
  // resolveInput never reads a reserved prop name as a field, the same rule
  // `precomputed` applies on the server, so both sides resolve one input.
  const [input, setInputState] = useState<Input>(() =>
    resolveInput(definition, props as unknown as { input?: Input } & Record<string, unknown>)
  );
  const { serialize, parse } = definition.input;
  const syncInput: SyncInputOptions<Input> | undefined =
    link && serialize && parse ? { key: hashKey(id, "in"), serialize, parse, onRestore: setInputState } : undefined;
  const sim = useSimulation(definition.simulation, input, {
    seed: definition.seed,
    maxSteps: definition.maxSteps,
    initialTrace: trace,
    autoPlay,
    syncHash: link ? hashKey(id, "frame") : undefined,
    syncInput,
  });
  useReportError(definition.name, sim.error);
  // useState's setter is already stable; the wrapper only pins the type.
  const setInput = useCallback((next: Input | ((prev: Input) => Input)) => setInputState(next), []);
  return (
    <Shell
      {...props}
      sim={sim}
      input={input}
      setInput={setInput}
      editable
      error={sim.error}
      truncated={sim.truncated}
    />
  );
}

function WalkExplainer<Input, S extends StepwiseStep>(
  props: ExplainerProps<Input, S> & { definition: WalkExplainerDefinition<Input, S, string> }
) {
  const { definition, trace, id, link = true, autoPlay = false } = props;
  // Read once, at mount, like a live explainer's input (see LiveExplainer).
  const [input, setInputState] = useState<Input>(() =>
    resolveInput(definition, props as unknown as { input?: Input } & Record<string, unknown>)
  );
  const { serialize, parse } = definition.input;
  const syncInput: SyncInputOptions<Input> | undefined =
    link && serialize && parse ? { key: hashKey(id, "in"), serialize, parse, onRestore: setInputState } : undefined;
  const { choose: chooseDef } = definition;
  const syncChoices: SyncChoicesOptions<string> | undefined = link
    ? { key: hashKey(id, "path"), serialize: (c) => c, parse: (v) => parseChoice(chooseDef, v) }
    : undefined;
  const walk = useWalk(definition.walk as WalkSimulation<Input, S & WalkStep, string>, input, {
    seed: definition.seed,
    maxSteps: definition.maxSteps,
    anchor: definition.anchor,
    initialTrace: trace as PrecomputedTrace<Input, S & WalkStep> | undefined,
    // A precomputed trace may already be partway down the walk.
    choices: trace?.choices,
    autoPlay,
    syncHash: link ? hashKey(id, "frame") : undefined,
    syncInput,
    syncChoices,
  });
  useReportError(definition.name, walk.error);
  const setInput = useCallback((next: Input | ((prev: Input) => Input)) => setInputState(next), []);
  const step = walk.step;
  const options = useMemo(() => {
    const raw = typeof chooseDef.options === "function" ? (step ? chooseDef.options(step) : []) : chooseDef.options;
    return normalizeOptions(raw);
  }, [chooseDef, step]);
  const asking = walk.choicePoints.includes(walk.frame);
  const { choices, choose, choiceAt, awaiting } = walk;
  const walkApi = useMemo<WalkApi>(
    () => ({ choices, choose, choiceAt, asking, awaiting, options }),
    [choices, choose, choiceAt, asking, awaiting, options]
  );
  return (
    <Shell
      {...props}
      sim={walk as unknown as TracePlayer<S> & { steps: readonly S[] }}
      input={input}
      setInput={setInput}
      editable
      error={walk.error}
      truncated={walk.truncated}
      walkApi={walkApi}
    />
  );
}

/** A choice read from a link: one of the options when they are a list, any non-empty string otherwise. */
export function parseChoice<S extends StepwiseStep>(def: WalkExplainerDefinition<unknown, S, string>["choose"], value: string): string | null {
  if (def.parse) return def.parse(value);
  if (typeof def.options === "function") return value === "" ? null : value;
  return normalizeOptions(def.options).some((o) => o.value === value) ? value : null;
}

/**
 * A simulation that throws leaves a short trace and no other sign. In dev,
 * say so once per distinct error, so an author sees why the run stops early.
 */
export function useReportError(name: string | undefined, error: unknown) {
  const logged = useRef<unknown>(null);
  useEffect(() => {
    if (!isDev || error === null || error === undefined || logged.current === error) return;
    logged.current = error;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stepwise] ${name ?? "explainer"}: the simulation threw: ${message}`);
  }, [name, error]);
}

function RecordedExplainer<Input, S extends StepwiseStep>(
  props: ExplainerProps<Input, S> & { trace: PrecomputedTrace<Input, S> }
) {
  const { trace, id, link = true, autoPlay = false } = props;
  const player = useTrace(trace.steps, { autoPlay, syncHash: link ? hashKey(id, "frame") : undefined });
  const sim = useMemo(() => ({ ...player, steps: trace.steps }), [player, trace.steps]);
  const setInput = useCallback(() => {
    if (isDev) {
      console.warn(
        "[stepwise] Explainer: setInput has no effect on a recorded-only explainer (no `definition` to re-run)."
      );
    }
  }, []);
  return (
    <Shell
      {...props}
      sim={sim}
      input={trace.input}
      setInput={setInput}
      editable={false}
      error={null}
      truncated={false}
    />
  );
}

export function Shell<Input, S extends StepwiseStep>({
  sim,
  input,
  setInput,
  editable,
  error,
  truncated,
  id,
  keys = true,
  link = true,
  theme = defaultTheme,
  view,
  className,
  children,
  promptsApi = null,
  predictApi = null,
  walkApi = null,
  toggleable = false,
}: ExplainerProps<Input, S> &
  Omit<ExplainerApi<Input, S>, "step" | "prompts" | "predict" | "walk" | "id" | "theme"> & {
    promptsApi?: PromptsRun<S & WalkStep, string> | null;
    predictApi?: PredictApi | null;
    walkApi?: WalkApi | null;
    toggleable?: boolean;
  }) {
  const step = sim.step;
  // One keyboard, many explainers: the registry says which one owns it.
  const token = useRef<object>({});
  // An explainer without keys takes no part in routing (it never becomes the
  // active one), but still counts for the shared-namespace warning.
  useEffect(() => register(token.current, link ? (id ?? "") : null, keys), [id, link, keys]);
  const { next, prev, toggle, start } = sim.player;
  useGlobalKeys(
    {
      ArrowRight: () => next(),
      ArrowLeft: () => prev(),
      // A walk is stepped, not played: Space there stays the page's.
      ...(walkApi ? {} : { " ": () => toggle(start) }),
    },
    { enabled: () => keys && isActive(token.current) }
  );
  const claimKeys = useCallback(() => activate(token.current), []);
  const api = useMemo<ExplainerApi<Input, S>>(
    () => ({
      sim,
      step,
      input,
      setInput,
      editable,
      error,
      truncated,
      prompts: promptsApi,
      predict: predictApi,
      walk: walkApi,
      id,
      theme,
    }),
    [sim, step, input, setInput, editable, error, truncated, promptsApi, predictApi, walkApi, id, theme]
  );
  return (
    <ExplainerContext.Provider value={api as unknown as ExplainerApi<unknown, StepwiseStep>}>
      <ToggleContext.Provider value={toggleable}>
      <StepParts source={sim} theme={theme} controls={walkApi ? "step" : "full"}>
      <ViewContext.Provider value={view}>
        <section
          data-stepwise=""
          data-explainer={id ?? ""}
          className={cn("flex flex-col gap-3", className)}
          onPointerDownCapture={claimKeys}
          onFocusCapture={claimKeys}
        >
          {children ?? (
            <>
              <Stage />
              <Narration />
              {/* A plain walk asks through its choices; a run on prompts through Prompt. */}
              {walkApi && !promptsApi ? <Choices /> : <Predict />}
              <StepCode />
              <ExplainerBar />
              <EndNote />
            </>
          )}
        </section>
      </ViewContext.Provider>
      </StepParts>
      </ToggleContext.Provider>
    </ExplainerContext.Provider>
  );
}

/**
 * Bind a definition and a view into one component, so a page (or an MDX
 * file) renders `<Sorting />` and passes only serializable props. The
 * default input's fields are props too: with a default of `{ n: 3 }`,
 * `<Count n={5} />` runs on `{ n: 5 }`.
 *
 *   export const Sorting = createExplainer({ definition: sorting, view: Bars });
 */
export function createExplainer<Input, S extends StepwiseStep>(cfg: {
  definition?: AnyExplainerDefinition<Input, S>;
  view: ComponentType;
}): ComponentType<ExplainerInstanceProps<Input, S>> {
  function BoundExplainer(props: ExplainerInstanceProps<Input, S>) {
    return <Explainer<Input, S> {...props} definition={cfg.definition} view={cfg.view} />;
  }
  BoundExplainer.displayName = `Explainer(${cfg.definition?.name ?? cfg.view.displayName ?? cfg.view.name ?? "view"})`;
  return BoundExplainer;
}
