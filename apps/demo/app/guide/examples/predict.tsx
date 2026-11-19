"use client";

import { useEffect, useState } from "react";
import {
  useSimulation,
  useEvaluator,
  PlayerBar,
  pass,
  fail,
  type Simulation,
  type StepwiseStep,
} from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

type Kind = "start" | "compare" | "swap" | "keep" | "done";
type Frame = StepwiseStep<{ kind: Kind; arr: number[]; pair?: [number, number] }>;

const bubble: Simulation<readonly number[], Frame> = function* (input) {
  const a = [...input];
  yield { key: "start", kind: "start", tone: "neutral", label: "Start", arr: [...a] };
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++) {
      const pair: [number, number] = [j, j + 1];
      yield { key: `c${i}.${j}`, kind: "compare", tone: "accent", label: `Compare ${a[j]} and ${a[j + 1]}`, arr: [...a], pair };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        yield { key: `s${i}.${j}`, kind: "swap", tone: "write", label: "Swapped", arr: [...a], pair };
      } else {
        yield { key: `k${i}.${j}`, kind: "keep", tone: "neutral", label: "Kept", arr: [...a], pair };
      }
    }
  yield { key: "done", kind: "done", tone: "good", label: "Sorted", arr: [...a] };
};

const INPUT = [3, 1, 4, 2];

export function PredictSort() {
  const { theme } = useSiteTheme(); // demo-only
  // Playback pauses on every compare frame (a checkpoint) until you release it.
  const sim = useSimulation(bubble, INPUT, { holdAt: (_, step) => step?.kind === "compare" });
  const { player } = sim;
  const step = sim.step!;

  // The right answer is whatever the next frame actually does.
  const truth = player.held !== null ? sim.steps[player.held + 1]?.kind : undefined;
  const [guess, setGuess] = useState<Kind | null>(null);
  const answer = useEvaluator(
    (g: Kind | null) => (g === truth ? pass("Right.") : fail("Not quite: is the left one bigger?")),
    guess,
    { mode: "manual" } // graded when you press Check, not on every click
  );
  const { reset } = answer;
  useEffect(() => {
    setGuess(null);
    reset();
  }, [player.held, reset]); // a new checkpoint is a new question

  return (
    <figure>
      <div className="flex h-20 items-end gap-2">
        {step.arr.map((v, i) => (
          <div
            key={i}
            className={`w-9 rounded-sm transition-all duration-300 ${step.pair?.includes(i) ? "bg-accent" : "bg-primary/70"}`}
            style={{ height: `${v * 24}%` }}
          />
        ))}
      </div>
      <p className="my-3 text-sm">{step.label}</p>
      {player.held !== null && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span>Swap or keep?</span>
          {(["swap", "keep"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={guess === k}
              onClick={() => setGuess(k)}
              className={`rounded-md border px-2.5 py-1 capitalize ${guess === k ? "border-primary bg-primary/15" : "border-border"}`}
            >
              {k}
            </button>
          ))}
          <button type="button" disabled={guess === null} onClick={() => answer.check()} className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40">
            Check
          </button>
          <button type="button" onClick={player.release} className="rounded-md px-2.5 py-1 text-muted-foreground">
            {answer.passed ? "Continue" : "Skip"}
          </button>
          {answer.status !== "idle" && <span role="status">{answer.feedback}</span>}
        </div>
      )}
      <PlayerBar
        player={player}
        toneAt={sim.toneAt}
        titleAt={sim.titleAt}
        theme={theme} // demo-only
      />
    </figure>
  );
}
