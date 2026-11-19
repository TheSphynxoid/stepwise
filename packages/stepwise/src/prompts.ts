import type { EvaluatorResult } from "./types";

// The prompt answer record: pure bookkeeping for "ask the reader something at
// a frame". A record holds one entry per prompt the reader has reached, in
// reach order; every function returns a new record (or the same object when
// nothing changes). No React, no timers: hooks layer judging and navigation on
// top. Re-exported from ./core.

export type PromptOption = string | { value: string; label: string };

/** What a step (or an overlay) declares: JSON only, so a generator can emit it. */
export interface PromptSpec<A = unknown> {
  id?: string;
  data?: unknown;
  options?: readonly PromptOption[];
  answer?: A;
  retries?: number;
  explain?: unknown;
}

export interface PromptContext<S> {
  step: S;
  frame: number;
  steps: readonly S[];
}

/** A spec plus the function that judges an answer (functions come from hook settings). */
export interface Prompt<A, S> extends PromptSpec<A> {
  /** May be async: the verdict reads "pending" until it resolves. */
  judge?: (answer: A, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>;
}

export type EntryStatus = "open" | "pass" | "fail" | "answered" | "skipped";

export interface PromptEntry<A> {
  id: string;
  frame: number;
  source: "generator" | "overlay";
  /** Whether answers are judged (pass/fail) or only recorded. */
  judged: boolean;
  /** Changes allowed after the first answer; may be Infinity. */
  retries: number;
  attempts: readonly A[];
  status: EntryStatus;
  /** True once the entry needs nothing more from the reader to move on. */
  settled: boolean;
}

export interface PromptRecord<A> {
  entries: readonly PromptEntry<A>[];
}

export interface PromptScore {
  reached: number;
  passed: number;
  failed: number;
  answered: number;
  skipped: number;
}

export const EMPTY_RECORD: PromptRecord<never> = { entries: [] };

type Reach<A> = Pick<PromptEntry<A>, "id" | "frame" | "source" | "judged" | "retries">;

/**
 * Record that the reader reached a prompt. Idempotent per (frame, id); keeps
 * reach order. An entry at the frame with another id belongs to a prompt
 * that's no longer there (the trace or the overlay changed): it is replaced
 * in place by a fresh one, so a frame always holds the entry of its prompt.
 */
export function reachEntry<A>(rec: PromptRecord<A>, e: Reach<A>): PromptRecord<A> {
  const i = rec.entries.findIndex((x) => x.frame === e.frame);
  if (i >= 0 && rec.entries[i].id === e.id) return rec;
  const entry: PromptEntry<A> = { ...e, attempts: [], status: "open", settled: false };
  if (i < 0) return { entries: [...rec.entries, entry] };
  const entries = rec.entries.slice();
  entries[i] = entry;
  return { entries };
}

/** Retries still available: every attempt after the first one consumes one. */
export function retriesLeft<A>(entry: PromptEntry<A>): number {
  return Math.max(0, entry.retries - Math.max(0, entry.attempts.length - 1));
}

/** May the reader give (or change) an answer now? */
export function canAnswer<A>(entry: PromptEntry<A>): boolean {
  return entry.status === "open" || entry.status === "skipped" || !entry.settled || retriesLeft(entry) > 0;
}

function replace<A>(rec: PromptRecord<A>, frame: number, next: (e: PromptEntry<A>) => PromptEntry<A>): PromptRecord<A> {
  const i = rec.entries.findIndex((e) => e.frame === frame);
  if (i < 0) return rec;
  const entries = rec.entries.slice();
  entries[i] = next(rec.entries[i]);
  return { entries };
}

/**
 * Apply an answer at `frame`. `verdict` is null for unjudged entries. A pass
 * settles at once; a fail settles when no retries remain; an unjudged answer
 * settles as "answered". Returns the same record when the entry is missing or
 * can no longer be answered.
 */
export function applyAnswer<A>(
  rec: PromptRecord<A>,
  frame: number,
  answer: A,
  verdict: "pass" | "fail" | null,
): PromptRecord<A> {
  const entry = rec.entries.find((e) => e.frame === frame);
  if (!entry || !canAnswer(entry)) return rec;
  return replace(rec, frame, (e) => {
    const attempts = [...e.attempts, answer];
    const next: PromptEntry<A> = { ...e, attempts };
    if (verdict === null) return { ...next, status: "answered", settled: true };
    if (verdict === "pass") return { ...next, status: "pass", settled: true };
    return { ...next, status: "fail", settled: retriesLeft(next) === 0 };
  });
}

/** Skip an entry that has not been answered. Later answers still count as the first. */
export function skipEntry<A>(rec: PromptRecord<A>, frame: number): PromptRecord<A> {
  const entry = rec.entries.find((e) => e.frame === frame);
  if (!entry || entry.attempts.length > 0 || entry.status === "skipped") return rec;
  return replace(rec, frame, (e) => ({ ...e, status: "skipped", settled: true }));
}

/** Drop entries past `frame` (the reader went back and the future is rebuilt). */
export function truncateAfter<A>(rec: PromptRecord<A>, frame: number): PromptRecord<A> {
  if (!rec.entries.some((e) => e.frame > frame)) return rec;
  return { entries: rec.entries.filter((e) => e.frame <= frame) };
}

/** The last attempt once settled; undefined while open or when skipped. */
export function settledAnswer<A>(entry: PromptEntry<A>): A | undefined {
  if (!entry.settled || entry.status === "skipped" || entry.attempts.length === 0) return undefined;
  return entry.attempts[entry.attempts.length - 1];
}

export function scoreOf<A>(rec: PromptRecord<A>): PromptScore {
  const score: PromptScore = { reached: rec.entries.length, passed: 0, failed: 0, answered: 0, skipped: 0 };
  for (const e of rec.entries) {
    if (e.status === "pass") score.passed++;
    else if (e.status === "fail" && e.settled) score.failed++;
    else if (e.status === "answered") score.answered++;
    else if (e.status === "skipped") score.skipped++;
  }
  return score;
}
