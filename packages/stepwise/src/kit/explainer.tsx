"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../cn";
import { fail, normalizeOptions, pass, resolveInput } from "../core";
import type {
  ExplainerDefinition,
  ExplainerPredict,
  PrecomputedTrace,
  PredictOption,
  VerdictStatus,
} from "../core";
import { defaultTheme, type StepwiseTheme } from "../theme";
import { useEvaluator } from "../use-evaluator";
import { useSimulation } from "../use-simulation";
import type { SyncInputOptions } from "../use-simulation";
import { useTrace } from "../use-trace";
import type { TracePlayer } from "../use-trace";
import type { StepwiseStep } from "../types";
import { EndNote, ExplainerBar, Narration, Stage, StepCode } from "./parts";
import { Predict } from "./predict";

// The explainer kit: one provider around useSimulation (or useTrace, for a
// recorded run) plus flat part components that read it from context. An
// author writes a definition and a view; the shell, the player wiring, the
// hash links and the layout come from here. Parts are flat PascalCase
// components with serializable props, so they compose from MDX as well.

export interface ExplainerProps<Input, S extends StepwiseStep> {
  /** What to simulate. Omitted: a recorded-only explainer that plays `trace`. */
  definition?: ExplainerDefinition<Input, S>;
  /** Draws the current frame; it takes no props and calls `useExplainer()`. */
  view: ComponentType;
  /** A precomputed run (see `precompute`): the first render needs no simulation. */
  trace?: PrecomputedTrace<Input, S>;
  /** Replaces the default input. Same-named fields of an object default can also be passed as props. */
  input?: Input;
  /** Hash namespace: `${id}.frame`, `${id}.in`. Needed for two explainers on one page. */
  id?: string;
  /** Stop at the definition's checkpoints and ask the reader. Read once, at mount: it is predict mode's starting state. */
  predict?: boolean;
  /** Keyboard shortcuts. Default true. */
  keys?: boolean;
  /** Keep the frame (and the input, when the definition can serialize it) in the URL hash. Default true. */
  link?: boolean;
  /** Default false. */
  autoPlay?: boolean;
  theme?: StepwiseTheme;
  className?: string;
  /** Replaces the default layout (Stage, Narration, Predict, StepCode, ExplainerBar, EndNote). */
  children?: ReactNode;
}

/** Predict mode's state, exposed to custom parts. Functions are stable. */
export interface PredictApi {
  /** Checkpoints hold autoplay only while enabled. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Playback is parked on a checkpoint, waiting for a guess. */
  held: boolean;
  options: readonly PredictOption[];
  /** The chosen option's value; cleared at every new checkpoint. */
  guess: string | null;
  setGuess: (value: string) => void;
  /** Grade the guess against the frame after the held one. */
  check: () => void;
  /** null until checked (and after the guess changes). */
  status: VerdictStatus | null;
  /** The verdict's feedback, with the definition's hint after two failed attempts. */
  feedback: ReactNode;
  attempts: number;
  /** Leave the checkpoint and resume playing. */
  release: () => void;
}

export interface ExplainerApi<Input = unknown, S extends StepwiseStep = StepwiseStep> {
  sim: TracePlayer<S> & { steps: readonly S[] };
  /** The frame to render (frame 0 before start; undefined for an empty trace). */
  step: S | undefined;
  input: Input;
  /** Stable. A no-op (with a dev warning) when the explainer is not editable. */
  setInput: (next: Input | ((prev: Input) => Input)) => void;
  /** True when there is a definition to re-run. */
  editable: boolean;
  predict: PredictApi | null;
  id: string | undefined;
  theme: StepwiseTheme;
}

const ExplainerContext = createContext<ExplainerApi<unknown, StepwiseStep> | null>(null);
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

// Every ExplainerProps name. Anything else a createExplainer component
// receives is a candidate input field (see resolveInput), so these must never
// be read as one: an object default with an `id` field keeps its own `id`.
const KNOWN_PROPS = new Set<string>([
  "definition",
  "view",
  "trace",
  "input",
  "id",
  "predict",
  "keys",
  "link",
  "autoPlay",
  "theme",
  "className",
  "children",
]);

const hashKey = (id: string | undefined, key: string) => (id ? `${id}.${key}` : key);

/**
 * The explainer shell: runs `definition` (or plays a recorded `trace`) and
 * provides it to the parts. Without children it renders the default layout.
 *
 *   <Explainer definition={sorting} view={Bars} trace={precomputed} />
 */
export function Explainer<Input, S extends StepwiseStep>(props: ExplainerProps<Input, S>): ReactElement {
  // Two components, because hooks can't be conditional: a live run needs
  // input state and a simulation, a recorded one only a player.
  if (props.definition) return <LiveExplainer {...props} definition={props.definition} />;
  if (!props.trace) throw new Error("createExplainer without a definition needs a `trace` prop.");
  return <RecordedExplainer {...props} trace={props.trace} />;
}

function LiveExplainer<Input, S extends StepwiseStep>(
  props: ExplainerProps<Input, S> & { definition: ExplainerDefinition<Input, S> }
) {
  const { definition, trace, id, link = true, autoPlay = false } = props;
  // Input props are read once, at mount: a page that re-renders with a new
  // but equal literal must neither recompute nor wipe the reader's edits.
  const [input, setInputState] = useState<Input>(() => {
    const fields: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!KNOWN_PROPS.has(key)) fields[key] = (props as unknown as Record<string, unknown>)[key];
    }
    return resolveInput(definition, { ...fields, input: props.input });
  });
  const { serialize, parse } = definition.input;
  const syncInput: SyncInputOptions<Input> | undefined =
    link && serialize && parse ? { key: hashKey(id, "in"), serialize, parse, onRestore: setInputState } : undefined;
  // The `predict` prop is the starting state only; the reader owns it after.
  const [predictOn, setPredictOn] = useState(() => Boolean(props.predict));
  const predictDef = definition.predict;
  const sim = useSimulation(definition.simulation, input, {
    seed: definition.seed,
    maxSteps: definition.maxSteps,
    initialTrace: trace,
    autoPlay,
    syncHash: link ? hashKey(id, "frame") : undefined,
    syncInput,
    holdAt: predictDef
      ? (frame, step) => predictOn && step !== undefined && predictDef.at(step, frame)
      : undefined,
  });
  // useState's setter is already stable; the wrapper only pins the type.
  const setInput = useCallback((next: Input | ((prev: Input) => Input)) => setInputState(next), []);
  const predict = usePredict(predictDef, sim, predictOn, setPredictOn);
  return <Shell {...props} sim={sim} input={input} setInput={setInput} editable predictApi={predict} />;
}

/**
 * Predict mode over a live run: the guess, its verdict and the checkpoint
 * controls. Always called (hooks can't be conditional); null without a
 * predict block in the definition.
 */
function usePredict<S extends StepwiseStep>(
  def: ExplainerPredict<S> | undefined,
  sim: { steps: readonly S[]; player: TracePlayer<S>["player"] },
  enabled: boolean,
  setEnabled: (on: boolean) => void
): PredictApi | null {
  const { steps, player } = sim;
  const heldFrame = player.held;
  const { release } = player;
  const [guess, setGuessState] = useState<string | null>(null);
  const options = useMemo(() => (def ? normalizeOptions(def.options) : []), [def]);

  // The truth is the frame after the held one: the trace already knows what
  // happens next, so grading needs nothing from the author but `truth`.
  const answer = useEvaluator(
    (g: string | null) => {
      if (g === null) return fail("Pick an answer first.");
      const heldStep = heldFrame === null ? undefined : steps[heldFrame];
      if (!def || heldStep === undefined) return fail("Not quite.");
      const truth = def.truth(steps[heldFrame! + 1], heldStep);
      const custom = truth === undefined ? undefined : def.feedback?.(g, truth, heldStep);
      return g === truth ? pass(custom ?? "Right.") : fail(custom ?? "Not quite.");
    },
    guess,
    { mode: "manual" }
  );
  const { check: checkAnswer, reset: resetAnswer, status: answerStatus, attempts } = answer;

  // Every checkpoint is a fresh question: no carried-over guess or attempts.
  // A new trace is too: an input edit while held re-anchors onto the same
  // index (so `heldFrame` doesn't change), but the next frame, and with it
  // the truth, may differ.
  useEffect(() => {
    setGuessState(null);
    resetAnswer();
  }, [heldFrame, steps, resetAnswer]);

  // Turning predict off while parked on a checkpoint cancels the question.
  useEffect(() => {
    if (!enabled && heldFrame !== null) release();
  }, [enabled, heldFrame, release]);

  const setGuess = useCallback((value: string) => setGuessState(value), []);
  const check = useCallback(() => void checkAnswer(), [checkAnswer]);

  const status = answerStatus === "idle" ? null : answerStatus;
  const hint = def?.hint;
  const showHint = status === "fail" && attempts >= 2 && Boolean(hint);
  const verdictFeedback = answer.feedback;
  // Memoized: a fresh fragment per render would churn the api object.
  const feedback = useMemo<ReactNode>(
    () =>
      showHint ? (
        <>
          {verdictFeedback} {hint}
        </>
      ) : (
        verdictFeedback
      ),
    [showHint, verdictFeedback, hint]
  );
  const held = heldFrame !== null;

  const api = useMemo<PredictApi>(
    () => ({ enabled, setEnabled, held, options, guess, setGuess, check, status, feedback, attempts, release }),
    [enabled, setEnabled, held, options, guess, setGuess, check, status, feedback, attempts, release]
  );
  return def ? api : null;
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
  return <Shell {...props} sim={sim} input={trace.input} setInput={setInput} editable={false} />;
}

function Shell<Input, S extends StepwiseStep>({
  sim,
  input,
  setInput,
  editable,
  id,
  theme = defaultTheme,
  view,
  className,
  children,
  predictApi = null,
}: ExplainerProps<Input, S> &
  Omit<ExplainerApi<Input, S>, "step" | "predict" | "id" | "theme"> & { predictApi?: PredictApi | null }) {
  const step = sim.step;
  const api = useMemo<ExplainerApi<Input, S>>(
    () => ({ sim, step, input, setInput, editable, predict: predictApi, id, theme }),
    [sim, step, input, setInput, editable, predictApi, id, theme]
  );
  return (
    <ExplainerContext.Provider value={api as unknown as ExplainerApi<unknown, StepwiseStep>}>
      <ViewContext.Provider value={view}>
        <section data-stepwise="" data-explainer={id ?? ""} className={cn("flex flex-col gap-3", className)}>
          {children ?? (
            <>
              <Stage />
              <Narration />
              <Predict />
              <StepCode />
              <ExplainerBar />
              <EndNote />
            </>
          )}
        </section>
      </ViewContext.Provider>
    </ExplainerContext.Provider>
  );
}

/**
 * Bind a definition and a view into one component, so a page (or an MDX
 * file) renders `<Sorting />` and passes only serializable props. Unknown
 * props are input fields: with a default of `{ n: 3 }`, `<Count n={5} />`
 * runs on `{ n: 5 }`.
 *
 *   export const Sorting = createExplainer({ definition: sorting, view: Bars });
 */
export function createExplainer<Input, S extends StepwiseStep>(cfg: {
  definition?: ExplainerDefinition<Input, S>;
  view: ComponentType;
}): ComponentType<Omit<ExplainerProps<Input, S>, "definition" | "view"> & Record<string, unknown>> {
  function BoundExplainer(props: Omit<ExplainerProps<Input, S>, "definition" | "view"> & Record<string, unknown>) {
    return <Explainer<Input, S> {...props} definition={cfg.definition} view={cfg.view} />;
  }
  BoundExplainer.displayName = `Explainer(${cfg.definition?.name ?? cfg.view.displayName ?? cfg.view.name ?? "view"})`;
  return BoundExplainer;
}
