import type { ReactNode } from "react";
import type { EvaluatorResult, Verdict } from "./types";

// Evaluators: one shape for every "did the reader get it?" question — a tour
// gate waiting for an action, a checkpoint asking "what happens next?", a
// lesson exercise. An evaluator looks at a context and returns a verdict;
// plain booleans are accepted everywhere and mean pass/fail. The types live
// in types.ts (see the note there).

export type { Evaluator, EvaluatorResult, Verdict, VerdictStatus } from "./types";

/** Normalize a boolean or verdict into a verdict. */
export function toVerdict(result: EvaluatorResult): Verdict {
  return typeof result === "boolean" ? { status: result ? "pass" : "fail" } : result;
}

export const pass = (feedback?: ReactNode): Verdict => ({ status: "pass", feedback });
export const fail = (feedback?: ReactNode): Verdict => ({ status: "fail", feedback });
export const pending = (feedback?: ReactNode): Verdict => ({ status: "pending", feedback });
