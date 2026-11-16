import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { PROMPTS, attention, entry, round, tokenize, type Vec } from "./toy-model";
import { parsePrompt, type PromptInput } from "./embed.explainer";

// Chapter 3: the last token asks a question (its query), every token
// answers with how well it matches (a score), softmax turns scores into
// weights, and the weighted mix of vectors is what the model carries on with.

const EXPLAIN = {
  query: "On its own, the last word says little about what comes next. Attention lets it look back at the earlier words. First it forms a query: a vector that describes what it is looking for.",
  score: "Each word is scored by how well its vector lines up with the query (a dot product: multiply the matching numbers and add them up). A high score means 'this word matters here'.",
  softmax: "Raw scores can be any size. Softmax turns them into percentages that add up to 100%, and the highest scores get most of the share.",
  mix: "The last word's new vector is a blend of all the words' vectors, mixed by those percentages. It now carries the meaning of the words it attended to, not just its own.",
  done: "This blending is how a model uses context. Real models run it many times side by side (attention heads) and one after another (layers).",
};

export type AttendKind = "query" | "score" | "softmax" | "mix" | "done";

export type AttendStep = StepwiseStep<{
  kind: AttendKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  tokens: string[];
  query: Vec;
  /** Final scores and weights; the view shows them once the step reaches them. */
  scores: number[];
  weights: number[];
  context: Vec;
  /** How many scores are revealed. */
  scored: number;
}>;

const f2 = (x: number) => x.toFixed(2);

const sim: Simulation<PromptInput, AttendStep> = function* ({ prompt }) {
  const tokens = tokenize(PROMPTS[prompt]).map((t) => t.text);
  const a = attention(tokens);
  const scores = a.scores.map((x) => round(x));
  const weights = a.weights.map((x) => round(x));
  const context: Vec = [round(a.context[0]), round(a.context[1])];
  const lastTok = tokens[tokens.length - 1];
  const base = { tokens, query: a.query, scores, weights, context };
  yield {
    ...base,
    key: "query",
    kind: "query",
    explain: EXPLAIN.query,
    tone: "neutral",
    label: `The last token, "${lastTok}", asks a question: its query vector (${f2(a.query[0])}, ${f2(a.query[1])}), which points between the animals and the actions.`,
    code: [`q = query("${lastTok}") = (${f2(a.query[0])}, ${f2(a.query[1])})`],
    scored: 0,
  };
  for (let i = 0; i < tokens.length; i++) {
    const v = entry(tokens[i]).vec;
    yield {
      ...base,
      key: `s${i}`,
      kind: "score",
      explain: EXPLAIN.score,
      tone: "accent",
      label: `"${tokens[i]}" answers with a score of ${f2(scores[i])}: how well its vector matches the query.`,
      code: [`score = q·k / √2 × 4 = (${f2(a.query[0])}·${f2(v[0])} + ${f2(a.query[1])}·${f2(v[1])}) × 2.83 = ${f2(scores[i])}`],
      scored: i + 1,
    };
  }
  const top = weights.indexOf(Math.max(...weights));
  yield {
    ...base,
    key: "softmax",
    kind: "softmax",
    explain: EXPLAIN.softmax,
    tone: "write",
    label: `Softmax turns the scores into weights that add up to 1. "${tokens[top]}" gets the most: ${Math.round(weights[top] * 100)}%.`,
    code: [`softmax([${scores.map(f2).join(", ")}])`, `  = [${weights.map(f2).join(", ")}]`],
    scored: tokens.length,
  };
  yield {
    ...base,
    key: "mix",
    kind: "mix",
    explain: EXPLAIN.mix,
    tone: "write",
    label: `The weighted mix of all the vectors is (${f2(context[0])}, ${f2(context[1])}): "${lastTok}" now carries what it learned from the words it attended to.`,
    code: [`context = Σ weight_i × v_i = (${f2(context[0])}, ${f2(context[1])})`],
    scored: tokens.length,
  };
  yield {
    ...base,
    key: "done",
    kind: "done",
    explain: EXPLAIN.done,
    tone: "good",
    label: `Done: "${lastTok}" now means mostly ${tokens
      .map((t, i) => ({ t, w: weights[i] }))
      .filter((x, i, all) => all.findIndex((y) => y.t === x.t) === i && x.w >= 0.1)
      .sort((a, b) => b.w - a.w)
      .map((x) => `"${x.t}" (${Math.round(x.w * 100)}%)`)
      .join(" and ")}.`,
    scored: tokens.length,
  };
};

export const attending = defineExplainer({
  name: "llm-attend",
  simulation: sim,
  input: {
    default: { prompt: 0 },
    serialize: ({ prompt }) => `p${prompt}`,
    parse: parsePrompt,
  },
  predict: {
    at: (step) => step.kind === "query",
    options: [
      { value: "content", label: "A content word (animal or action)" },
      { value: "function", label: "A function word (the, on, to…)" },
    ],
    truth: (_next, held) => {
      const top = held.weights.indexOf(Math.max(...held.weights));
      return entry(held.tokens[top]).group === "function" ? "function" : "content";
    },
    feedback: (guess, truth) =>
      guess === truth
        ? "Right: the query points toward the animals and actions, so they score highest."
        : "Not quite: the query points toward the animals and actions, not the little function words.",
    hint: "Where does the query vector point on the map?",
  },
});
