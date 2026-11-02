"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { diffTraces } from "./diff-traces";
import type { TraceDiff } from "./diff-traces";
import { stepKey } from "./reanchor";
import { runWalk } from "./walk";
import type { WalkResult, WalkSimulation, WalkStep } from "./walk";
import { inputPart, useRunLinks } from "./use-run-links";
import { useRebuiltInputWarning } from "./use-simulation";
import type { SimulationOptions, SimulationPlayer } from "./use-simulation";
import { useTrace } from "./use-trace";

/** Keep the choices in the URL hash (`#path=a.b.a`), so a link replays the same walk. */
export interface SyncChoicesOptions<Choice> {
  /** Hash key for the choices. Must differ from `syncHash` and `syncInput.key`. */
  key: string;
  /** One choice → a URL-safe string. */
  serialize: (choice: Choice) => string;
  /** String → choice, or null to reject (the whole linked path is then ignored). */
  parse: (value: string) => Choice | null;
}

export interface WalkOptions<S extends WalkStep, Input, Choice> extends SimulationOptions<S, Input> {
  /** Choices to start with (read once, on mount). */
  choices?: readonly Choice[];
  /**
   * Where the playhead stays when the input changes and the walk is
   * replayed: on the step with the same `key` (default), or at the same
   * index, for walks where step i means "after i inputs" (`fromGraph`).
   */
  anchor?: "key" | "index";
  /** Deep-link the choices (see `SyncChoicesOptions`). Restored with `syncInput`, before the frame. */
  syncChoices?: SyncChoicesOptions<Choice>;
}

export interface WalkPlayer<S extends WalkStep, Choice> extends SimulationPlayer<S> {
  /** The choices made so far, in order. With the input, they are the walk. */
  choices: readonly Choice[];
  /** Indices of the choice points on the path. */
  choicePoints: readonly number[];
  /** The path ends on a choice point waiting for `choose`. Playback holds there. */
  awaiting: boolean;
  /**
   * Answer the choice point the playhead is on. At the end of the path the
   * walk continues; on an earlier choice point a different answer cuts off
   * the old future and replays from there (the same answer keeps it). The
   * playhead moves to the step after the choice point, and playback that
   * was held there resumes. Off a choice point, nothing happens.
   */
  choose: (choice: Choice) => void;
  /** The answer given at `frame`, if it's an answered choice point. */
  choiceAt: (frame: number) => Choice | undefined;
  /** What the last re-run changed (see `diffTraces`); null before the first. */
  lastChange: TraceDiff | null;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
const indexKey = (_: unknown, i: number) => String(i);

/**
 * A walk: a simulation that branches on the reader's choices (see
 * `WalkSimulation`). Like `useSimulation`, plus `choose`. The path is
 * replayed from (input, seed, choices) on every change, so it stays pure:
 * links, re-anchoring and StrictMode behave exactly as for simulations.
 *
 *   const walk = useWalk(lesson, input, { autoPlay: true });
 *   {walk.awaiting && walk.frame === walk.steps.length - 1 && (
 *     <button onClick={() => walk.choose("first")}>First element</button>
 *   )}
 *   <PlayerBar player={walk.player} toneAt={walk.toneAt} titleAt={walk.titleAt} />
 */
export function useWalk<Input, S extends WalkStep, Choice>(
  simulation: WalkSimulation<Input, S, Choice>,
  input: Input,
  opts?: WalkOptions<S, Input, Choice>
): WalkPlayer<S, Choice> {
  const {
    seed,
    maxSteps,
    syncInput,
    syncChoices,
    choices: initialChoices,
    anchor = "key",
    keyOf,
    holdAt,
    ...traceOpts
  } = opts ?? {};
  const [choices, setChoices] = useState<readonly Choice[]>(() => initialChoices ?? []);
  const result: WalkResult<S> = useMemo(
    () => runWalk(simulation, input, { seed, maxSteps, choices }),
    [simulation, input, seed, maxSteps, choices]
  );
  const resultRef = useRef(result);
  resultRef.current = result;
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

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
  useRebuiltInputWarning(input, "useWalk");

  // What the last re-run changed, paired the same way the playhead anchors.
  const diffKey = keyFn ?? (result.steps.some((s) => stepKey(s) !== undefined) ? stepKey : undefined);
  const changeRef = useRef<{ steps: readonly S[]; change: TraceDiff | null }>({ steps: result.steps, change: null });
  if (changeRef.current.steps !== result.steps) {
    changeRef.current = {
      steps: result.steps,
      change: diffTraces(changeRef.current.steps, result.steps, { keyOf: diffKey }),
    };
  }
  const lastChange = changeRef.current.change;

  // Declared after useTrace: the linked frame lands after re-anchoring.
  const { jump, release } = trace.player;
  useRunLinks(
    [
      inputPart(syncInput, input),
      syncChoices
        ? {
            key: syncChoices.key,
            read: (raw) => parsePath(raw, syncChoices.parse),
            write: (v) => serializePath(v as readonly Choice[], syncChoices.serialize),
            value: choices,
            restore: (v) => setChoices(v as readonly Choice[]),
          }
        : null,
    ],
    traceOpts.syncHash,
    jump
  );

  const frameRef = useRef(trace.frame);
  frameRef.current = trace.frame;
  const heldRef = useRef(trace.player.held);
  heldRef.current = trace.player.held;
  // After a choice, the playhead moves past the choice point once the new
  // path has rendered (re-anchoring alone would keep it on the choice point).
  const pending = useRef<{ choices: readonly Choice[]; frame: number } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const p = pending.current;
    if (!p || p.choices !== choices) return;
    pending.current = null;
    jump(p.frame);
  }, [choices, jump]);

  const choose = useCallback(
    (choice: Choice) => {
      const f = frameRef.current;
      const ord = resultRef.current.choicePoints.indexOf(f);
      if (ord < 0) {
        if (isDev) console.warn("[stepwise] useWalk: choose() called off a choice point; ignored.");
        return;
      }
      const prev = choicesRef.current;
      const resume = heldRef.current === f;
      if (ord < prev.length && Object.is(prev[ord], choice)) {
        // The same answer: the future is unchanged, just move into it.
        if (resume) release();
        jump(f + 1);
        return;
      }
      const next = [...prev.slice(0, ord), choice];
      pending.current = { choices: next, frame: f + 1 };
      setChoices(next);
      if (resume) release();
    },
    [jump, release]
  );

  const choiceAt = useCallback((frame: number) => {
    const ord = resultRef.current.choicePoints.indexOf(frame);
    return ord >= 0 && ord < choicesRef.current.length ? choicesRef.current[ord] : undefined;
  }, []);

  return useMemo(
    () => ({
      ...trace,
      steps: result.steps,
      truncated: result.truncated,
      error: result.error,
      seed: result.seed,
      choices,
      choicePoints: result.choicePoints,
      awaiting: result.awaiting,
      choose,
      choiceAt,
      lastChange,
    }),
    [trace, result, choices, choose, choiceAt, lastChange]
  );
}

// Choices in the hash: each serialized and URI-encoded (dots too), joined by ".".
function serializePath<Choice>(choices: readonly Choice[], serialize: (c: Choice) => string): string {
  return choices.map((c) => encodeURIComponent(serialize(c)).replace(/\./g, "%2E")).join(".");
}

function parsePath<Choice>(raw: string, parse: (v: string) => Choice | null): readonly Choice[] | null {
  if (raw === "") return [];
  const out: Choice[] = [];
  for (const part of raw.split(".")) {
    let value: string;
    try {
      value = decodeURIComponent(part);
    } catch {
      return null;
    }
    const c = parse(value);
    if (c === null) return null;
    out.push(c);
  }
  return out;
}
