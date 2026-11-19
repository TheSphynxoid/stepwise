"use client";

import { useEffect, useMemo, useRef } from "react";
import { createRng, createWalkSession, diffTraces, isChoicePoint, stepKey } from "./core";
import type { TraceDiff, WalkResult, WalkSession, WalkSimulation, WalkStep } from "./core";
import { inputPart, useRunLinks } from "./use-run-links";
import type { LinkPart } from "./use-run-links";
import { safeJson, useRebuiltInputWarning } from "./use-simulation";
import { useTrace } from "./use-trace";
import type { TracePlayer } from "./use-trace";
import type { WalkOptions } from "./use-walk";

// Internal: the run under useWalk (and the prompts hook). It owns the walk
// session, the precomputed path, the player and the input link; the caller
// owns the choices and anything else it links (`links`, restored together
// with the input, before the linked frame).

export interface WalkRunSettings<S extends WalkStep, Input, Choice>
  extends Omit<WalkOptions<S, Input, Choice>, "choices" | "syncChoices"> {
  /** More linked parts (the caller's choices), restored with the input. */
  links?: readonly (LinkPart<unknown> | null)[];
  /** The public hook's name, for dev warnings. */
  hookName?: string;
  /** Warn about an input rebuilt every render (default true; off when the caller builds the input). */
  rebuiltInputWarning?: boolean;
}

export interface WalkRunState<S extends WalkStep> {
  result: WalkResult<S>;
  trace: TracePlayer<S>;
  /** What the last re-run changed (see `diffTraces`); null before the first. */
  lastChange: TraceDiff | null;
}

interface SessionSlot<Input, S extends WalkStep, Choice> {
  simulation: WalkSimulation<Input, S, Choice>;
  input: Input;
  seed: number | string | undefined;
  maxSteps: number | undefined;
  session: WalkSession<S, Choice>;
}

const indexKey = (_: unknown, i: number) => String(i);

export function useWalkRun<Input, S extends WalkStep, Choice>(
  simulation: WalkSimulation<Input, S, Choice>,
  input: Input,
  choices: readonly (Choice | undefined)[],
  opts: WalkRunSettings<S, Input, Choice>
): WalkRunState<S> {
  const { seed, maxSteps, syncInput, anchor = "key", keyOf, holdAt, initialTrace, links, hookName = "useWalk", rebuiltInputWarning = true, ...traceOpts } =
    opts;
  // As in useSimulation: a precomputed path stands in for the run while the
  // input matches by content, and here the choices too (by value).
  const initialRef = useRef(initialTrace);
  initialRef.current = initialTrace;
  const traceJson = useRef<{ trace: unknown; json: string | undefined }>({ trace: undefined, json: undefined });
  // The live session, keyed by everything but the choices. It's a pure
  // function of the choices fed so far, so a double-invoked memo or a
  // discarded render can't put it out of step: at worst it replays.
  const slot = useRef<SessionSlot<Input, S, Choice> | null>(null);
  const result: WalkResult<S> = useMemo(() => {
    const t = initialRef.current;
    if (t && createRng(seed ?? 0).seed === t.seed && sameChoices(t.choices ?? [], choices)) {
      if (traceJson.current.trace !== t) traceJson.current = { trace: t, json: safeJson(t.input) };
      const json = traceJson.current.json;
      if (json !== undefined && json === safeJson(input)) return pathOf(t.steps, choices.length, t.seed);
    }
    let s = slot.current;
    if (!s || s.simulation !== simulation || !Object.is(s.input, input) || s.seed !== seed || s.maxSteps !== maxSteps) {
      s?.session.close();
      s = { simulation, input, seed, maxSteps, session: createWalkSession(simulation, input, { seed, maxSteps }) };
      slot.current = s;
    }
    return s.session.run(choices);
    // initialTrace is read through a ref: it seeds a matching run, it is not a trigger.
  }, [simulation, input, seed, maxSteps, choices]);
  // Unmount: let the live generator's finally blocks run. After StrictMode's
  // simulated unmount the closed session just replays on the next answer.
  useEffect(() => () => slot.current?.session.close(), []);
  const resultRef = useRef(result);
  resultRef.current = result;

  const keyFn = anchor === "index" ? indexKey : keyOf;
  const trace = useTrace(result.steps, {
    ...traceOpts,
    keyOf: keyFn,
    // The unanswered choice point at the end is a checkpoint.
    holdAt: (f, step) => {
      const r = resultRef.current;
      return (r.awaiting && f === r.steps.length - 1) || (holdAt?.(f, step) ?? false);
    },
  });
  useRebuiltInputWarning(rebuiltInputWarning ? input : null, hookName);

  // What the last re-run changed, paired the same way the playhead anchors.
  const diffKey = keyFn ?? (result.steps.some((s) => stepKey(s) !== undefined) ? stepKey : undefined);
  const changeRef = useRef<{ steps: readonly S[]; change: TraceDiff | null }>({ steps: result.steps, change: null });
  if (changeRef.current.steps !== result.steps) {
    changeRef.current = {
      steps: result.steps,
      change: diffTraces(changeRef.current.steps, result.steps, { keyOf: diffKey }),
    };
  }

  // Declared after useTrace: the linked frame lands after re-anchoring.
  useRunLinks([inputPart(syncInput, input), ...(links ?? [])], traceOpts.syncHash, trace.player.jump);

  return { result, trace, lastChange: changeRef.current.change };
}

function sameChoices(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((c, i) => Object.is(c, b[i]));
}

/** The WalkResult a precomputed path stands for: its choice points are the steps that are ones. */
function pathOf<S extends WalkStep>(steps: S[], answered: number, seed: number): WalkResult<S> {
  const choicePoints: number[] = [];
  steps.forEach((s, i) => {
    if (isChoicePoint(s)) choicePoints.push(i);
  });
  const awaiting = choicePoints.length > answered;
  return { steps, choicePoints, awaiting, used: choicePoints.length - (awaiting ? 1 : 0), truncated: false, error: null, seed };
}
