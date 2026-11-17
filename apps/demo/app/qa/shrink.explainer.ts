import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { DEFAULT_PAYLOAD, FAILING_PAYLOAD, PAYLOAD_FIELDS, payloadFails, type Payload } from "./tidepool";

// Chapter 10a: the minimal repro. A customer's checkout crashed; this is
// what they sent. Reset one field at a time to a plain value and re-run:
// if it still fails, that field didn't matter. What's left is the bug
// report's repro steps. (A one-at-a-time pass is the simplest form of
// delta debugging; ddmin removes halves first, then smaller chunks.)

/** No real input: the kit needs an object type, and an empty one breaks prop typing (docs/KIT-FEEDBACK.md). */
export type ShrinkInput = { report: "checkout" };
export type ShrinkStep = StepwiseStep<{
  kind: "start" | "try" | "result" | "done";
  explain: string;
  payload: Payload;
  /** Fields still at the customer's value (the suspects). */
  kept: (keyof Payload)[];
  /** The field being reset on try/result frames. */
  field: keyof Payload | null;
  /** Did the last run (with `field` reset) still fail? */
  fails: boolean | null;
  runs: number;
  upcoming: "fails" | "passes" | null;
}>;

const sim: Simulation<ShrinkInput, ShrinkStep> = function* () {
  let payload: Payload = { ...FAILING_PAYLOAD };
  let kept = [...PAYLOAD_FIELDS];
  let runs = 1;
  yield {
    key: "start",
    kind: "start",
    tone: "bad",
    label: "The customer's payload crashes checkout. 8 fields; which ones matter?",
    explain:
      "\"Checkout crashed\" with an 8-field payload is a bad bug report. A developer can't tell what matters. Before filing, shrink it: the smaller the repro, the faster the fix.",
    payload,
    kept,
    field: null,
    fails: true,
    runs,
    upcoming: null,
  };
  for (const field of PAYLOAD_FIELDS) {
    const candidate = { ...payload, [field]: DEFAULT_PAYLOAD[field] } as Payload;
    const fails = payloadFails(candidate);
    runs++;
    yield {
      key: `try.${field}`,
      kind: "try",
      tone: "accent",
      label: `Reset ${field}: ${JSON.stringify(payload[field])} → ${JSON.stringify(DEFAULT_PAYLOAD[field])}, and run again`,
      explain: "One change at a time, then re-run. If the crash survives the change, the field was noise.",
      payload: candidate,
      kept,
      field,
      fails: null,
      runs,
      upcoming: fails ? "fails" : "passes",
    };
    if (fails) {
      payload = candidate;
      kept = kept.filter((f) => f !== field);
    }
    yield {
      key: `result.${field}`,
      kind: "result",
      tone: fails ? "write" : "good",
      label: fails ? `Still crashes: ${field} doesn't matter. Keep the reset.` : `Passes: ${field} matters. Put it back.`,
      explain: fails
        ? "Crossed off. Fewer suspects, same crash."
        : "The crash went away, so this field is part of the trigger. Restore the customer's value and move on.",
      payload,
      kept,
      field,
      fails,
      runs,
      upcoming: null,
    };
  }
  yield {
    key: "done",
    kind: "done",
    tone: "bad",
    label: `Minimal repro: ${kept.map((f) => `${f}=${JSON.stringify(payload[f])}`).join(" and ")} (${runs} runs)`,
    explain:
      "Two fields, and neither crashes alone: 9 tickets get through (the boundary bug), and SURF10 on a 9-ticket order hits a pricing path nobody tested. That interaction is the bug report's title.",
    payload,
    kept,
    field: null,
    fails: true,
    runs,
    upcoming: null,
  };
};

export const shrink = defineExplainer({
  name: "qa-shrink",
  simulation: sim,
  input: { default: { report: "checkout" } as ShrinkInput },
  predict: {
    at: (step) => step.kind === "try",
    options: [
      { value: "fails", label: "Still crashes" },
      { value: "passes", label: "Now passes" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: "The crash needs a 9-ticket order with SURF10. Is this field one of those?",
  },
});
