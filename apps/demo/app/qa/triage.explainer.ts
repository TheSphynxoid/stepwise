import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { BUG_CARDS, type BugCard } from "./driftwood";

// Chapter 10b: severity vs priority. Severity is how bad the bug is when it
// happens (the tester's call). Priority is how soon it gets fixed (the
// product's call). Each card is placed on the 2×2; predict the quadrant.

export const QUADRANTS = [
  { value: "high-high", label: "High sev, high pri" },
  { value: "high-low", label: "High sev, low pri" },
  { value: "low-high", label: "Low sev, high pri" },
  { value: "low-low", label: "Low sev, low pri" },
] as const;
export const quadrantOf = (c: Pick<BugCard, "severity" | "priority">) => `${c.severity}-${c.priority}`;

/** No real input: the kit needs an object type, and an empty one breaks prop typing (docs/KIT-FEEDBACK.md). */
export type TriageInput = { board: "release" };
export type TriageStep = StepwiseStep<{
  kind: "start" | "card" | "placed" | "done";
  explain: string;
  /** Cards placed so far. */
  placed: BugCard[];
  /** The card on the table. */
  current: BugCard | null;
}>;

const sim: Simulation<TriageInput, TriageStep> = function* () {
  const placed: BugCard[] = [];
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `${BUG_CARDS.length} bug reports to triage`,
    explain:
      "Severity: how much damage when it happens. Priority: how soon to fix it, given everything else. They usually move together. Interviewers ask about the cases where they don't.",
    placed: [],
    current: null,
  };
  for (const card of BUG_CARDS) {
    yield { key: `card.${card.id}`, kind: "card", tone: "accent", label: card.title, explain: "Severity first: what breaks, for whom? Then priority: who sees it, how soon does it hurt?", placed: [...placed], current: card };
    placed.push(card);
    yield {
      key: `placed.${card.id}`,
      kind: "placed",
      tone: card.severity === "high" ? "bad" : "write",
      label: `${card.title}: ${card.severity} severity, ${card.priority} priority`,
      explain: card.why,
      placed: [...placed],
      current: card,
    };
  }
  yield {
    key: "done",
    kind: "done",
    tone: "good",
    label: "Triaged",
    explain:
      "Remember the two off-diagonal classics. A logo typo on the home page: trivial severity, top priority. A crash on a page nobody can reach: severe, but it can wait.",
    placed,
    current: null,
  };
};

export const triage = defineExplainer({
  name: "qa-triage",
  simulation: sim,
  input: { default: { board: "release" } as TriageInput },
  predict: {
    at: (step) => step.kind === "card",
    options: [...QUADRANTS],
    truth: (next) => (next?.current ? quadrantOf(next.current) : undefined),
    hint: "Severity is impact when it happens; priority is urgency. Who sees this bug, and what does it cost them?",
  },
});
