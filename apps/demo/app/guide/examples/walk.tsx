"use client";

import { PlayerBar } from "@sphynxoid/stepwise";
import { useWalk, type WalkSimulation, type WalkStep } from "@sphynxoid/stepwise/experimental";
import { useSiteTheme } from "../../theme-provider"; // demo-only

type Pivot = "first" | "middle";
type Frame = WalkStep & { arr: number[]; pivot?: number };

const SORTED = [1, 2, 3, 4, 5, 6, 7];

// A step with `await: true` is a choice point: that `yield` returns the
// reader's answer, and the walk branches on it.
const pivotWalk: WalkSimulation<number[], Frame, Pivot> = function* (input) {
  const arr = [...input];
  yield { key: "start", tone: "neutral", label: "Quicksort, on input that is already sorted", arr };
  const pick = yield { key: "fork", tone: "accent", label: "Which element is the pivot?", arr, await: true };
  if (pick === "first") {
    yield { key: "first", tone: "bad", label: "Pivot 1: nothing is smaller, so one side is empty", arr, pivot: 0 };
    yield { key: "first.end", tone: "bad", label: "Every split is that lopsided: n² comparisons", arr, pivot: 1 };
  } else {
    yield { key: "middle", tone: "good", label: "Pivot 4: three on each side", arr, pivot: 3 };
    yield { key: "middle.end", tone: "good", label: "Halves each time: n log n comparisons", arr, pivot: 3 };
  }
};

export function PivotWalk() {
  const { theme } = useSiteTheme(); // demo-only
  const walk = useWalk(pivotWalk, SORTED);
  const step = walk.step!;
  // `frame` is the step on screen (0 before playback starts).
  const asking = walk.choicePoints.includes(walk.frame);
  return (
    <figure>
      <div className="flex h-20 items-end gap-1.5">
        {step.arr.map((v, i) => (
          <div
            key={i}
            className={`w-7 rounded-sm transition-colors duration-300 ${i === step.pivot ? "bg-accent" : "bg-primary/70"}`}
            style={{ height: `${v * 13}%` }}
          />
        ))}
      </div>
      <p className="my-3 text-sm">{step.label}</p>
      <div className="mb-3 flex gap-2 text-xs">
        {(["first", "middle"] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={!asking}
            aria-pressed={walk.choiceAt(walk.frame) === c}
            onClick={() => walk.choose(c)}
            className="rounded-md border border-border px-2.5 py-1 capitalize disabled:opacity-40 aria-pressed:border-primary"
          >
            {c} element
          </button>
        ))}
      </div>
      <PlayerBar
        controls="step" // no Play: playing would only run to the next choice
        player={walk.player}
        toneAt={walk.toneAt}
        titleAt={walk.titleAt}
        theme={theme} // demo-only
      />
    </figure>
  );
}
