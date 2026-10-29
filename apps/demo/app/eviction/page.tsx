"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useStepPlayer, useGlobalKeys, PlayerBar, CodeBlock, type StepTone } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../theme-provider";
import { useCallback } from "react";

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
        STEPS.push({ tone: "write", label: `Swap arr[${j}] -> arr[${j + 1}]`, code: [cmp, `// ${a} > ${b} -> swap`], a: j, b: j + 1, arr: [...arr] });
      } else {
        STEPS.push({ tone: "neutral", label: `Skip arr[${j}]`, code: [cmp, `// ${arr[j]} <= ${arr[j + 1]} -> in order`], a: j, b: j + 1, arr: [...arr] });
      }
    }
  }
  STEPS.push({ tone: "good", label: "Sorted", code: [`return arr`], a: -1, b: -1, arr: [...arr] });
})();

export default function EvictionDemo() {
  const { theme } = useSiteTheme();
  const player = useStepPlayer({ total: STEPS.length, autoPlay: true });

  const run = useCallback(() => {
    player.seek(0);
    player.setPlaying(true);
  }, [player]);

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(run),
    Enter: run,
  });

  const frame = player.index >= 0 ? Math.min(player.index, STEPS.length - 1) : 0;
  const step = STEPS[frame];
  const arr = step.arr;

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
          Demo - Bubble Sort
        </p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">Watch the algorithm swap</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          A synthetic trace through bubble sort on <code className="text-primary">[{ITEMS.join(", ")}]</code>.
          Step through frames to watch elements swap.
        </p>

        <div className="rounded-xl border border-border bg-card p-5 mb-4 shadow-sm sw-fade-up sw-fade-up-3">
          <div className="flex gap-2 mb-4 flex-wrap">
            {arr.map((v, i) => {
              const isActive = step && (i === step.a || i === step.b);
              return (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-lg border flex items-center justify-center text-sm font-mono transition-all duration-300 ${
                    isActive
                      ? "border-primary bg-primary/20 text-primary scale-110 shadow-lg shadow-primary/20"
                      : "border-border bg-background/40 text-foreground/60"
                  }`}
                >
                  {v}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] font-mono text-foreground/50">
            step {player.index + 1}/{STEPS.length} - {step.label}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card mb-4 overflow-hidden shadow-sm">
          <PlayerBar
            player={player}
            toneAt={(i) => STEPS[i]?.tone ?? "neutral"}
            titleAt={(i) => STEPS[i]?.label ?? `step ${i + 1}`}
            onEmpty={run}
            emptyHint="press Run"
            theme={theme}
            className="p-2"
          />
        </div>

        {step && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold mb-2">{step.label}</p>
            <CodeBlock lines={step.code} theme={theme} />
            {player.ended && (
              <p className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-mono text-accent">
                sorted - playback complete (ended). Step or seek to clear it.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}