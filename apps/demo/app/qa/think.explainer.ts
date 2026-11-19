import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";

// Chapter 1: "How would you test this?" The interview's opening question,
// answered as a sweep through fixed categories, so nothing big is
// forgotten under pressure. One frame per test idea.

export const CATEGORIES = [
  { id: "functional", label: "Happy path", hint: "Does it do the job at all?" },
  { id: "boundary", label: "Boundaries", hint: "Edges of every range" },
  { id: "negative", label: "Negative", hint: "Bad input, rejected politely" },
  { id: "state", label: "State", hint: "Order of operations, repeats" },
  { id: "integration", label: "Integration", hint: "API, DB, other services" },
  { id: "ui", label: "UI / a11y", hint: "Keyboard, screen readers, layouts" },
  { id: "nonfunctional", label: "Non-functional", hint: "Speed, load, security" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];

export const FEATURES = ["form", "lifecycle", "api"] as const;
export type Feature = (typeof FEATURES)[number];
export const FEATURE_LABEL: Record<Feature, string> = {
  form: "the booking form",
  lifecycle: "booking status changes",
  api: "the bookings API",
};

const IDEAS: Record<Feature, Record<Category, string[]>> = {
  form: {
    functional: ["Adult, 2 tickets, no code: booking succeeds with the right total"],
    boundary: ["Ages 11/12 and 64/65 (tier edges), 0 and 120", "Quantity 1 and 8 accepted; 0 and 9 rejected"],
    negative: ["Age -1, 2.5, \"ten\", empty", "Unknown promo code; code with trailing space"],
    state: ["Double-click Book: one booking, not two", "Back button after paying"],
    integration: ["The total shown matches what the API charges"],
    ui: ["Whole form usable by keyboard; errors announced", "Narrow phone screen, 200% zoom"],
    nonfunctional: ["Price can't be changed in the request (tampering)", "Form still answers in 1 s under load"],
  },
  lifecycle: {
    functional: ["draft → held → paid → issued works end to end"],
    boundary: ["Hold expires at exactly 15:00, not 14:59"],
    negative: ["Every action that shouldn't be allowed in each state (refund a draft?)"],
    state: ["Cancel twice; pay a cancelled booking", "Two tabs pay the same booking"],
    integration: ["Refund actually reaches the payment provider"],
    ui: ["Status badge and buttons match the real state"],
    nonfunctional: ["Audit log records each transition"],
  },
  api: {
    functional: ["POST a valid booking: 201 and the booking back"],
    boundary: ["Largest allowed body; id 0, id max int"],
    negative: ["Invalid body: 422 with a useful error", "Missing body: 400; unknown id: 404"],
    state: ["Same POST retried: no duplicate (idempotency)"],
    integration: ["Response matches the contract (every field, every type)"],
    ui: ["Errors are readable when the UI shows them"],
    nonfunctional: ["Auth required; rate limits; p95 latency"],
  },
};

const EXPLAIN: Record<Category | "start" | "done", string> = {
  start: "Interviewers ask \"how would you test X?\" to see whether you think in a structure or just list whatever comes to mind. A fixed sweep of categories is that structure.",
  functional: "Start with the happy path: the reason the feature exists. If this fails, nothing else matters.",
  boundary: "Bugs gather at the edges of ranges, where someone wrote < instead of <=. Test both sides of every edge.",
  negative: "Next, everything the feature should refuse. A good rejection is as much a feature as a good acceptance.",
  state: "Then order and repetition: the same action twice, actions in the wrong order, two users at once.",
  integration: "The feature talks to other parts. Check that what it says matches what they do.",
  ui: "Real people use it with keyboards, screen readers, phones and zoom. That's testing too.",
  nonfunctional: "Last, the qualities no single click shows: speed, load, security. Mentioning them is what separates a senior answer.",
  done: "Seven categories, a couple of ideas each. Say them in this order and you'll rarely miss a whole area. Then ask which matter most for this product: that's risk-based testing.",
};

export type ThinkInput = { feature: Feature };
export type Idea = { cat: Category; text: string };
export type ThinkStep = StepwiseStep<{
  kind: "start" | Category | "done";
  explain: string;
  feature: Feature;
  ideas: Idea[];
}>;

const sim: Simulation<ThinkInput, ThinkStep> = function* ({ feature }) {
  const all: Idea[] = CATEGORIES.flatMap((c) => IDEAS[feature][c.id].map((text) => ({ cat: c.id, text })));
  const base = { feature };
  yield {
    ...base,
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `"How would you test ${FEATURE_LABEL[feature]}?"`,
    explain: EXPLAIN.start,
    ideas: [],
  };
  for (let i = 0; i < all.length; i++) {
    const idea = all[i];
    const first = i === 0 || all[i - 1].cat !== idea.cat;
    yield {
      ...base,
      key: `${idea.cat}.${i}`,
      kind: idea.cat,
      tone: idea.cat === "boundary" || idea.cat === "negative" ? "accent" : "write",
      label: `${CATEGORIES.find((c) => c.id === idea.cat)!.label}: ${idea.text}`,
      explain: first ? EXPLAIN[idea.cat] : "Another idea in the same category. Two or three per category is plenty in an interview.",
      ideas: all.slice(0, i + 1),
    };
  }
  yield { ...base, key: "done", kind: "done", tone: "good", label: `${all.length} test ideas in 7 categories`, explain: EXPLAIN.done, ideas: all };
};

export const think = defineExplainer({
  name: "qa-think",
  simulation: sim,
  input: {
    default: { feature: "form" } as ThinkInput,
    serialize: ({ feature }) => feature,
    parse: (s) => ((FEATURES as readonly string[]).includes(s) ? { feature: s as Feature } : null),
  },
  predict: {
    // Stop where the next idea opens a new category (not before the summary).
    at: (step, _frame, next) => next.kind !== "done" && next.kind !== step.kind,
    options: CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
    truth: (next) => next?.kind,
    hint: "The sweep goes: happy path, boundaries, negative, state, integration, UI, non-functional.",
  },
});
