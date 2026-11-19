"use client";

import type { ReactNode } from "react";
import { applyAnswer, retriesLeft, settledAnswer, skipEntry } from "./core";
import type { EvaluatorResult, Prompt, PromptContext, PromptEntry, PromptRecord, Verdict } from "./core";
import type { Simulation, WalkSimulation, WalkStep } from "./core";

// Internal to usePrompts (not exported from any entry): the sources as walks,
// record lookups, and the answer link format.

export interface Found<A, S> {
  prompt: Prompt<A, S>;
  source: "generator" | "overlay";
  id: string;
}

export type Judge<A, S> = (answer: A, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>;

export type InputChange = "lock" | "clear" | "keep";

/** Feedback per frame: the last verdict's feedback, and what a judge threw. */
export type Feedback = Record<number, { feedback: ReactNode; error: unknown }>;

/** A verdict judged on the spot, or "async" when the judge returned a promise. */
export type Judged = { verdict: Verdict | null; error: unknown } | "async";

/** A linked answer list being placed on the trace. */
export interface Restore<A> {
  answers: readonly (A | undefined)[];
  /** Answers placed so far, and the next frame to look at. */
  next: number;
  frame: number;
  /** The answers are for generator prompts only: overlay prompts are passed over. */
  generatorOnly?: boolean;
}

// A `{ steps }` source is a walk over the steps themselves.
export const STEPS_WALK = function* (steps: readonly WalkStep[]) {
  yield* steps;
};

// A plain simulation as a walk: `yield*` forwards sent answers to a generator
// and ignores them for any other iterable. One wrapper per simulation, so the
// run sees a stable identity.
const walks = new WeakMap<object, WalkSimulation<unknown, WalkStep, unknown>>();
export function asWalk<Input, S extends WalkStep, A>(
  sim: Simulation<Input, S> | WalkSimulation<Input, S, A>
): WalkSimulation<Input, S, A> {
  let w = walks.get(sim);
  if (!w) {
    const inner = sim as unknown as Simulation<unknown, WalkStep>;
    w = function* (input, ctx) {
      return yield* inner(input, ctx) as Generator<WalkStep, unknown, unknown>;
    };
    walks.set(sim, w);
  }
  return w as unknown as WalkSimulation<Input, S, A>;
}

// The entry of the prompt at `frame`. Core keeps one entry per frame and
// reachEntry replaces one whose id no longer matches, so after a reach this
// finds the entry core's functions act on; before it, a stale entry (another
// prompt's) reads as missing, never as this prompt's answer.
export function entryAt<A>(rec: PromptRecord<A>, frame: number, id: string): PromptEntry<A> | undefined {
  return rec.entries.find((e) => e.frame === frame && e.id === id);
}

/** What the session is fed: generator entries' settled answers in order, up to the first unsettled one. */
export function choicesOf<A>(rec: PromptRecord<A>): (A | undefined)[] {
  const out: (A | undefined)[] = [];
  for (const e of rec.entries) {
    if (e.source !== "generator") continue;
    if (!e.settled) break;
    out.push(settledAnswer(e));
  }
  return out;
}

export function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

/** The input change rule in effect: the setting, else "lock" once a judged prompt is reached, else "keep". */
export function inputChangeOf<A>(rec: PromptRecord<A>, setting: InputChange | undefined): InputChange {
  return setting ?? (rec.entries.some((e) => e.judged) ? "lock" : "keep");
}

/** Under "lock", the input (and the reader's prompts toggle) is locked once any answer is given. */
export function isLocked<A>(rec: PromptRecord<A>, setting: InputChange | undefined): boolean {
  return inputChangeOf(rec, setting) === "lock" && rec.entries.some((e) => e.attempts.length > 0);
}

/** What a link holds: every entry's settled answer in reach order (undefined when skipped), up to the first unsettled one. */
export function linkedAnswersOf<A>(rec: PromptRecord<A>): (A | undefined)[] {
  const out: (A | undefined)[] = [];
  for (const e of rec.entries) {
    if (!e.settled) break;
    out.push(settledAnswer(e));
  }
  return out;
}

// Answers in the hash: each serialized and URI-encoded (dots too), joined by
// "."; a skipped entry is an empty segment.
export function serializeAnswers<A>(answers: readonly (A | undefined)[], serialize: (a: A) => string): string {
  return answers.map((a) => (a === undefined ? "" : encodeURIComponent(serialize(a)).replace(/\./g, "%2E"))).join(".");
}

/** The linked answers, or null when any segment doesn't parse (the whole list is then ignored). */
export function parseAnswers<A>(raw: string, parse: (v: string) => A | null): (A | undefined)[] | null {
  if (raw === "") return [];
  const out: (A | undefined)[] = [];
  for (const part of raw.split(".")) {
    if (part === "") {
      out.push(undefined);
      continue;
    }
    let value: string;
    try {
      value = decodeURIComponent(part);
    } catch {
      return null;
    }
    const a = parse(value);
    if (a === null) return null;
    out.push(a);
  }
  return out;
}

/**
 * The record on a new trace (an input change under "keep"): generator entries
 * by position (the session was fed them so), overlay entries by id, each to
 * the next free frame whose prompt has it; overlay answers judged again.
 * Entries with no place drop. Null when nothing changed.
 */
export function remapRecord<A, S>(
  rec: PromptRecord<A>,
  oldFeedback: Feedback,
  total: number,
  promptAt: (f: number) => Found<A, S> | null,
  judgeNow: (found: Found<A, S>, answer: A, f: number) => Judged
): { record: PromptRecord<A>; feedback: Feedback } | null {
  const old = rec.entries;
  if (old.length === 0) return null;
  const generatorFrames: number[] = [];
  const overlayFrames = new Map<string, number[]>();
  for (let f = 0; f < total; f++) {
    const p = promptAt(f);
    if (!p) continue;
    if (p.source === "generator") generatorFrames.push(f);
    else overlayFrames.set(p.id, [...(overlayFrames.get(p.id) ?? []), f]);
  }
  const feedback: Feedback = {};
  const used = new Set<number>();
  const entries: PromptEntry<A>[] = [];
  let g = 0;
  for (const e of old) {
    const f = e.source === "generator" ? generatorFrames[g++] : overlayFrames.get(e.id)?.find((x) => !used.has(x));
    if (f === undefined) continue;
    used.add(f);
    const found = promptAt(f)!;
    let entry: PromptEntry<A> = { ...e, frame: f, id: found.id };
    if (oldFeedback[e.frame]) feedback[f] = oldFeedback[e.frame];
    if (found.source === "overlay" && e.attempts.length > 0) {
      const out = judgeNow(found, e.attempts[e.attempts.length - 1], f);
      if (out !== "async" && out.verdict?.status !== "pending") {
        const status = out.verdict ? (out.verdict.status as "pass" | "fail") : "answered";
        entry = { ...entry, judged: out.verdict !== null, status };
        entry.settled = status !== "fail" || retriesLeft(entry) === 0;
        feedback[f] = { feedback: out.verdict?.feedback, error: out.error };
      }
    }
    const same = (Object.keys(entry) as (keyof PromptEntry<A>)[]).every((k) => Object.is(entry[k], e[k]));
    entries.push(same ? e : entry);
  }
  entries.sort((a, b) => a.frame - b.frame);
  if (entries.length === old.length && entries.every((e, i) => e === old[i])) return null;
  return { record: { entries }, feedback };
}

/**
 * Place linked answers from `r.frame` on: each prompt reached takes the next
 * answer (undefined skips it). Stops after a generator prompt (`waiting`: its
 * path continues with the next run), or at an answer that leaves its prompt
 * open (async judge, retries left). Advances `r`.
 */
export function restoreStep<A, S>(
  r: Restore<A>,
  rec: PromptRecord<A>,
  total: number,
  promptAt: (f: number) => Found<A, S> | null,
  reach: (rec: PromptRecord<A>, f: number, found: Found<A, S>) => PromptRecord<A>,
  judgeNow: (found: Found<A, S>, answer: A, f: number) => Judged
): { record: PromptRecord<A>; feedback: Feedback; waiting: boolean } {
  const feedback: Feedback = {};
  while (r.frame < total && r.next < r.answers.length) {
    const f = r.frame++;
    const found = promptAt(f);
    if (!found || (r.generatorOnly && found.source !== "generator")) continue;
    const answer = r.answers[r.next++];
    rec = reach(rec, f, found);
    if (answer === undefined) rec = skipEntry(rec, f);
    else {
      const out = judgeNow(found, answer, f);
      if (out === "async" || out.verdict?.status === "pending") break; // left open for the reader
      rec = applyAnswer(rec, f, answer, out.verdict ? (out.verdict.status as "pass" | "fail") : null);
      feedback[f] = { feedback: out.verdict?.feedback, error: out.error };
      if (!entryAt(rec, f, found.id)?.settled) break;
    }
    if (found.source === "generator") return { record: rec, feedback, waiting: true };
  }
  return { record: rec, feedback, waiting: false };
}
