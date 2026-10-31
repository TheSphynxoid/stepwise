"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  createTrace,
  useSyncedTracks,
  useGlobalKeys,
  PlayerBar,
  CodeBlock,
  TONE_CHIP_CLASS,
  type StepwiseStep,
} from "@sphynxoid/stepwise";
import { useSiteTheme } from "../theme-provider";

const ITEMS = [5, 2, 8, 1, 9, 3];

/** `hi`: indices under comparison; `fixed`: indices known to be in final/sorted order; `pass`: set on the frame that ends outer pass N. */
type Frame = StepwiseStep<{ code: string[]; arr: number[]; hi: number[]; fixed: number[]; pass?: number }>;

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

// Traces are built at module scope with the builder — no IIFE (invariant 6).
const bubble = createTrace<Frame>();
{
  const arr = [...ITEMS];
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      const swap = arr[j] > arr[j + 1];
      if (swap) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      bubble.step({
        tone: swap ? "write" : "neutral",
        label: swap ? `swap ${j}↔${j + 1}` : `keep ${j}, ${j + 1}`,
        code: [`if (a[${j}] > a[${j + 1}]) swap(${j}, ${j + 1})`, swap ? `// ${arr[j + 1]} > ${arr[j]} → swap` : "// in order"],
        arr: [...arr],
        hi: [j, j + 1],
        fixed: range(n - i, n),
      });
    }
    bubble.step({
      tone: "accent",
      label: `pass ${i + 1} done`,
      code: [`// a[${n - 1 - i}] = ${arr[n - 1 - i]} has bubbled into place`],
      arr: [...arr],
      hi: [],
      fixed: range(n - 1 - i, n),
      pass: i + 1,
    });
  }
  bubble.step({ tone: "good", label: "sorted", code: ["return a"], arr: [...arr], hi: [], fixed: range(0, n) });
}

const insertion = createTrace<Frame>();
{
  const arr = [...ITEMS];
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      const shift = arr[j - 1] > arr[j];
      if (shift) [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
      insertion.step({
        tone: shift ? "write" : "neutral",
        label: shift ? `shift ${j - 1}↔${j}` : `stop at ${j}`,
        code: [`while (j > 0 && a[j-1] > a[j]) swap(j-1, j)   // j = ${j}`, shift ? "// shift left" : "// found its slot"],
        arr: [...arr],
        hi: [j - 1, j],
        fixed: [],
      });
      if (!shift) break;
      j--;
    }
    insertion.step({
      tone: "accent",
      label: `pass ${i} done`,
      code: [`// a[0..${i}] is sorted`],
      arr: [...arr],
      hi: [],
      fixed: range(0, i + 1),
      pass: i,
    });
  }
  insertion.step({ tone: "good", label: "sorted", code: ["return a"], arr: [...arr], hi: [], fixed: range(0, n) });
}

const TRACKS = { bubble: bubble.build(), insertion: insertion.build() };
const byPass = (step: Frame) => (step.pass === undefined ? null : `pass-${step.pass}`);

function Lane({ name, step, held, done, index, length }: {
  name: string;
  step: Frame;
  held: boolean;
  done: boolean;
  index: number;
  length: number;
}) {
  const { theme } = useSiteTheme();
  return (
    <div className={`flex-1 min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm transition-opacity ${held ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-primary">{name}</span>
        <span className="text-[10px] font-mono text-foreground/45">
          {done ? "complete" : held ? "waiting" : `step ${index + 1}/${length}`}
        </span>
      </div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {step.arr.map((v, i) => (
          <div
            key={i}
            className={`w-9 h-9 rounded-md border flex items-center justify-center text-xs font-mono transition-all duration-300 ${
              step.hi.includes(i)
                ? "border-primary bg-primary/20 text-primary scale-110"
                : step.fixed.includes(i)
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-background/40 text-foreground/60"
            }`}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[step.tone]}`}>
          {step.tone}
        </span>
        <span className="text-[13px] font-semibold truncate">{step.label}</span>
      </div>
      <CodeBlock lines={step.code} theme={theme} />
    </div>
  );
}

export default function CompareDemo() {
  const { theme } = useSiteTheme();
  const [aligned, setAligned] = useState(false);
  const cmp = useSyncedTracks(TRACKS, { autoPlay: true, baseDelayMs: 600, key: aligned ? byPass : undefined });
  const { player, tracks } = cmp;

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(player.start),
    a: () => setAligned((v) => !v),
  });

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
          Demo - Synced tracks
        </p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">Two algorithms, one player</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          Bubble sort and insertion sort run on <code className="text-primary">[{ITEMS.join(", ")}]</code>.
          Each produces its own trace; <code className="text-primary">useSyncedTracks</code> puts both under one
          cursor. By default the shorter trace holds its last frame. Align by pass and each outer pass ends on
          the same frame; whichever algorithm gets there first waits.
        </p>

        <div className="flex items-center gap-2 mb-4 sw-fade-up sw-fade-up-3" role="radiogroup" aria-label="Alignment">
          {[
            { value: false, label: "Hold last frame" },
            { value: true, label: "Align by pass" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={aligned === o.value}
              onClick={() => setAligned(o.value)}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-mono transition ${
                aligned === o.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-foreground/60 hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {cmp.total} aligned frames · press A to switch
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          {(["bubble", "insertion"] as const).map((name) => {
            const t = tracks[name];
            return t.step ? (
              <Lane key={name} name={name} step={t.step} held={t.held} done={t.done} index={t.index} length={t.length} />
            ) : null;
          })}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <PlayerBar
            player={player}
            toneAt={cmp.toneAt}
            titleAt={cmp.titleAt}
            onEmpty={player.start}
            theme={theme}
            className="p-2"
          />
        </div>
        {player.ended && (
          <p className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-mono text-accent">
            Both traces complete. Bubble used {tracks.bubble.length} steps and insertion used {tracks.insertion.length}.
          </p>
        )}
      </div>
    </main>
  );
}
