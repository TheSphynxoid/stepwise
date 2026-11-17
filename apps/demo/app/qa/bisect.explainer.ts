import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { COMMITS, testsPassAt } from "./driftwood";

// Chapter 9: git bisect. The last release (commit 0) was good; HEAD (19) is
// red. Binary search over the history: test the middle commit, keep the
// half that contains the change. 20 commits take at most 5 test runs.

export type BisectInput = { good: number; bad: number };
export type BisectStep = StepwiseStep<{
  kind: "start" | "probe" | "result" | "done";
  explain: string;
  lo: number;
  hi: number;
  /** Commit under test on probe/result frames. */
  mid: number | null;
  /** Verdicts so far, by commit index. */
  marks: Record<string, "good" | "bad">;
  probes: number;
  found: number | null;
  upcoming: "good" | "bad" | null;
}>;

const sim: Simulation<BisectInput, BisectStep> = function* ({ good, bad }) {
  let lo = good;
  let hi = bad;
  const marks: Record<string, "good" | "bad"> = { [lo]: "good", [hi]: "bad" };
  let probes = 0;
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `Commit ${good} is good, commit ${hi} is bad. ${hi - lo - 1} commits in between.`,
    explain:
      "A regression: it used to work, now it doesn't, and many commits landed in between. Testing them one by one is up to 18 test runs. Bisecting halves the range every time.",
    lo,
    hi,
    mid: null,
    marks: { ...marks },
    probes,
    found: null,
    upcoming: null,
  };
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const ok = testsPassAt(mid);
    probes++;
    yield {
      key: `probe.${mid}`,
      kind: "probe",
      tone: "accent",
      label: `git bisect: check out ${COMMITS[mid].sha} "${COMMITS[mid].msg}" and run the tests`,
      explain: `The middle of ${lo + 1}..${hi - 1}. Whatever the answer, half the suspects are cleared.`,
      lo,
      hi,
      mid,
      marks: { ...marks },
      probes,
      found: null,
      upcoming: ok ? "good" : "bad",
    };
    marks[mid] = ok ? "good" : "bad";
    if (ok) lo = mid;
    else hi = mid;
    yield {
      key: `result.${mid}`,
      kind: "result",
      tone: ok ? "good" : "bad",
      label: ok ? `${COMMITS[mid].sha} is good: the bug came later` : `${COMMITS[mid].sha} is bad: the bug is here or earlier`,
      explain: ok ? "git bisect good. Everything up to here is cleared." : "git bisect bad. Everything after here is cleared too: the first bad commit can't be later than this one.",
      lo,
      hi,
      mid,
      marks: { ...marks },
      probes,
      found: null,
      upcoming: null,
    };
  }
  yield {
    key: "done",
    kind: "done",
    tone: "bad",
    label: `First bad commit: ${COMMITS[hi].sha} "${COMMITS[hi].msg}", found in ${probes} test runs`,
    explain: `log2(${bad - good}) ≈ ${Math.ceil(Math.log2(bad - good))}: that's the most this search can take. With a script that runs the test (git bisect run), it happens unattended. "Simplify age checks" turned < 12 into < 13.`,
    lo,
    hi,
    mid: null,
    marks: { ...marks },
    probes,
    found: hi,
    upcoming: null,
  };
};

export const bisect = defineExplainer({
  name: "qa-bisect",
  simulation: sim,
  input: { default: { good: 0, bad: COMMITS.length - 1 } as BisectInput },
  predict: {
    at: (step) => step.kind === "probe",
    options: [
      { value: "good", label: "Good (tests pass)" },
      { value: "bad", label: "Bad (tests fail)" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: "Which commit message sounds like it touched the age rules?",
  },
});
