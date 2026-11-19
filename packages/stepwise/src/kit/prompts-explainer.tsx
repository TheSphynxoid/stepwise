"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fail, normalizeOptions, pass, resolveInput, settledAnswer } from "../core";
import type {
  AnyExplainerDefinition,
  ExplainerPredict,
  ExplainerPrompts,
  PrecomputedTrace,
  Prompt as PromptDecl,
  Simulation,
  VerdictStatus,
  WalkExplainerDefinition,
  WalkStep,
} from "../core";
import type { StepwiseStep } from "../types";
import { usePrompts } from "../use-prompts";
import type { PromptsRun, PromptSource } from "../use-prompts";
import { choicesOf } from "../use-prompts-parts";
import type { SyncInputOptions } from "../use-simulation";
import type { TracePlayer } from "../use-trace";
import { Shell, hashKey, parseChoice, useReportError } from "./explainer";
import type { ExplainerProps, PredictApi, WalkApi } from "./explainer";

// The explainer over a definition that asks (`predict`, `prompts`): the
// usePrompts run, plus the adapters that keep PredictApi and WalkApi (and so
// Predict and Choices) working over it. Internal to the kit.

/**
 * Today's `predict` block as an `ask` overlay: a checkpoint is answered from
 * the frame after it, so the last frame (no successor) never asks.
 */
function predictAsk<S extends StepwiseStep>(def: ExplainerPredict<S>) {
  const options = normalizeOptions(def.options);
  return (step: S, frame: number, steps: readonly S[]): PromptDecl<string, S> | null => {
    const next = steps[frame + 1];
    if (next === undefined || !def.at(step, frame, next)) return null;
    const truth = def.truth(next, step);
    return {
      options,
      answer: truth,
      judge: (guess) => {
        const custom = truth === undefined ? undefined : def.feedback?.(guess, truth, step);
        return guess === truth ? pass(custom ?? "Right.") : fail(custom ?? "Not quite.");
      },
    };
  };
}

/**
 * An explainer whose definition asks (`predict` or `prompts`): a simulation
 * or a walk, on usePrompts. The answers link as `${id}.a` (a walk's as
 * `${id}.path`, its choices' key), next to the frame and the input: by
 * default only for a run without judged prompts (a link would carry the
 * answers), else when `prompts.linkAnswers` opts in.
 */
export function PromptsExplainer<Input, S extends StepwiseStep>(
  props: ExplainerProps<Input, S> & { definition: AnyExplainerDefinition<Input, S> }
) {
  const { definition, trace, id, link = true, autoPlay = false, promptsEnabled } = props;
  // Read once, at mount, like a live explainer's input (see LiveExplainer).
  const [input, setInputState] = useState<Input>(() =>
    resolveInput(definition, props as unknown as { input?: Input } & Record<string, unknown>)
  );
  const { serialize, parse } = definition.input;
  const syncInput: SyncInputOptions<Input> | undefined =
    link && serialize && parse ? { key: hashKey(id, "in"), serialize, parse, onRestore: setInputState } : undefined;
  const walkDef = definition.walk ? (definition as WalkExplainerDefinition<Input, S, string>) : null;
  const predictDef = walkDef ? undefined : definition.predict;
  const settings = (definition.prompts ?? {}) as ExplainerPrompts<S & WalkStep>;
  const ownAsk = settings.ask;
  const ask = useMemo(() => {
    const fromPredict = predictDef ? predictAsk(predictDef) : undefined;
    if (!ownAsk) return fromPredict as ExplainerPrompts<S & WalkStep>["ask"];
    if (!fromPredict) return ownAsk;
    return (step: S & WalkStep, frame: number, steps: readonly (S & WalkStep)[]) =>
      ownAsk(step, frame, steps) ?? (fromPredict(step, frame, steps) as PromptDecl<string, S & WalkStep> | null);
  }, [ownAsk, predictDef]);
  const chooseDef = walkDef?.choose;
  // Judged as far as the definition tells: a predict block, a judge, or an
  // overlay (whose prompts usually carry an answer).
  const judged = Boolean(predictDef || settings.judge || settings.ask);
  const linkAnswers = link && (settings.linkAnswers ?? !judged);
  // A step's own `prompt.options` are unknown until the walk is replayed, so
  // a walk's linked answer is checked against `choose` only by its own parse.
  const syncAnswers = !linkAnswers
    ? undefined
    : chooseDef
      ? {
          key: hashKey(id, "path"),
          serialize: (a: string) => a,
          parse: (v: string) => (chooseDef.parse ? chooseDef.parse(v) : v === "" ? null : v),
        }
      : { key: hashKey(id, "a"), serialize: (a: string) => a, parse: (v: string) => v };
  const source = (
    walkDef ? { simulation: walkDef.walk, input } : { simulation: definition.simulation as Simulation<Input, S>, input }
  ) as PromptSource<Input, S & WalkStep, string>;
  const run = usePrompts<Input, S & WalkStep, string>(source, {
    seed: definition.seed,
    maxSteps: definition.maxSteps,
    anchor: walkDef?.anchor,
    initialTrace: trace as PrecomputedTrace<Input, S & WalkStep> | undefined,
    autoPlay,
    syncHash: link ? hashKey(id, "frame") : undefined,
    syncInput,
    syncAnswers,
    ask,
    judge: settings.judge,
    navigation: settings.navigation,
    autoContinue: settings.autoContinue,
    // The walk shortcut keeps a walk's choices free (Settled in review 1).
    retries: settings.retries ?? (walkDef ? Infinity : undefined),
    onInputChange: settings.onInputChange ?? (walkDef ? "keep" : undefined),
    enabled: promptsEnabled,
    // A `predict` block starts off (predict mode, as before); `prompts` start on.
    defaultEnabled: props.predict ?? !predictDef,
  });
  useReportError(definition.name, run.error);
  const { requestInput, respond, proceed, record, active } = run;
  const setInput = useCallback(
    (next: Input | ((prev: Input) => Input)) => void requestInput(() => setInputState(next)),
    [requestInput]
  );

  // A prompt that is gone while playback holds on it (prompts turned off, an
  // input edit moved it): nothing is left to wait for.
  const { held, release } = run.player;
  useEffect(() => {
    if (held !== null && !active) release();
  }, [held, active, release]);

  // The picked option, kept until Check; cleared at every new prompt and trace.
  const [guess, setGuessState] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const guessRef = useRef(guess);
  guessRef.current = guess;
  const activeFrame = active?.frame ?? null;
  useEffect(() => {
    setGuessState(null);
    setNudge(false);
  }, [activeFrame, run.steps]);
  const setGuess = useCallback((value: string) => {
    setGuessState(value);
    setNudge(false);
  }, []);
  const check = useCallback(() => {
    const g = guessRef.current;
    setNudge(g === null);
    if (g !== null) respond(g);
  }, [respond]);

  // The run with the kit's feedback: the nudge, or the hint after a miss while a retry remains.
  const hint = predictDef?.hint;
  const entry = active?.entry;
  const showHint = Boolean(hint) && run.status === "fail" && entry !== undefined && !entry.settled;
  const runFeedback = run.feedback;
  const feedback = useMemo<ReactNode>(
    () =>
      nudge ? (
        "Pick an answer first."
      ) : showHint ? (
        <>
          {runFeedback} {hint}
        </>
      ) : (
        runFeedback
      ),
    [nudge, showHint, runFeedback, hint]
  );
  const promptsApi = useMemo(
    () => ({ ...run, feedback }) as unknown as PromptsRun<S & WalkStep, string>,
    [run, feedback]
  );

  // A walk's choices, over the run (Choices draws them).
  const step = run.step;
  const walkOptions = useMemo(() => {
    if (!chooseDef) return [];
    const raw = typeof chooseDef.options === "function" ? (step ? chooseDef.options(step) : []) : chooseDef.options;
    return normalizeOptions(raw);
  }, [chooseDef, step]);
  const recordRef = useRef(record);
  recordRef.current = record;
  const choiceAt = useCallback((frame: number) => {
    const e = recordRef.current.entries.find((x) => x.frame === frame && x.source === "generator");
    return e?.settled && e.status !== "skipped" ? settledAnswer(e) : undefined;
  }, []);
  const choices = useMemo(() => choicesOf(record) as string[], [record]);
  const asking = active?.entry.source === "generator";
  const last = run.steps[run.steps.length - 1] as (S & WalkStep) | undefined;
  const awaiting =
    walkDef !== null && last !== undefined && (last.await === true || last.prompt !== undefined) &&
    choiceAt(run.steps.length - 1) === undefined;
  const walkApi = useMemo<WalkApi | null>(
    () => (walkDef ? { choices, choose: respond, choiceAt, asking, awaiting, options: walkOptions } : null),
    [walkDef, choices, respond, choiceAt, asking, awaiting, walkOptions]
  );

  const options = useMemo(
    () => (active?.prompt.options ? normalizeOptions(active.prompt.options) : walkOptions),
    [active, walkOptions]
  );
  const status: VerdictStatus | null = nudge
    ? "fail"
    : run.status === "pass" || run.status === "fail" || run.status === "pending"
      ? run.status
      : null;
  const attempts = entry?.attempts.length ?? 0;
  const { enabled, setEnabled } = run;
  const predictApi = useMemo<PredictApi>(
    () => ({
      enabled,
      setEnabled,
      held: active !== null,
      options,
      guess,
      setGuess,
      check,
      status,
      feedback,
      attempts,
      release: proceed,
    }),
    [enabled, setEnabled, active, options, guess, setGuess, check, status, feedback, attempts, proceed]
  );

  return (
    <Shell
      {...props}
      sim={run as unknown as TracePlayer<S> & { steps: readonly S[] }}
      input={input}
      setInput={setInput}
      editable={!run.inputLocked}
      error={run.error}
      truncated={run.truncated}
      promptsApi={promptsApi}
      predictApi={predictApi}
      walkApi={walkApi}
      toggleable={promptsEnabled === undefined && ask !== undefined}
    />
  );
}
