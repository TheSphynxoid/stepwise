import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { discount, type Rules } from "./tidepool";

// Chapter 3: decision tables. Three yes/no conditions make 8 rules; each
// row runs through the spec and the shipped pricing. The bug lives in the
// one row where all three apply, which is exactly the row a pairwise
// (all-pairs) selection leaves out.

const b = (member: boolean, promo: boolean, weekday: boolean): Rules => ({ member, promo, weekday });

export const ROW_SETS = {
  all: [b(false, false, false), b(false, false, true), b(false, true, false), b(false, true, true), b(true, false, false), b(true, false, true), b(true, true, false), b(true, true, true)],
  // Every pair of values for every pair of conditions appears at least once.
  pairwise: [b(false, false, false), b(false, true, true), b(true, false, true), b(true, true, false)],
} as const;
export type RowSet = keyof typeof ROW_SETS;
export const ROW_SET_NAMES = Object.keys(ROW_SETS) as RowSet[];

export type Row = { rules: Rules; spec: number; shipped: number; diff: boolean };
export type DecisionInput = { rows: RowSet };
export type DecisionStep = StepwiseStep<{
  kind: "start" | "pick" | "row" | "done";
  explain: string;
  set: RowSet;
  rows: Row[];
  /** The rule under test on pick and row frames. */
  current: Rules | null;
  upcoming: "same" | "different" | null;
}>;

export const ruleName = (r: Rules) => [r.member && "member", r.promo && "promo", r.weekday && "weekday"].filter(Boolean).join(" + ") || "no discounts";

const sim: Simulation<DecisionInput, DecisionStep> = function* ({ rows: set }) {
  const rules = ROW_SETS[set];
  const rows: Row[] = [];
  const base = { set };
  yield {
    ...base,
    key: "start",
    kind: "start",
    tone: "neutral",
    label: set === "all" ? "3 conditions, 2 values each: 2 × 2 × 2 = 8 rules" : "Pairwise: 4 rules that cover every pair of values",
    explain:
      set === "all"
        ? "A decision table lists every combination of conditions and the expected result for each. With n yes/no conditions that's 2^n rows: complete, but it doubles with every condition."
        : "Pairwise (all-pairs) testing picks fewer rows so that every pair of conditions still meets in every combination. It catches bugs caused by two conditions together, which is most of them.",
    rows: [],
    current: null,
    upcoming: null,
  };
  for (const r of rules) {
    const row: Row = { rules: r, spec: discount(r, "spec"), shipped: discount(r, "shipped"), diff: false };
    row.diff = row.spec !== row.shipped;
    const id = `${+r.member}${+r.promo}${+r.weekday}`;
    yield {
      ...base,
      key: `pick.${id}`,
      kind: "pick",
      tone: "accent",
      label: `Rule: ${ruleName(r)}. The spec expects ${row.spec}% off.`,
      explain: "Before running a row, write down the expected result from the spec. That expectation is the test oracle; without it a run can't fail.",
      rows: [...rows],
      current: r,
      upcoming: row.diff ? "different" : "same",
    };
    rows.push(row);
    yield {
      ...base,
      key: `row.${id}`,
      kind: "row",
      tone: row.diff ? "bad" : "good",
      label: row.diff ? `${ruleName(r)}: expected ${row.spec}%, shipped gives ${row.shipped}%. Bug.` : `${ruleName(r)}: ${row.spec}% from both`,
      explain: row.diff
        ? "Member and promo stack here, but only when weekday applies too. A bug that needs all three conditions at once is a 3-way interaction."
        : "This row agrees. Each passing row rules out one combination, no more.",
      rows: [...rows],
      current: r,
      upcoming: null,
    };
  }
  const found = rows.some((r) => r.diff);
  yield {
    ...base,
    key: "done",
    kind: "done",
    tone: found ? "bad" : "good",
    label: found ? `Bug found in ${rows.length} rows` : `${rows.length} rows, all agree. The bug is still in there.`,
    explain: found
      ? "The full table found it. With 3 conditions that's cheap; with 10 it's 1024 rows, which is why pairwise exists."
      : "Pairwise covered every pair, and still missed it: the bug needs three conditions together. Pairwise is a good default, not a proof. Use the full table where money is involved.",
    rows,
    current: null,
    upcoming: null,
  };
};

export const decisions = defineExplainer({
  name: "qa-decisions",
  simulation: sim,
  input: {
    default: { rows: "pairwise" } as DecisionInput,
    serialize: ({ rows }) => rows,
    parse: (s) => (s in ROW_SETS ? { rows: s as RowSet } : null),
  },
  predict: {
    at: (step) => step.kind === "pick",
    options: [
      { value: "same", label: "Same result" },
      { value: "different", label: "Different (bug!)" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: "The planted bug only shows when member, promo and weekday all apply.",
  },
});
