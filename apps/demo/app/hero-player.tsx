"use client";

import { PlayerBar, useTrace, type StepwiseStep } from "@sphynxoid/stepwise";
import { useSiteTheme } from "./theme-provider";

// Quicksort (Lomuto partition) traced into frames at module scope. Each frame
// snapshots the bar order plus what to highlight; bars are keyed by id so a
// swap animates as two bars sliding past each other.

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

const VALUES = [6, 2, 9, 4, 11, 1, 7, 3, 10, 5, 8];
const MAX = Math.max(...VALUES);

const FRAMES: Frame[] = (() => {
  const bars: Bar[] = VALUES.map((v, id) => ({ id, v }));
  const sorted = new Set<number>();
  const out: Frame[] = [];
  const push = (f: Omit<Frame, "bars" | "sorted">) =>
    out.push({ ...f, bars: bars.map((b) => ({ ...b })), sorted: [...sorted] } as Frame);
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
    push({ tone: "accent", label: `Pivot ${pivot.v}`, pivot: pivot.id, active: [], lo, hi });
    let i = lo;
    for (let j = lo; j < hi; j++) {
      if (bars[j].v < pivot.v) {
        if (i !== j) {
          push({ tone: "write", label: `${bars[j].v} < ${pivot.v} - swap`, pivot: pivot.id, active: [bars[i].id, bars[j].id], lo, hi });
          swap(i, j);
        } else {
          push({ tone: "neutral", label: `${bars[j].v} < ${pivot.v} - keep`, pivot: pivot.id, active: [bars[j].id], lo, hi });
        }
        i++;
      } else {
        push({ tone: "idle", label: `${bars[j].v} >= ${pivot.v} - skip`, pivot: pivot.id, active: [bars[j].id], lo, hi });
      }
    }
    swap(i, hi);
    sorted.add(pivot.id);
    push({ tone: "good", label: `Place ${pivot.v}`, pivot: pivot.id, active: [], lo, hi });
    sort(lo, i - 1);
    sort(i + 1, hi);
  };

  sort(0, bars.length - 1);
  bars.forEach((b) => sorted.add(b.id));
  push({ tone: "good", label: "Sorted", pivot: -1, active: [], lo: -1, hi: -1 });
  return out;
})();

export function HeroPlayer() {
  const { theme } = useSiteTheme();
  const trace = useTrace(FRAMES, { autoPlay: true, baseDelayMs: 650 });
  const { player } = trace;
  const run = player.start;
  // Frame 0 before the player starts; FRAMES is never empty.
  const cur = trace.step!;
  const slot = 100 / cur.bars.length;

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
            quicksort - live player
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-accent">
            <span className={`h-1.5 w-1.5 rounded-full bg-accent ${player.playing ? "animate-pulse" : ""}`} />
            {player.ended ? "complete" : player.playing ? "playing" : "paused"}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div
            className="relative h-44 rounded-md border border-border/60 bg-background/40"
            role="img"
            aria-label={`Quicksort, frame ${trace.frame + 1} of ${FRAMES.length}: ${cur.label}`}
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
                <div
                  key={b.id}
                  className="absolute bottom-0 flex flex-col items-center justify-end pb-1.5 transition-[left] duration-300 ease-out"
                  style={{ left: `${pos * slot}%`, width: `${slot}%`, height: "100%" }}
                >
                  <div
                    className={`w-[70%] rounded-t-sm transition-colors duration-200 ${color} ${isActive ? "shadow-lg shadow-primary/30" : ""}`}
                    style={{ height: `${(b.v / MAX) * 78}%` }}
                  />
                  <span className="mt-1 text-[9px] font-mono text-muted-foreground">{b.v}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono text-foreground/75 min-w-[9.5rem]">{cur.label}</span>
            <span className="flex-1 border-t border-dashed border-border" />
            <span className="text-[11px] font-mono text-muted-foreground">useTrace - PlayerBar</span>
          </div>
          <PlayerBar
            player={player}
            toneAt={trace.toneAt}
            titleAt={trace.titleAt}
            onEmpty={run}
            emptyHint="press play"
            theme={theme}
            className="rounded-md border border-border/60 bg-background/40"
          />
        </div>
      </div>
    </div>
  );
}
