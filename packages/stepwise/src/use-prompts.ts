"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EMPTY_RECORD, applyAnswer, canAnswer, reachEntry, retriesLeft as retriesLeftOf, scoreOf } from "./core";
import { sameSteps, settledAnswer, skipEntry, stepKey, structuralEqual, toVerdict, truncateAfter } from "./core";
import type { EntryStatus, EvaluatorResult, Prompt, PromptContext, PromptEntry, PromptRecord } from "./core";
import type { PromptScore, PromptSpec, Simulation, Verdict, WalkSimulation, WalkStep } from "./core";
import type { SimulationPlayer } from "./use-simulation";
import type { WalkOptions } from "./use-walk";
import { useWalkRun } from "./use-walk-run";
import type { LinkPart } from "./use-run-links";
import { STEPS_WALK, asWalk, choicesOf, entryAt, inputChangeOf, isLocked, linkedAnswersOf } from "./use-prompts-parts";
import { parseAnswers, remapRecord, restoreStep, sameList, serializeAnswers } from "./use-prompts-parts";
import type { Feedback, Found, InputChange, Judge, Judged, Restore } from "./use-prompts-parts";

// Prompts: "the reader answers at a step". One answer record (./core
// prompts.ts) fed from two declarations: a generator step's `prompt` (the
// answer is the value of that `yield`, so it can branch the run) and an
// `ask` overlay (any trace; the answer changes nothing downstream). The hook
// owns the record, judging, the gate, the input lock and the answer link;
// the run under it is useWalkRun.

export type PromptSource<Input, S extends WalkStep, A> =
  | { steps: readonly S[] }
  | { simulation: Simulation<Input, S> | WalkSimulation<Input, S, A>; input: Input };

export interface PromptsOptions<Input, S extends WalkStep, A>
  extends Omit<WalkOptions<S, Input, A>, "choices" | "syncChoices" | "stopAt"> {
  /** Overlay prompts: a prompt for a frame, or null. `steps` is the trace (on a walk, the path so far). */
  ask?: (step: S, frame: number, steps: readonly S[]) => Prompt<A, S> | null;
  /** Judges every prompt that has no `judge` of its own (generator prompts get theirs here). May be async. */
  judge?: (answer: A, prompt: PromptSpec<A>, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>;
  /** Changes allowed after the first answer (default 0; a prompt's own `retries` wins). */
  retries?: number;
  /** "gate" (default): forward moves stop at an unsettled prompt. "free": they pass it, and it counts as skipped. */
  navigation?: "gate" | "free";
  /** Move on as soon as a prompt settles (default false: wait for `proceed`). */
  autoContinue?: boolean;
  /** Controlled: overlay prompts on or off. Generator prompts are always on. */
  enabled?: boolean;
  /** Uncontrolled starting value of `enabled` (default true). */
  defaultEnabled?: boolean;
  /** Whether the reader may toggle prompts (uncontrolled only; default true). */
  readerToggle?: boolean;
  /**
   * What an input change does to the answers. "lock": once the reader has
   * answered, the input is locked (`inputLocked`, `requestInput`) until
   * `restart()`. "clear": the answers and score are cleared. "keep": answers
   * stay, by position (generator prompts) or id (overlay prompts), and
   * overlay verdicts are judged again against the new trace. Default: "lock"
   * once a judged prompt is reached, else "keep".
   */
  onInputChange?: InputChange;
  /**
   * Deep-link the answers (`#key=a.b..c`, a skipped prompt is empty), so a
   * link replays the run up to its frame. Restored with `syncInput`, before
   * the frame. A value `parse` rejects drops the whole list.
   */
  syncAnswers?: { key: string; serialize: (a: A) => string; parse: (v: string) => A | null };
}

export interface ActivePrompt<A, S> {
  prompt: Prompt<A, S>;
  entry: PromptEntry<A>;
  frame: number;
}

export interface PromptsRun<S extends WalkStep, A> extends SimulationPlayer<S> {
  /** The prompt at the playhead, with its entry (a fresh "open" one until reached). */
  active: ActivePrompt<A, S> | null;
  /** The active entry's status, "pending" while its judge runs; null off a prompt. */
  status: EntryStatus | "pending" | null;
  /** The active entry's last verdict feedback. */
  feedback: ReactNode;
  /** What the active entry's judge threw, if it did (the answer counted as a miss). */
  judgeError: unknown;
  retriesLeft: number;
  /** Once the active entry is settled (not skipped): the right answer, if known, and `explain`. */
  revealed: { answer: A | undefined; explain: unknown } | null;
  /** Answer the prompt at the playhead. Off a prompt, or once final, ignored. */
  respond: (answer: A) => void;
  /** Leave the prompt at the playhead unanswered (navigation "free" only). */
  skip: () => void;
  /** Once the active prompt is settled: release a hold, or step on (at the end, finish the run). */
  proceed: () => void;
  /** Clear every answer and the score, unlock the input; the playhead returns to frame 0. */
  restart: () => void;
  enabled: boolean;
  /** The reader's toggle: ignored when `enabled` is controlled, or while the input is locked. */
  setEnabled: (on: boolean) => void;
  canToggle: boolean;
  /** Under "lock", true once the reader has answered: views disable their input. */
  inputLocked: boolean;
  /** Run an input change (`() => setInput(x)`) unless the input is locked; returns whether it ran. */
  requestInput: (apply: () => void) => boolean;
  record: PromptRecord<A>;
  score: PromptScore;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

/**
 * Ask the reader at a step: predict what happens next, a running quiz, a
 * story that branches on the answers. Prompts come from the run's steps
 * (`prompt` on a yielded step, or `await: true`) or from `ask`; answers are
 * recorded, judged (`prompt.judge`, else `judge`, else equality with
 * `prompt.answer`, else unjudged) and scored. Forward moves stop at an
 * unsettled prompt, and playback holds there.
 *
 *   const run = usePrompts({ simulation: bubble, input }, { ask: (step, f, steps) =>
 *     step.kind === "compare" ? { options: ["swap", "keep"], answer: steps[f + 1].kind } : null });
 *   {run.active && <Options onPick={run.respond} />}
 *   {run.revealed && <button onClick={run.proceed}>Continue</button>}
 *   <Editor disabled={run.inputLocked} onChange={(x) => run.requestInput(() => setInput(x))} />
 */
export function usePrompts<Input, S extends WalkStep, A = string>(
  source: PromptSource<Input, S, A>,
  opts?: PromptsOptions<Input, S, A>
): PromptsRun<S, A> {
  const {
    ask,
    judge,
    retries,
    navigation = "gate",
    autoContinue = false,
    enabled: enabledProp,
    defaultEnabled = true,
    readerToggle = true,
    onInputChange,
    syncAnswers,
    holdAt,
    ...runOpts
  } = opts ?? {};

  // Live settings, read by the stable callbacks.
  const live = useRef({ ask, judge, retries, navigation, autoContinue, holdAt, onInputChange });
  live.current = { ask, judge, retries, navigation, autoContinue, holdAt, onInputChange };
  const [enabledState, setEnabledState] = useState(defaultEnabled);
  const enabled = enabledProp ?? enabledState;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const controlledRef = useRef(enabledProp !== undefined);
  controlledRef.current = enabledProp !== undefined;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  // A steps array with the same steps (object or key at each index) is the
  // same trace: keep the old one, so nothing reruns (invariant 10a).
  const keyFn = (runOpts.keyOf ?? stepKey) as (s: S, i: number) => string | undefined;
  const isSteps = "steps" in source;
  const stableSteps = useRef<readonly S[] | null>(null);
  if (isSteps && (stableSteps.current === null || !sameSteps(stableSteps.current, source.steps, keyFn))) {
    stableSteps.current = source.steps;
  }
  // For a steps source, the steps are the input (Input is unused there).
  const simulation = (isSteps ? STEPS_WALK : asWalk(source.simulation)) as unknown as WalkSimulation<Input, S, A>;
  const input = (isSteps ? stableSteps.current : source.input) as Input;

  // The record. Event handlers compute from the ref and commit both.
  const [record, setRecord] = useState<PromptRecord<A>>(EMPTY_RECORD);
  const recordRef = useRef(record);
  const commit = useCallback((rec: PromptRecord<A>) => {
    if (rec === recordRef.current) return;
    recordRef.current = rec;
    setRecord(rec);
  }, []);
  const choicesRef = useRef<readonly (A | undefined)[]>([]);
  const nextChoices = choicesOf(record);
  if (!sameList(choicesRef.current, nextChoices)) choicesRef.current = nextChoices;

  // The prompt at a frame, overlays included whatever `enabled` says, cached
  // per (trace, ask). Links and the "keep" remap resolve prompts this way, so
  // the record and the link format never depend on `enabled`.
  const stepsRef = useRef<readonly S[]>([]);
  const cache = useRef<{ steps: unknown; ask: unknown; map: Map<number, Found<A, S> | null> }>({
    steps: null,
    ask: null,
    map: new Map(),
  });
  const warnedBoth = useRef(false);
  const anyPromptAt = useCallback((f: number): Found<A, S> | null => {
    const steps = stepsRef.current;
    const step = steps[f];
    if (!step) return null;
    const c = cache.current;
    const a = live.current.ask;
    if (c.steps !== steps || c.ask !== a) cache.current = { steps, ask: a, map: new Map() };
    const map = cache.current.map;
    if (map.has(f)) return map.get(f)!;
    const spec = step.prompt ?? (step.await === true ? {} : undefined);
    const overlay = a ? a(step, f, steps) : null;
    let found: Found<A, S> | null = null;
    if (spec) {
      if (overlay && isDev && !warnedBoth.current) {
        warnedBoth.current = true;
        console.warn(
          `[stepwise] usePrompts: frame ${f} has both a generator prompt and an \`ask\` prompt; the generator's wins.`
        );
      }
      found = { prompt: spec as Prompt<A, S>, source: "generator", id: spec.id ?? stepKey(step) ?? String(f) };
    } else if (overlay) {
      found = { prompt: overlay, source: "overlay", id: overlay.id ?? stepKey(step) ?? String(f) };
    }
    map.set(f, found);
    return found;
  }, []);
  /** The prompt the reader meets at a frame: overlays only while enabled (off, they neither show nor gate). */
  const promptAt = useCallback(
    (f: number): Found<A, S> | null => {
      const found = anyPromptAt(f);
      return found?.source === "overlay" && !enabledRef.current ? null : found;
    },
    [anyPromptAt]
  );

  const judgeOf = useCallback((prompt: Prompt<A, S>): Judge<A, S> | null => {
    if (prompt.judge) return prompt.judge;
    const j = live.current.judge;
    if (j) return (answer, ctx) => j(answer, prompt, ctx);
    if (prompt.answer !== undefined) return (answer) => structuralEqual(answer, prompt.answer);
    return null;
  }, []);

  const reach = useCallback(
    (rec: PromptRecord<A>, f: number, found: Found<A, S>) =>
      reachEntry(rec, {
        id: found.id,
        frame: f,
        source: found.source,
        judged: judgeOf(found.prompt) !== null,
        retries: found.prompt.retries ?? live.current.retries ?? 0,
      }),
    [judgeOf]
  );

  /** True when frame f has no prompt, or its entry is settled. */
  const settledAt = useCallback(
    (f: number) => {
      const found = promptAt(f);
      return !found || entryAt(recordRef.current, f, found.id)?.settled === true;
    },
    [promptAt]
  );
  const stopAt = useCallback((f: number) => live.current.navigation === "gate" && !settledAt(f), [settledAt]);
  const holdAtRun = useCallback(
    (f: number, step: S | undefined) => !settledAt(f) || (live.current.holdAt?.(f, step) ?? false),
    [settledAt]
  );

  // The answer link. Its value keeps one identity while its text is the
  // same; while a link is restored it stays put, then shows the restored list
  // for one commit (the run links compare by identity before applying the
  // linked frame).
  const restoreRef = useRef<Restore<A> | null>(null);
  const linkText = syncAnswers ? serializeAnswers(linkedAnswersOf(record), syncAnswers.serialize) : "";
  const linkRef = useRef<{ text: string; value: readonly (A | undefined)[]; pinned: "set" | "shown" | null }>({
    text: linkText,
    value: linkedAnswersOf(record),
    pinned: null,
  });
  if (linkRef.current.pinned === "set") linkRef.current.pinned = "shown";
  else if (linkRef.current.pinned === null && !restoreRef.current && linkRef.current.text !== linkText) {
    linkRef.current = { text: linkText, value: linkedAnswersOf(record), pinned: null };
  }

  // Judging state: feedback per frame, the one verdict in flight, and the
  // record generation (bumped by restart, input changes and links) a late
  // verdict must still match.
  const [feedback, setFeedback] = useState<Feedback>({});
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const [pending, setPending] = useState<number | null>(null);
  const pendingRef = useRef<{ token: object; frame: number } | null>(null);
  const generation = useRef(0);
  const loggedErrors = useRef(new Set<string>());
  const continueAfter = useRef<PromptRecord<A> | null>(null);
  const restarting = useRef(false);
  const warnedLock = useRef(false);

  /** Drop whatever is in flight: a pending verdict, an auto-continue. */
  const dropInFlight = useCallback(() => {
    generation.current++;
    pendingRef.current = null;
    continueAfter.current = null;
    setPending(null);
  }, []);

  const startRestore = useCallback(
    (answers: readonly (A | undefined)[]) => {
      dropInFlight();
      setFeedback({});
      restoreRef.current = { answers, next: 0, frame: 0 };
      commit(EMPTY_RECORD as PromptRecord<A>);
      rerender();
    },
    [dropInFlight, commit]
  );

  const { result, trace } = useWalkRun(simulation, input, choicesRef.current, {
    ...runOpts,
    holdAt: holdAtRun,
    stopAt,
    hookName: "usePrompts",
    rebuiltInputWarning: !isSteps,
    links: [
      syncAnswers
        ? ({
            key: syncAnswers.key,
            read: (raw) => parseAnswers(raw, syncAnswers.parse),
            write: (v) => serializeAnswers(v as readonly (A | undefined)[], syncAnswers.serialize),
            value: linkRef.current.value,
            restore: (v) => startRestore(v as readonly (A | undefined)[]),
          } satisfies LinkPart<unknown>)
        : null,
    ],
  });
  stepsRef.current = result.steps;
  const { player } = trace;
  const { release, next, setPlaying, reset, jump } = player;
  const frame = trace.frame;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const heldRef = useRef(player.held);
  heldRef.current = player.held;

  const reportError = useCallback((e: unknown) => {
    const key = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    if (!isDev || loggedErrors.current.has(key)) return;
    loggedErrors.current.add(key);
    console.error("[stepwise] usePrompts: a judge threw; the answer counts as a miss.", e);
  }, []);

  /** Judge an answer now (restoring, re-judging): "async" when the judge returns a promise. */
  const judgeNow = useCallback(
    (found: Found<A, S>, answer: A, f: number): Judged => {
      const judgeFn = judgeOf(found.prompt);
      if (!judgeFn) return { verdict: null, error: null };
      const steps = stepsRef.current;
      let out: EvaluatorResult | Promise<EvaluatorResult>;
      try {
        out = judgeFn(answer, { step: steps[f], frame: f, steps });
      } catch (e) {
        reportError(e);
        return { verdict: { status: "fail" }, error: e };
      }
      if (typeof (out as Promise<EvaluatorResult>)?.then === "function") {
        (out as Promise<EvaluatorResult>).then(undefined, () => {});
        return "async";
      }
      return { verdict: toVerdict(out as EvaluatorResult), error: null };
    },
    [judgeOf, reportError]
  );

  const proceed = useCallback(() => {
    const f = frameRef.current;
    if (!settledAt(f)) return;
    if (heldRef.current !== null) release();
    else if (f >= stepsRef.current.length - 1) setPlaying(true); // the timer ends the run
    else next();
  }, [settledAt, release, next, setPlaying]);

  // Record an answer's outcome at f. A changed answer to a generator prompt
  // re-branches the run: the entries after it describe the old future.
  const settle = useCallback(
    (f: number, entry: PromptEntry<A>, answer: A, verdict: Verdict | null, error: unknown) => {
      if (verdict?.status === "pending") {
        setFeedback((m) => ({ ...m, [f]: { feedback: verdict.feedback, error: null } }));
        return;
      }
      let rec = applyAnswer(recordRef.current, f, answer, verdict ? (verdict.status as "pass" | "fail") : null);
      const after = entryAt(rec, f, entry.id);
      if (!after) {
        if (isDev) console.warn(`[stepwise] usePrompts: the entry for "${entry.id}" at frame ${f} is gone; answer dropped.`);
        return;
      }
      let dropFeedback = false;
      if (entry.source === "generator" && entry.settled && !Object.is(settledAnswer(entry), settledAnswer(after))) {
        rec = truncateAfter(rec, f);
        dropFeedback = true;
      }
      setFeedback((m) => {
        const out: typeof m = {};
        for (const k of Object.keys(m)) if (!dropFeedback || Number(k) <= f) out[Number(k)] = m[Number(k)];
        out[f] = { feedback: verdict?.feedback, error };
        return out;
      });
      if (after.settled && live.current.autoContinue) continueAfter.current = rec;
      commit(rec);
    },
    [commit]
  );

  const respond = useCallback(
    (answer: A) => {
      const f = frameRef.current;
      const found = f >= 0 ? promptAt(f) : null;
      if (!found) {
        if (isDev) console.warn("[stepwise] usePrompts: respond() called with no prompt at the playhead; ignored.");
        return;
      }
      if (pendingRef.current?.frame === f) return; // a verdict for this prompt is on its way
      const rec = reach(recordRef.current, f, found);
      const entry = entryAt(rec, f, found.id);
      if (!entry) {
        if (isDev) console.warn(`[stepwise] usePrompts: no record entry for prompt "${found.id}" at frame ${f}; ignored.`);
        return;
      }
      if (!canAnswer(entry)) return; // final: nothing left to change
      commit(rec);
      const judgeFn = judgeOf(found.prompt);
      if (!judgeFn) {
        settle(f, entry, answer, null, null);
        return;
      }
      const steps = stepsRef.current;
      let out: EvaluatorResult | Promise<EvaluatorResult>;
      try {
        out = judgeFn(answer, { step: steps[f], frame: f, steps });
      } catch (e) {
        reportError(e);
        settle(f, entry, answer, { status: "fail" }, e);
        return;
      }
      if (typeof (out as Promise<EvaluatorResult>)?.then !== "function") {
        settle(f, entry, answer, toVerdict(out as EvaluatorResult), null);
        return;
      }
      // Async: dropped if the record was restarted, the trace changed, the
      // entry changed, or another answer took its place in flight.
      const token = {};
      const gen = generation.current;
      pendingRef.current = { token, frame: f };
      setPending(f);
      const finish = (verdict: Verdict, error: unknown) => {
        if (pendingRef.current?.token !== token) return;
        pendingRef.current = null;
        setPending(null);
        if (generation.current !== gen || stepsRef.current !== steps) return;
        if (entryAt(recordRef.current, f, found.id) !== entry) return;
        settle(f, entry, answer, verdict, error);
      };
      (out as Promise<EvaluatorResult>).then(
        (r) => finish(toVerdict(r), null),
        (e) => {
          reportError(e);
          finish({ status: "fail" }, e);
        }
      );
    },
    [promptAt, reach, commit, judgeOf, settle, reportError]
  );

  const skip = useCallback(() => {
    if (live.current.navigation !== "free") {
      if (isDev) console.warn('[stepwise] usePrompts: skip() needs navigation: "free"; ignored.');
      return;
    }
    const f = frameRef.current;
    const found = f >= 0 ? promptAt(f) : null;
    if (!found) {
      if (isDev) console.warn("[stepwise] usePrompts: skip() called with no prompt at the playhead; ignored.");
      return;
    }
    commit(skipEntry(reach(recordRef.current, f, found), f));
  }, [promptAt, reach, commit]);

  const restart = useCallback(() => {
    dropInFlight();
    restoreRef.current = null;
    warnedLock.current = false;
    setFeedback({});
    // Clearing answers replays the run: jump again once it's on screen, or
    // re-anchoring moves the playhead onto the old path's nearest step. (An
    // empty record replays nothing, and commits nothing to wait for.)
    if (recordRef.current.entries.length > 0) restarting.current = true;
    commit(EMPTY_RECORD as PromptRecord<A>);
    reset();
    jump(0);
  }, [dropInFlight, commit, reset, jump]);

  const setEnabled = useCallback((on: boolean) => {
    if (controlledRef.current || isLocked(recordRef.current, live.current.onInputChange)) return;
    setEnabledState(on);
  }, []);

  const requestInput = useCallback((apply: () => void) => {
    if (isLocked(recordRef.current, live.current.onInputChange)) {
      if (isDev && !warnedLock.current) {
        warnedLock.current = true;
        console.warn("[stepwise] usePrompts: the input is locked while answers count; restart() unlocks it. Change ignored.");
      }
      return false;
    }
    apply();
    return true;
  }, []);

  // A new input: under "clear" the answers go; otherwise they follow the new
  // trace, generator entries by position (the session was fed them so), overlay
  // entries by id, with overlay verdicts judged again. ("lock" lands here only
  // before the first answer, or when the page changed the input anyway.)
  const prevInput = useRef(input);
  useIsomorphicLayoutEffect(() => {
    if (Object.is(prevInput.current, input)) return;
    prevInput.current = input;
    dropInFlight();
    if (inputChangeOf(recordRef.current, live.current.onInputChange) === "clear") {
      setFeedback({});
      commit(EMPTY_RECORD as PromptRecord<A>);
      return;
    }
    // Null when nothing moved: a trace that only looks new (a page rebuilding
    // keyless steps each render) must not commit (React #185).
    const out = remapRecord(recordRef.current, feedbackRef.current, stepsRef.current.length, anyPromptAt, judgeNow);
    if (!out) return;
    setFeedback(out.feedback);
    commit(out.record);
  }, [input]);

  // Restore linked answers: walk the trace from frame 0, giving each prompt
  // the next answer (a generator's continues the path, which arrives with the
  // next commit). Stops at an answer that leaves its prompt unsettled.
  useIsomorphicLayoutEffect(() => {
    const r = restoreRef.current;
    if (!r) return;
    const before = recordRef.current;
    const out = restoreStep(r, before, stepsRef.current.length, anyPromptAt, reach, judgeNow);
    if (Object.keys(out.feedback).length > 0) setFeedback((m) => ({ ...m, ...out.feedback }));
    commit(out.record);
    if (out.waiting && out.record !== before && r.next < r.answers.length) return;
    restoreRef.current = null;
    if (syncAnswers) {
      linkRef.current = { text: serializeAnswers(r.answers, syncAnswers.serialize), value: r.answers, pinned: "set" };
    }
    rerender();
  });

  // Reach the prompt at the playhead. Under "free", prompts the playhead
  // moved forward past without an answer count as skipped.
  const found = frame >= 0 ? promptAt(frame) : null;
  const prevFrame = useRef<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const prev = prevFrame.current;
    prevFrame.current = frame;
    // Mid-restart the frame on screen is the old path's anchor, not where the
    // reader is; mid-restore the record is being rebuilt from a link.
    if (frame < 0 || restarting.current || restoreRef.current) return;
    let rec = recordRef.current;
    if (live.current.navigation === "free" && prev !== null && prev >= 0 && frame > prev) {
      for (let f = prev; f < frame; f++) {
        const p = promptAt(f);
        if (p) rec = skipEntry(reach(rec, f, p), f);
      }
    }
    if (found) rec = reach(rec, frame, found);
    commit(rec);
  }, [frame, found, record, promptAt, reach, commit]);

  // After every commit: finish a restart, then move on after an
  // auto-continued settle; a restored link shown for its one commit gives way
  // to the record's own value.
  useIsomorphicLayoutEffect(() => {
    if (restarting.current) {
      restarting.current = false;
      jump(0);
      // Already on frame 0 the jump commits nothing: reach its prompt here.
      const p = frameRef.current === 0 ? promptAt(0) : null;
      if (p) commit(reach(recordRef.current, 0, p));
    }
    if (continueAfter.current !== null && continueAfter.current === recordRef.current) {
      continueAfter.current = null;
      proceed();
    }
    if (linkRef.current.pinned === "shown") {
      linkRef.current.pinned = null;
      if (linkRef.current.text !== linkText) rerender();
    }
  });

  const recorded = found ? entryAt(record, frame, found.id) : undefined;
  const active: ActivePrompt<A, S> | null = useMemo(() => {
    if (!found) return null;
    const entry = recorded ?? reach(EMPTY_RECORD as PromptRecord<A>, frame, found).entries[0];
    return { prompt: found.prompt, entry, frame };
  }, [found, recorded, frame, reach]);
  const entry = active?.entry;
  const status: PromptsRun<S, A>["status"] = !entry ? null : pending === frame ? "pending" : entry.status;
  const fb = active ? feedback[frame] : undefined;
  const revealed = useMemo(
    () =>
      active && active.entry.settled && active.entry.status !== "skipped"
        ? { answer: active.prompt.answer, explain: active.prompt.explain }
        : null,
    [active]
  );
  const score = useMemo(() => scoreOf(record), [record]);
  // One rule for the input and the reader's toggle.
  const inputLocked = isLocked(record, onInputChange);
  const canToggle = enabledProp === undefined && readerToggle && !inputLocked;

  return useMemo(
    () => ({
      ...trace,
      steps: result.steps,
      truncated: result.truncated,
      error: result.error,
      seed: result.seed,
      active,
      status,
      feedback: fb?.feedback,
      judgeError: fb?.error ?? null,
      retriesLeft: entry ? retriesLeftOf(entry) : 0,
      revealed,
      respond,
      skip,
      proceed,
      restart,
      enabled,
      setEnabled,
      canToggle,
      inputLocked,
      requestInput,
      record,
      score,
    }),
    [trace, result, active, status, fb, entry, revealed, respond, skip, proceed, restart, enabled, setEnabled, canToggle, inputLocked, requestInput, record, score]
  );
}
