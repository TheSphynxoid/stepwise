// sorting.explainer.ts: the definition. A plain module (no "use client"),
// so the server can run it ahead of time and the browser can re-run it when
// the reader edits the input. Note the import path: ./core, the entry that
// is safe on a server.
import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";

export type SortInput = { arr: number[] };
export type Frame = StepwiseStep<{ kind: "start" | "compare" | "swap" | "keep" | "done"; arr: number[]; pair?: number[] }>;

const bubble: Simulation<SortInput, Frame> = function* ({ arr }) {
  const a = [...arr];
  yield { key: "start", kind: "start", tone: "neutral", label: "Start", arr: [...a] };
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++) {
      const pair = [j, j + 1];
      yield { key: `c${i}.${j}`, kind: "compare", tone: "accent", label: `Compare ${a[j]} and ${a[j + 1]}`, arr: [...a], pair };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        yield { key: `s${i}.${j}`, kind: "swap", tone: "write", label: "Swap them", arr: [...a], pair };
      } else {
        yield { key: `k${i}.${j}`, kind: "keep", tone: "neutral", label: "Already in order", arr: [...a], pair };
      }
    }
  yield { key: "done", kind: "done", tone: "good", label: "Sorted", arr: [...a] };
};

export const sorting = defineExplainer({
  name: "sorting",
  simulation: bubble,
  input: {
    default: { arr: [5, 2, 8, 1] },
    // Optional: with these two, the input goes in the link too.
    serialize: ({ arr }) => arr.join("."),
    parse: (s) => {
      const arr = s.split(".").map(Number);
      return arr.length >= 2 && arr.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) ? { arr } : null;
    },
  },
  // Optional: predict mode pauses here and asks what the next frame does.
  predict: {
    at: (step) => step.kind === "compare",
    options: ["swap", "keep"],
    truth: (next) => next?.kind,
    hint: "Is the left bar taller than the right one?",
  },
});
