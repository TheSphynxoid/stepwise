"use client";

import { PlayerBar, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise";
import { usePrompts } from "@sphynxoid/stepwise/experimental";
import { useSiteTheme } from "../../theme-provider"; // demo-only

type Frame = StepwiseStep<{ kind: string; arr: number[] }>;

const bubble: Simulation<readonly number[], Frame> = function* (input) {
  const a = [...input];
  yield { key: "start", kind: "start", tone: "neutral", label: "Start", arr: [...a] };
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++) {
      yield { key: `c${i}.${j}`, kind: "compare", tone: "accent", label: `Compare ${a[j]} and ${a[j + 1]}`, arr: [...a] };
      const swap = a[j] > a[j + 1];
      if (swap) [a[j], a[j + 1]] = [a[j + 1], a[j]];
      yield { key: `r${i}.${j}`, kind: swap ? "swap" : "keep", tone: "neutral", label: swap ? "Swapped" : "Kept", arr: [...a] };
    }
  yield { key: "done", kind: "done", tone: "good", label: "Sorted", arr: [...a] };
};

const INPUT = [3, 1, 4, 2];

// A question at every compare; the right answer is what the next frame does.
const ask = (step: Frame, f: number, steps: readonly Frame[]) =>
  step.kind === "compare" ? { options: ["swap", "keep"], answer: steps[f + 1].kind } : null;

export function PredictSort() {
  const { theme } = useSiteTheme(); // demo-only
  const run = usePrompts({ simulation: bubble, input: INPUT }, { ask });
  return (
    <figure className="space-y-3 text-sm">
      <p>{run.step!.label}: {run.step!.arr.join(" ")}</p>
      {run.active && (
        <div className="flex items-center gap-2">
          Swap or keep?
          {["swap", "keep"].map((k) => (
            <button key={k} type="button" disabled={!!run.revealed} onClick={() => run.respond(k)} className="rounded-md border border-border px-2.5 py-1">{k}</button>
          ))}
          {run.revealed && <span role="status">{run.status === "pass" ? "Right." : `No: ${run.revealed.answer}.`}</span>}
          {run.revealed && <button type="button" onClick={run.proceed} className="underline">Continue</button>}
        </div>
      )}
      <PlayerBar
        player={run.player}
        toneAt={run.toneAt}
        titleAt={run.titleAt}
        theme={theme} // demo-only
      />
    </figure>
  );
}
