import type { ReactNode } from "react";

// Evaluators: one shape for every "did the reader get it?" question — a tour
// gate waiting for an action, a checkpoint asking "what happens next?", a
// lesson exercise. An evaluator looks at a context and returns a verdict;
// plain booleans are accepted everywhere and mean pass/fail.

export type VerdictStatus = "pass" | "fail" | "pending";

export interface Verdict {
  status: VerdictStatus;
  /** What to tell the reader: why it failed, a hint, a "nice!". */
  feedback?: ReactNode;
}

export type EvaluatorResult = boolean | Verdict;

/**
 * Judge `ctx`. May be async (run the reader's code, ask a server); the
 * `signal` aborts when the result is no longer wanted (the context changed,
 * the component unmounted), so long checks can stop early.
 */
export type Evaluator<Ctx> = (ctx: Ctx, signal: AbortSignal) => EvaluatorResult | Promise<EvaluatorResult>;

/** Normalize a boolean or verdict into a verdict. */
export function toVerdict(result: EvaluatorResult): Verdict {
  return typeof result === "boolean" ? { status: result ? "pass" : "fail" } : result;
}

export const pass = (feedback?: ReactNode): Verdict => ({ status: "pass", feedback });
export const fail = (feedback?: ReactNode): Verdict => ({ status: "fail", feedback });
export const pending = (feedback?: ReactNode): Verdict => ({ status: "pending", feedback });
