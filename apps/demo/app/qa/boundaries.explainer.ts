import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { SHIPPED, SPEC, book, sameOutcome, type Outcome } from "./driftwood";

// Chapter 2: equivalence partitions and boundary values. The reader picks
// ages to probe; each one runs through the spec and the shipped validator.
// One probe per partition finds nothing. The bug only shows at an edge.

export const PARTITIONS = [
  { id: "low", label: "invalid", from: -Infinity, to: -1 },
  { id: "child", label: "child", from: 0, to: SPEC.childBelow - 1 },
  { id: "adult", label: "adult", from: SPEC.childBelow, to: SPEC.seniorFrom - 1 },
  { id: "senior", label: "senior", from: SPEC.seniorFrom, to: 120 },
  { id: "high", label: "invalid", from: 121, to: Infinity },
] as const;
export type PartitionId = (typeof PARTITIONS)[number]["id"];
export const partitionOf = (age: number): PartitionId => PARTITIONS.find((p) => age >= p.from && age <= p.to)!.id;

/** Lowest and highest age the probe input accepts. */
export const AGE_MIN = -5;
export const AGE_MAX = 130;
export const MAX_PROBES = 12;

export const PRESETS: { label: string; values: number[] }[] = [
  { label: "one per partition", values: [-3, 6, 30, 80, 125] },
  { label: "boundaries", values: [-1, 0, 11, 12, 13, 64, 65, 120, 121] },
];

export type BoundaryInput = { values: number[] };
export type Probe = { age: number; spec: Outcome; shipped: Outcome; mismatch: boolean };
export type BoundaryStep = StepwiseStep<{
  kind: "start" | "probe" | "result" | "done";
  explain: string;
  /** Results so far (the current probe's is included on its result frame). */
  probes: Probe[];
  /** The age under test on probe and result frames. */
  current: number | null;
  /** On probe frames: will the two builds disagree? (for predict) */
  upcoming: "agree" | "disagree" | null;
}>;

const show = (o: Outcome) => (o.ok ? `${o.tier}, $${o.total}` : `rejected (${o.error})`);

const sim: Simulation<BoundaryInput, BoundaryStep> = function* ({ values }) {
  const probes: Probe[] = [];
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `Probe ${values.length} age${values.length === 1 ? "" : "s"} against the spec and the shipped build`,
    explain:
      "Ages split into partitions: groups the system should treat the same way. Testing one value per partition is equivalence partitioning. Testing the values on each side of every edge is boundary value analysis.",
    probes: [],
    current: null,
    upcoming: null,
  };
  for (let i = 0; i < values.length; i++) {
    const age = values[i];
    const input = { age, qty: 1, code: "" };
    const p: Probe = { age, spec: book(input, SPEC), shipped: book(input, SHIPPED), mismatch: false };
    p.mismatch = !sameOutcome(p.spec, p.shipped);
    const part = partitionOf(age);
    const edge = PARTITIONS.some((q) => q.from === age || q.to === age);
    yield {
      key: `probe.${age}.${i}`,
      kind: "probe",
      tone: "accent",
      label: `Age ${age}: the ${PARTITIONS.find((q) => q.id === part)!.label} partition${edge ? ", right on an edge" : ""}`,
      explain: edge
        ? "An edge value: the last or first age of its partition. If the code says < where it should say <=, this is where it shows."
        : "A value from the middle of its partition. It checks the partition's rule, but can't tell where the partition ends.",
      probes: [...probes],
      current: age,
      upcoming: p.mismatch ? "disagree" : "agree",
    };
    probes.push(p);
    yield {
      key: `result.${age}.${i}`,
      kind: "result",
      tone: p.mismatch ? "bad" : "good",
      label: p.mismatch
        ? `Age ${age}: spec says ${show(p.spec)}, shipped says ${show(p.shipped)}. Bug.`
        : `Age ${age}: both say ${show(p.spec)}`,
      explain: p.mismatch
        ? "Found it: the shipped code puts the child/adult edge one year too high. A value in the middle of a partition could never show this."
        : "Same answer from both. On its own, a pass doesn't prove the edges are right.",
      probes: [...probes],
      current: age,
      upcoming: null,
    };
  }
  const bugs = probes.filter((p) => p.mismatch).length;
  yield {
    key: "done",
    kind: "done",
    tone: bugs ? "bad" : "good",
    label: bugs ? `${bugs} probe${bugs === 1 ? "" : "s"} caught the bug` : `All ${probes.length} probes agree. Bug not found.`,
    explain: bugs
      ? "Interview answer: partitions tell you which values are alike; boundaries tell you where bugs live. Test min-1, min, max, max+1 for every range."
      : "Every probe passed, and the bug is still there. Try the boundaries preset, or just ages 11, 12 and 13.",
    probes,
    current: null,
    upcoming: null,
  };
};

export const boundaries = defineExplainer({
  name: "qa-boundaries",
  simulation: sim,
  input: {
    default: { values: PRESETS[0].values } as BoundaryInput,
    serialize: ({ values }) => values.join("_"),
    parse: (s) => {
      const values = s.split("_").map(Number);
      const ok = values.length >= 1 && values.length <= MAX_PROBES && values.every((v) => Number.isInteger(v) && v >= AGE_MIN && v <= AGE_MAX);
      return ok ? { values } : null;
    },
  },
  predict: {
    at: (step) => step.kind === "probe",
    options: [
      { value: "agree", label: "Both agree" },
      { value: "disagree", label: "They disagree (bug!)" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: "Is this age the first or last of its partition?",
  },
});
