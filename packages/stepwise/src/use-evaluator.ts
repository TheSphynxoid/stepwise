"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toVerdict } from "./evaluate";
import type { Evaluator, EvaluatorResult, Verdict, VerdictStatus } from "./evaluate";

export interface EvaluatorOptions {
  /**
   * "auto" (default) re-judges whenever `ctx` changes: a gate that opens the
   * moment the reader does the thing. "manual" judges only on `check()`: a
   * quiz with a Check button; changing `ctx` afterwards clears the verdict.
   */
  mode?: "auto" | "manual";
}

export interface EvaluatorState {
  /** "idle" until the first verdict (manual mode, or after `reset`). */
  status: VerdictStatus | "idle";
  feedback: ReactNode;
  /** status === "pass". */
  passed: boolean;
  /** How many times `check()` ran, for "show a hint after two tries". */
  attempts: number;
  /** What the evaluator threw (the verdict is then "fail"). */
  error: unknown;
  /** Judge the current context now. Resolves with the verdict, or null if superseded. */
  check: () => Promise<Verdict | null>;
  /** Back to "idle", attempts to 0, any running check abandoned. */
  reset: () => void;
}

interface Judged {
  status: VerdictStatus | "idle";
  feedback: ReactNode;
  error: unknown;
}

const IDLE: Judged = { status: "idle", feedback: undefined, error: null };

/**
 * Run an evaluator against a context and keep its verdict as state. Async
 * evaluators report "pending" while they run; a newer check (or a context
 * change) aborts the older one and drops its late result, so the verdict
 * always describes the latest context. `check` and `reset` are
 * referentially stable.
 *
 *   const answer = useEvaluator(
 *     (guess: string | null) => (guess === truth ? pass("Right!") : fail("Look at the pivot again.")),
 *     guess,
 *     { mode: "manual" }
 *   );
 *   <button onClick={answer.check}>Check</button> {answer.feedback}
 */
export function useEvaluator<Ctx>(evaluator: Evaluator<Ctx>, ctx: Ctx, opts?: EvaluatorOptions): EvaluatorState {
  const mode = opts?.mode ?? "auto";
  const [state, setState] = useState<Judged>(IDLE);
  const [attempts, setAttempts] = useState(0);
  const evaluatorRef = useRef(evaluator);
  evaluatorRef.current = evaluator;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const runRef = useRef<AbortController | null>(null);

  useEffect(() => () => runRef.current?.abort(), []);

  const run = useCallback(async (): Promise<Verdict | null> => {
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    let result: EvaluatorResult | Promise<EvaluatorResult>;
    try {
      result = evaluatorRef.current(ctxRef.current, controller.signal);
    } catch (error) {
      setState({ status: "fail", feedback: undefined, error });
      return { status: "fail" };
    }
    if (!(result instanceof Promise)) {
      const verdict = toVerdict(result);
      setState({ status: verdict.status, feedback: verdict.feedback, error: null });
      return verdict;
    }
    setState((s) => ({ status: "pending", feedback: s.feedback, error: null }));
    try {
      const verdict = toVerdict(await result);
      if (controller.signal.aborted) return null;
      setState({ status: verdict.status, feedback: verdict.feedback, error: null });
      return verdict;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setState({ status: "fail", feedback: undefined, error });
      return { status: "fail" };
    }
  }, []);

  const check = useCallback(() => {
    setAttempts((n) => n + 1);
    return run();
  }, [run]);

  const reset = useCallback(() => {
    runRef.current?.abort();
    runRef.current = null;
    setState(IDLE);
    setAttempts(0);
  }, []);

  // Auto: judge every new context. Manual: a new context makes the old
  // verdict stale, so drop it (attempts are kept: it's the same question).
  useEffect(() => {
    if (mode === "auto") {
      void run();
    } else {
      runRef.current?.abort();
      setState(IDLE);
    }
  }, [ctx, mode, run]);

  return useMemo(
    () => ({ ...state, passed: state.status === "pass", attempts, check, reset }),
    [state, attempts, check, reset]
  );
}
