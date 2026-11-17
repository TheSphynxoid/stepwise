import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { LINES, MUTANTS, SHIPPED, STRONG_SUITE, WEAK_SUITE, bookTraced, runSuite, sameOutcome, type TestCase } from "./driftwood";

// Chapter 4: coverage vs mutation. Phase 1 runs a suite against the shipped
// validator and counts the lines and branches it executed. Phase 2 runs the
// same suite against mutants (small edits to the correct code) and asks
// whether any test notices.

export const SUITES = { weak: WEAK_SUITE, strong: STRONG_SUITE } as const;
export type SuiteName = keyof typeof SUITES;
export const SUITE_NAMES = Object.keys(SUITES) as SuiteName[];

/** Decisions in the validator; each has a true and a false branch. */
export const DECISIONS = ["L1", "L2", "L3", "L5", "L6"] as const;
const TOTAL_BRANCHES = DECISIONS.length * 2;

export type MutantRow = { id: string; label: string; status: "pending" | "killed" | "survived"; by: string | null };
export type TestRow = { name: string; pass: boolean };
export type MutationInput = { suite: SuiteName };
export type MutationStep = StepwiseStep<{
  kind: "start" | "test" | "coverage" | "mutant-show" | "mutant" | "done";
  explain: string;
  suite: SuiteName;
  tests: TestRow[];
  /** Lines and branch outcomes executed so far. */
  lines: string[];
  branches: string[];
  lineCoverage: number;
  branchCoverage: number;
  /** Lines the current test executed (test frames). */
  hot: string[];
  mutants: MutantRow[];
  current: string | null;
  upcoming: "killed" | "survived" | null;
}>;

const pct = (n: number, of: number) => Math.round((100 * n) / of);

const sim: Simulation<MutationInput, MutationStep> = function* ({ suite: name }) {
  const suite: TestCase[] = SUITES[name];
  const tests: TestRow[] = [];
  const lines = new Set<string>();
  const branches = new Set<string>();
  const mutants: MutantRow[] = MUTANTS.map((m) => ({ id: m.id, label: m.label, status: "pending", by: null }));
  const frame = (s: Pick<MutationStep, "key" | "kind" | "tone" | "label" | "explain"> & Partial<MutationStep>): MutationStep => ({
    suite: name,
    tests: [...tests],
    lines: [...lines],
    branches: [...branches],
    lineCoverage: pct(lines.size, LINES.length),
    branchCoverage: pct(branches.size, TOTAL_BRANCHES),
    hot: [],
    mutants: mutants.map((m) => ({ ...m })),
    current: null,
    upcoming: null,
    ...s,
  });

  yield frame({
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `Run the ${name} suite (${suite.length} tests) against the shipped validator`,
    explain: "Coverage tools record which lines (and which sides of each if) your tests executed. Managers love the number. Watch what it does and doesn't tell you.",
  });
  for (const t of suite) {
    const run = bookTraced(t.input, SHIPPED);
    run.lines.forEach((l) => lines.add(l));
    run.branches.forEach((b) => branches.add(b));
    const pass = sameOutcome(run.outcome, t.expect);
    tests.push({ name: t.name, pass });
    yield frame({
      key: `test.${t.name}`,
      kind: "test",
      tone: pass ? "good" : "bad",
      label: `${pass ? "PASS" : "FAIL"} ${t.name}`,
      explain: pass
        ? "The test passed and lit up the lines it ran. Running a line is not the same as checking it."
        : "A failure against the shipped build: this test found one of the planted bugs.",
      hot: run.lines,
    });
  }
  const failed = tests.filter((t) => !t.pass).length;
  yield frame({
    key: "coverage",
    kind: "coverage",
    tone: failed ? "bad" : "write",
    label: `Coverage: ${pct(lines.size, LINES.length)}% of lines, ${pct(branches.size, TOTAL_BRANCHES)}% of branches. ${failed ? `${failed} failing.` : "All green."}`,
    explain: failed
      ? "This suite catches the bugs. Coverage says the same as before; the difference is in the values the tests chose."
      : "Every line ran, every branch went both ways, every test passed, and the shipped code still has two bugs. Coverage measures what executed, not what was verified.",
  });
  for (let i = 0; i < MUTANTS.length; i++) {
    const m = MUTANTS[i];
    const results = runSuite(suite, m.impl);
    const killer = results.find((r) => !r.pass);
    yield frame({
      key: `mutant-show.${m.id}`,
      kind: "mutant-show",
      tone: "accent",
      label: `Mutant: ${m.label}`,
      explain: "A mutant is the correct code with one small, deliberate bug. If the suite still passes, the suite can't tell this bug apart from correct code.",
      current: m.id,
      upcoming: killer ? "killed" : "survived",
    });
    mutants[i] = { ...mutants[i], status: killer ? "killed" : "survived", by: killer?.name ?? null };
    yield frame({
      key: `mutant.${m.id}`,
      kind: "mutant",
      tone: killer ? "good" : "bad",
      label: killer ? `Killed by "${killer.name}"` : `Survived: no test noticed ${m.label}`,
      explain: killer ? "A test failed, so the suite would catch this bug if someone wrote it. Good." : "Every test passed with the bug in. That is a test you haven't written yet.",
      current: m.id,
    });
  }
  const survived = mutants.filter((m) => m.status === "survived").length;
  const killed = mutants.length - survived;
  yield frame({
    key: "done",
    kind: "done",
    tone: survived ? "bad" : "good",
    label: `Mutation score: ${killed}/${mutants.length} killed (${pct(killed, mutants.length)}%)`,
    explain: survived
      ? "Same 100% coverage, a poor mutation score. Each survivor points at a missing test: here, every one is a boundary. Switch to the strong suite."
      : "Every mutant killed. The strong suite adds both sides of each boundary, and that's what the mutants were testing for.",
  });
};

export const mutation = defineExplainer({
  name: "qa-mutation",
  simulation: sim,
  input: {
    default: { suite: "weak" } as MutationInput,
    serialize: ({ suite }) => suite,
    parse: (s) => (s in SUITES ? { suite: s as SuiteName } : null),
  },
  predict: {
    at: (step) => step.kind === "mutant-show",
    options: [
      { value: "killed", label: "Killed" },
      { value: "survived", label: "Survived" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: "Does any test in this suite use an age or quantity right at the edge this mutant moved?",
  },
});
