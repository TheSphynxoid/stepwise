"use client";

import { useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import { PlayerBar, createRng, useSimulation, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise";
import { useSiteTheme } from "./theme-provider";

// Quicksort (Lomuto partition) as a live simulation: the trace is computed
// from the bar heights, so clicking a bar mid-run re-sorts the new input and
// the playhead stays on the same step (every step's key names its moment:
// which partition, which comparison). Bars are keyed by id, so a swap
// animates as two bars sliding past each other, and an edited bar keeps its
// place on screen.

interface Bar {
  id: number;
  v: number;
}

type Frame = StepwiseStep<{
  bars: Bar[];
  pivot: number;
  active: number[];
  lo: number;
  hi: number;
  sorted: number[];
}>;

const INITIAL = [6, 2, 9, 4, 11, 1, 7, 3, 10, 5, 8] as const;
const MAX = 12;

const quicksort: Simulation<readonly number[], Frame> = function* (values) {
  const bars: Bar[] = values.map((v, id) => ({ id, v }));
  const sorted = new Set<number>();
  const frames: Frame[] = [];
  const push = (f: Omit<Frame, "bars" | "sorted">) =>
    frames.push({ ...f, bars: bars.map((b) => ({ ...b })), sorted: [...sorted] } as Frame);
  const swap = (a: number, b: number) => {
    [bars[a], bars[b]] = [bars[b], bars[a]];
  };

  const sort = (lo: number, hi: number) => {
    if (lo > hi) return;
    if (lo === hi) {
      sorted.add(bars[lo].id);
      return;
    }
    const pivot = bars[hi];
    const part = `${lo}-${hi}`;
    push({ key: `p${part}`, tone: "accent", label: `Pivot ${pivot.v}`, pivot: pivot.id, active: [], lo, hi });
    let i = lo;
    for (let j = lo; j < hi; j++) {
      const key = `c${part}.${j}`;
      if (bars[j].v < pivot.v) {
        if (i !== j) {
          push({ key, tone: "write", label: `${bars[j].v} < ${pivot.v} - swap`, pivot: pivot.id, active: [bars[i].id, bars[j].id], lo, hi });
          swap(i, j);
        } else {
          push({ key, tone: "neutral", label: `${bars[j].v} < ${pivot.v} - keep`, pivot: pivot.id, active: [bars[j].id], lo, hi });
        }
        i++;
      } else {
        push({ key, tone: "idle", label: `${bars[j].v} >= ${pivot.v} - skip`, pivot: pivot.id, active: [bars[j].id], lo, hi });
      }
    }
    swap(i, hi);
    sorted.add(pivot.id);
    push({ key: `s${part}`, tone: "good", label: `Place ${pivot.v}`, pivot: pivot.id, active: [], lo, hi });
    sort(lo, i - 1);
    sort(i + 1, hi);
  };

  sort(0, bars.length - 1);
  bars.forEach((b) => sorted.add(b.id));
  push({ key: "done", tone: "good", label: "Sorted", pivot: -1, active: [], lo: -1, hi: -1 });
  yield* frames;
};

export function HeroPlayer() {
  const { theme } = useSiteTheme();
  const [values, setValues] = useState<readonly number[]>(INITIAL);
  const [seed, setSeed] = useState(1);
  // Briefly says "re-ran" after an edit, so the trick is visible.
  const [edited, setEdited] = useState(0);
  useEffect(() => {
    if (!edited) return;
    const id = setTimeout(() => setEdited(0), 1800);
    return () => clearTimeout(id);
  }, [edited]);

  const sim = useSimulation(quicksort, values, { autoPlay: true, baseDelayMs: 650 });
  const { player } = sim;
  // Frame 0 before the player starts; the trace is never empty.
  const cur = sim.step!;
  const slot = 100 / cur.bars.length;

  const edit = (next: readonly number[]) => {
    setValues(next);
    setEdited((n) => n + 1);
  };
  // Each click raises a bar by 3, wrapping back to the bottom.
  const bump = (id: number) => edit(values.map((v, i) => (i === id ? ((v + 2) % MAX) + 1 : v)));
  const shuffle = () => {
    edit(createRng(seed).shuffle(values));
    setSeed((s) => s + 1);
  };

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-3xl bg-primary/15 blur-3xl -z-10 sw-float"
      />
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-2xl overflow-hidden sw-card-glow">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5 bg-secondary/30">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          <span className="ml-2 text-[11px] font-mono text-muted-foreground">
            quicksort - click a bar while it plays
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-accent" data-testid="hero-status">
            <span className={`h-1.5 w-1.5 rounded-full bg-accent ${player.playing ? "animate-pulse" : ""}`} />
            {edited ? "re-ran from your edit" : player.ended ? "complete" : player.playing ? "playing" : "paused"}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div
            className="relative h-44 rounded-md border border-border/60 bg-background/40"
            role="group"
            aria-label={`Quicksort, frame ${sim.frame + 1} of ${sim.steps.length}: ${cur.label}. Click a bar to change its value.`}
          >
            {/* the active partition range */}
            {cur.lo >= 0 && (
              <div
                aria-hidden
                className="absolute inset-y-0 bg-primary/[0.07] border-x border-primary/25 transition-all duration-300"
                style={{ left: `${cur.lo * slot}%`, width: `${(cur.hi - cur.lo + 1) * slot}%` }}
              />
            )}
            {cur.bars.map((b, pos) => {
              const isPivot = b.id === cur.pivot;
              const isActive = cur.active.includes(b.id);
              const isSorted = cur.sorted.includes(b.id);
              const color = isPivot
                ? "bg-accent"
                : isActive
                  ? "bg-primary"
                  : isSorted
                    ? "bg-accent/45"
                    : "bg-foreground/20";
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => bump(b.id)}
                  aria-label={`Bar ${b.v}: raise it`}
                  className="group absolute bottom-0 flex flex-col items-center justify-end pb-1.5 transition-[left] duration-300 ease-out cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-sm"
                  style={{ left: `${pos * slot}%`, width: `${slot}%`, height: "100%" }}
                >
                  <span
                    className={`w-[70%] rounded-t-sm transition-[height,background-color] duration-200 group-hover:brightness-125 ${color} ${isActive ? "shadow-lg shadow-primary/30" : ""}`}
                    style={{ height: `${(b.v / MAX) * 78}%` }}
                  />
                  <span className="mt-1 text-[9px] font-mono text-muted-foreground">{b.v}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono text-foreground/75 min-w-[9.5rem]" data-testid="hero-label">
              {cur.label}
            </span>
            <span className="flex-1 border-t border-dashed border-border" />
            <button
              type="button"
              onClick={shuffle}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground transition hover:text-foreground"
            >
              <Shuffle size={11} /> shuffle
            </button>
            <span className="text-[11px] font-mono text-muted-foreground">useSimulation</span>
          </div>
          <PlayerBar
            player={player}
            toneAt={sim.toneAt}
            titleAt={sim.titleAt}
            onEmpty={player.start}
            emptyHint="press play"
            theme={theme}
            className="rounded-md border border-border/60 bg-background/40"
          />
        </div>
      </div>
    </div>
  );
}
