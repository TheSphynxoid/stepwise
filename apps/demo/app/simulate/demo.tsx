"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Shuffle } from "lucide-react";
import {
  createRng,
  fail,
  pass,
  useGlobalKeys,
  CodeBlock,
  PlayerBar,
  TONE_CHIP_CLASS,
  type Simulation,
  type StepwiseStep,
} from "@sphynxoid/stepwise";
import { usePrompts, type Prompt, type PromptSpec } from "@sphynxoid/stepwise/experimental";
import { useSiteTheme } from "../theme-provider";

// The trace is not recorded by hand: it's computed from the input by a
// generator, and recomputed whenever the input changes. Every step carries a
// `key` naming its moment in the algorithm ("compare at i=3, j=2"), which is
// how the playhead stays on the same moment when you edit the numbers.

type Kind = "start" | "compare" | "swap" | "keep" | "pass" | "done";
type Frame = StepwiseStep<{
  kind: Kind;
  code: string[];
  arr: number[];
  hi: number[];
  /** a[0..sorted] is in order. */
  sorted: number;
  /** Running count of comparisons, so checkpoints can pick every third. */
  cmp: number;
}>;

const insertionSort: Simulation<readonly number[], Frame> = function* (input) {
  const a = [...input];
  let cmp = 0;
  yield { key: "start", kind: "start", tone: "neutral", label: "start", code: ["for (let i = 1; i < n; i++)"], arr: [...a], hi: [], sorted: 0, cmp };
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      cmp++;
      yield {
        key: `c${i}.${j}`,
        kind: "compare",
        tone: "accent",
        label: `compare a[${j - 1}]=${a[j - 1]} with a[${j}]=${a[j]}`,
        code: [`while (j > 0 && a[j-1] > a[j])   // i=${i}, j=${j}`],
        arr: [...a],
        hi: [j - 1, j],
        sorted: i - 1,
        cmp,
      };
      if (a[j - 1] > a[j]) {
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        yield {
          key: `r${i}.${j}`,
          kind: "swap",
          tone: "write",
          label: `swap: ${a[j - 1]} moves left`,
          code: [`swap(j-1, j)   // ${a[j]} > ${a[j - 1]}`],
          arr: [...a],
          hi: [j - 1, j],
          sorted: i - 1,
          cmp,
        };
        j--;
      } else {
        yield {
          key: `r${i}.${j}`,
          kind: "keep",
          tone: "idle",
          label: `keep: ${a[j]} found its slot`,
          code: [`// ${a[j - 1]} <= ${a[j]}: stop`],
          arr: [...a],
          hi: [j - 1, j],
          sorted: i - 1,
          cmp,
        };
        break;
      }
    }
    yield { key: `p${i}`, kind: "pass", tone: "good", label: `a[0..${i}] sorted`, code: [`// pass ${i} done`], arr: [...a], hi: [], sorted: i, cmp };
  }
  yield { key: "done", kind: "done", tone: "good", label: "sorted", code: ["return a"], arr: [...a], hi: [], sorted: a.length - 1, cmp };
};

const DEFAULT_INPUT = [5, 2, 8, 1, 9, 3, 7];
const MIN = 1;
const MAX = 12;
const clampValue = (v: number) => Math.max(MIN, Math.min(MAX, v));

/** `#in=5.2.8.1…` — the exact input, so a shared link replays the same trace. */
const serializeInput = (input: readonly number[]) => input.join(".");
/** Anything outside the editor's limits is ignored, not trusted. */
function parseInput(raw: string): readonly number[] | null {
  const values = raw.split(".").map(Number);
  return values.length >= 2 && values.length <= 10 && values.every((v) => Number.isInteger(v) && v >= MIN && v <= MAX)
    ? values
    : null;
}

// Predict mode: a question at every third comparison. The right answer is
// simply the next frame of the trace, so it follows input edits for free.
type Guess = "swap" | "keep";
const ask = (s: Frame, f: number, steps: readonly Frame[]): Prompt<Guess, Frame> | null =>
  s.kind === "compare" && s.cmp % 3 === 1
    ? { options: [{ value: "swap", label: "Yes, swap" }, { value: "keep", label: "No, keep" }], answer: steps[f + 1]?.kind as Guess }
    : null;
const judge = (g: Guess, prompt: PromptSpec<Guess>) =>
  g === prompt.answer
    ? pass(g === "swap" ? "Right: the left one is bigger, so they swap." : "Right: they're already in order, so insertion stops.")
    : fail(prompt.answer === "swap" ? "Not quite: the left value is bigger, so it has to move right." : "Not quite: the left value is smaller or equal, so this element is home.");

export default function SimulateDemo() {
  const { theme } = useSiteTheme();
  const [input, setInput] = useState<readonly number[]>(DEFAULT_INPUT);
  const [seed, setSeed] = useState(1);
  const [predict, setPredict] = useState(false);
  const [reruns, setReruns] = useState(0);

  // usePrompts is useSimulation plus questions: playback holds at one, Next
  // stops there until it's answered. `enabled` turns predict mode on and off.
  // syncInput keeps the input in the URL next to the frame: a linked input
  // is handed to setInput on mount, and the linked frame lands on its trace.
  // An edit clears the score ("clear"), so the input stays editable mid-quiz.
  const sim = usePrompts(
    { simulation: insertionSort, input },
    {
      autoPlay: true,
      baseDelayMs: 700,
      syncHash: "frame",
      syncInput: { key: "in", serialize: serializeInput, parse: parseInput, onRestore: setInput },
      ask,
      judge,
      enabled: predict,
      onInputChange: "clear",
    }
  );
  const { player, step, active, revealed, score } = sim;
  const cur = step!;

  const edit = (next: readonly number[]) => {
    setInput(next);
    setReruns((n) => n + 1);
  };
  const nudge = (i: number, delta: number) => edit(input.map((v, k) => (k === i ? clampValue(v + delta) : v)));
  const randomize = () => {
    // Seeded, so "seed 4" is the same array for everyone.
    const rng = createRng(seed);
    edit(Array.from({ length: input.length }, () => rng.int(MIN, MAX)));
    setSeed((s) => s + 1);
  };

  const picked = active?.entry.attempts.at(-1);

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(player.start),
    r: randomize,
  });

  const max = Math.max(...cur.arr, MAX);

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">Demo - Live simulation</p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">Change the input while it plays</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          This trace isn&apos;t recorded by hand. <code className="text-primary">useSimulation</code> runs an insertion-sort
          generator on the numbers below and plays the result. Nudge a value with the arrows (or press R for a seeded
          random input): the trace is recomputed and the playhead stays on the <em>same comparison</em>, because every
          step carries a <code className="text-primary">key</code> like <code className="text-primary">c3.2</code>. The URL
          holds the exact input, so a copied link replays this run frame for frame. Predict mode, built on{" "}
          <code className="text-primary">usePrompts</code>, asks at every third comparison: playback and Next stop at the
          question, and a wrong guess shows the answer.
        </p>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[cur.tone]}`}>
                {cur.kind}
              </span>
              <span className="text-[13px] font-semibold truncate" data-testid="sim-label">{cur.label}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0" data-testid="sim-key">
              key {cur.key} · {sim.steps.length} steps{reruns > 0 ? ` · re-ran ${reruns}×` : ""}
            </span>
          </div>

          <div className="flex items-end gap-2 h-48" role="img" aria-label={`Array ${cur.arr.join(", ")}: ${cur.label}`}>
            {cur.arr.map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-md transition-all duration-300 ${
                  cur.hi.includes(i)
                    ? cur.kind === "swap"
                      ? "bg-primary"
                      : "bg-primary/60"
                    : i <= cur.sorted
                      ? "bg-accent/40"
                      : "bg-foreground/20"
                }`}
                style={{ height: `${(v / max) * 100}%` }}
              />
            ))}
          </div>

          {/* The input editor: one stepper per input slot (input order, not the current sorted order). */}
          <div className="flex gap-2 mt-3" aria-label="Input values">
            {input.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 rounded-md border border-border/60 bg-background/40 py-1">
                <button type="button" onClick={() => nudge(i, +1)} disabled={v >= MAX} aria-label={`Increase input ${i + 1}`} className="text-foreground/50 hover:text-primary disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <span className="text-[12px] font-mono" data-testid="sim-input">{v}</span>
                <button type="button" onClick={() => nudge(i, -1)} disabled={v <= MIN} aria-label={`Decrease input ${i + 1}`} className="text-foreground/50 hover:text-primary disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={randomize} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-mono text-foreground/70 hover:text-foreground hover:border-primary/40 transition">
              <Shuffle size={12} /> Randomize (seed {seed})
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={predict}
              onClick={() => {
                // Off while paused at a question: let playback go on.
                if (predict && player.held !== null) player.release();
                setPredict(!predict);
              }}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-mono transition ${
                predict ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground/60 hover:text-foreground"
              }`}
            >
              Predict mode {predict ? "on" : "off"}
            </button>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground hidden sm:inline">← → step · space play · R randomize</span>
          </div>
        </div>

        {active && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 mb-4" data-testid="checkpoint">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-mono uppercase tracking-widest text-primary">Checkpoint</p>
              <span className="text-[10px] font-mono text-muted-foreground" data-testid="sim-score">
                {score.passed}/{score.passed + score.failed} right
              </span>
            </div>
            <p className="text-[13px] mb-3">
              Will <strong>{cur.arr[cur.hi[0]]}</strong> and <strong>{cur.arr[cur.hi[1]]}</strong> swap?
            </p>
            <div className="flex flex-wrap items-center gap-2" aria-label="Your prediction">
              {active.prompt.options?.map((o) => {
                const { value, label } = typeof o === "string" ? { value: o, label: o } : o;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={picked === value}
                    disabled={revealed !== null || sim.status === "pending"}
                    onClick={() => sim.respond(value as Guess)}
                    className={`rounded-md border px-3 py-1.5 text-[11px] font-mono transition disabled:opacity-60 ${
                      picked === value ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {revealed && (
                <button type="button" onClick={sim.proceed} className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-mono text-primary-foreground">
                  Continue
                </button>
              )}
            </div>
            <p aria-live="polite" className={`mt-2 text-[12px] ${sim.status === "pass" ? "text-accent" : "text-foreground/70"}`}>
              {sim.feedback}
              {revealed && sim.status !== "pass" && <> Answer: {revealed.answer}.</>}
            </p>
          </div>
        )}

        <CodeBlock lines={cur.code} theme={theme} className="mb-4" />

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <PlayerBar player={player} toneAt={sim.toneAt} titleAt={sim.titleAt} onEmpty={player.start} theme={theme} className="p-2" />
        </div>
        {player.ended && (
          <p className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-mono text-accent">
            Sorted in {cur.cmp} comparisons. Try a nearly-sorted input: insertion sort does far fewer.
          </p>
        )}
      </div>
    </main>
  );
}
