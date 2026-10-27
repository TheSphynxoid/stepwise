"use client";

import { useState, useCallback, useMemo } from "react";
import { StepButton, useStepPlayer, useGlobalKeys, CodeBlock, type StepTone } from "@sphynx/stepwise";

// A tiny bubble-sort trace — each step swaps two elements.
const ITEMS = [5, 2, 8, 1, 9, 3];
const STEPS: { tone: StepTone; label: string; code: string[]; a: number; b: number; arr: number[] }[] = [];

(function build() {
  const arr = [...ITEMS];
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      const cmp = `if (arr[${j}] > arr[${j + 1}]) swap(arr, ${j}, ${j + 1})`;
      if (arr[j] > arr[j + 1]) {
        const a = arr[j], b = arr[j + 1];
        arr[j] = b; arr[j + 1] = a;
        STEPS.push({ tone: "write", label: `Swap arr[${j}] ↔ arr[${j + 1}]`, code: [cmp, `// ${a} > ${b} → swap`], a: j, b: j + 1, arr: [...arr] });
      } else {
        STEPS.push({ tone: "neutral", label: `Skip arr[${j}]`, code: [cmp, `// ${arr[j]} ≤ ${arr[j + 1]} → in order`], a: j, b: j + 1, arr: [...arr] });
      }
    }
  }
  STEPS.push({ tone: "good", label: "Sorted", code: [`return arr`], a: -1, b: -1, arr: [...arr] });
})();

export default function EvictionDemo() {
  const [kind, setKind] = useState<"bubble" | "insertion">("bubble");
  const player = useStepPlayer({ total: STEPS.length });

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(trace),
    Enter: trace,
  });

  const trace = useCallback(() => player.start(), [player]);

  const frame = player.index >= 0 ? player.index : STEPS.length - 1;
  const step = STEPS[Math.min(frame, STEPS.length - 1)];
  const arr = step?.arr ?? ITEMS;

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">Demo — Bubble Sort</p>
        <h1 className="text-2xl font-bold mb-4">Watch the algorithm swap</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6">
          A synthetic trace through bubble sort on <code className="text-primary">[{ITEMS.join(", ")}]</code>.
          Step through frames to watch elements swap.
        </p>

        <div className="border border-border rounded-md p-4 mb-4 bg-card">
          <div className="flex gap-2 mb-4">
            {arr.map((v, i) => {
              const isActive = step && (i === step.a || i === step.b);
              return (
                <div
                  key={i}
                  className={`w-10 h-10 rounded border flex items-center justify-center text-sm font-mono transition-all duration-200 ${
                    isActive ? "border-primary bg-primary/20 text-primary scale-110" : "border-border bg-white/[0.03] text-foreground/60"
                  }`}
                >
                  {v}
                </div>
              );
            })}
          </div>
          {step && (
            <div className="text-[11px] font-mono text-foreground/50">
              step {player.index + 1}/{STEPS.length} — {step.label}
            </div>
          )}
        </div>

        <div className="border border-border rounded-md bg-card mb-4">
          <PlayerBar
            player={player}
            toneAt={(i) => STEPS[i]?.tone ?? "neutral"}
            onEmpty={trace}
            emptyHint="press Run"
            className="p-2"
          />
        </div>

        {step && (
          <div className="border border-border rounded-md p-3 bg-card">
            <p className="text-sm font-semibold mb-2">{step.label}</p>
            <CodeBlock lines={step.code} />
          </div>
        )}
      </div>
    </main>
  );
}
