"use client";

import { useState } from "react";
import { useSimulation, PlayerBar, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

export type SortFrame = StepwiseStep<{ arr: number[]; at?: number }>;

// The algorithm, written once as a generator: each `yield` is a frame.
// Yield copies ([...a]), and give every step a `key` naming its moment, so
// the player can find "the same moment" again after the input changes.
export const insertionSort: Simulation<readonly number[], SortFrame> = function* (input) {
  const a = [...input];
  yield { key: "start", tone: "neutral", label: "Start", arr: [...a] };
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0 && a[j - 1] > a[j]) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      yield { key: `swap ${i}.${j}`, tone: "write", label: `${a[j - 1]} moves left of ${a[j]}`, arr: [...a], at: j - 1 };
      j--;
    }
    yield { key: `placed ${i}`, tone: "accent", label: `${a[j]} is in place among the first ${i + 1}`, arr: [...a], at: j };
  }
  yield { key: "done", tone: "good", label: "Sorted", arr: [...a] };
};

export function LiveSort() {
  const { theme } = useSiteTheme(); // demo-only
  const [input, setInput] = useState<readonly number[]>([5, 2, 8, 1, 6]);
  const sim = useSimulation(insertionSort, input);
  const step = sim.step!;
  // Clicking a bar changes the input: the trace is recomputed, and the
  // player stays on the same moment (same key) instead of jumping.
  const bump = (i: number) => setInput(input.map((v, j) => (j === i ? (v % 9) + 1 : v)));
  return (
    <figure>
      <div className="flex h-28 items-end gap-2">
        {step.arr.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => bump(i)}
            aria-label={`Bar ${i + 1}: ${v}. Click to change it.`}
            className={`w-9 rounded-sm transition-all duration-300 hover:opacity-80 ${i === step.at ? "bg-accent" : "bg-primary/70"}`}
            style={{ height: `${v * 11}%` }}
          />
        ))}
      </div>
      <p className="my-3 text-sm">{step.label}</p>
      <PlayerBar
        player={sim.player}
        toneAt={sim.toneAt}
        titleAt={sim.titleAt}
        theme={theme} // demo-only
      />
    </figure>
  );
}
