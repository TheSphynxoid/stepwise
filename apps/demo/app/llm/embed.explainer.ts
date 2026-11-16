import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { PROMPTS, cosine, entry, round, tokenize, type Vec } from "./toy-model";

// Chapter 2: each token id is looked up in a table of vectors. Similar
// meanings sit close together, and cosine similarity measures "close".

const EXPLAIN = {
  start: "A token's number points to a row in a big table. Each row holds a vector: a short list of numbers that stands for the token's meaning. With two numbers, a vector is a point on this map.",
  place: "Finding a token's vector is a plain table lookup. The numbers were learned in training so that words used in similar ways end up close together.",
  compare: "Cosine similarity compares the directions of two arrows from the centre: near 1 means the same direction (similar meaning), near 0 unrelated, below 0 opposite.",
  done: "From here on the model handles vectors, not words. Being close on this map is how it 'knows' that cat and dog are alike.",
};

export type PromptInput = { prompt: number };
export type EmbedKind = "start" | "place" | "compare" | "done";
export type Similarity = { a: string; b: string; cos: number };

export type EmbedStep = StepwiseStep<{
  kind: EmbedKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  tokens: string[];
  /** How many of `tokens` are on the map. */
  placed: number;
  /** The pair being compared, if any. */
  pair: [string, string] | null;
  sims: Similarity[];
}>;

export const parsePrompt = (raw: string): PromptInput | null => {
  const m = /^p(\d)$/.exec(raw);
  const prompt = m ? Number(m[1]) : -1;
  return prompt >= 0 && prompt < PROMPTS.length ? { prompt } : null;
};

const GROUP_NAME = { creature: "animals", motion: "actions", place: "places", function: "small function words", piece: "word pieces" } as const;
const fmtVec = ([x, y]: Vec) => `(${x.toFixed(2)}, ${y.toFixed(2)})`;

const sim: Simulation<PromptInput, EmbedStep> = function* ({ prompt }) {
  const tokens = tokenize(PROMPTS[prompt]).map((t) => t.text);
  const sims: Similarity[] = [];
  const frame = (s: Omit<EmbedStep, "tokens" | "sims">): EmbedStep => ({ ...s, tokens, sims: [...sims] });
  yield frame({
    key: "start",
    kind: "start",
    explain: EXPLAIN.start,
    tone: "neutral",
    label: `"${PROMPTS[prompt]}": each token gets a vector, a point on the map.`,
    placed: 0,
    pair: null,
  });
  for (let i = 0; i < tokens.length; i++) {
    const e = entry(tokens[i]);
    yield frame({
      key: `p${i}`,
      kind: "place",
      explain: EXPLAIN.place,
      tone: "write",
      label: `"${e.text}" is looked up: its vector is ${fmtVec(e.vec)}, among the ${GROUP_NAME[e.group]}.`,
      code: [`embed(${JSON.stringify(e.text)}) = ${fmtVec(e.vec)}`],
      placed: i + 1,
      pair: null,
    });
  }
  const creature = tokens.find((t) => entry(t).group === "creature")!;
  const motion = tokens.find((t) => entry(t).group === "motion")!;
  const other = creature === "dog" ? "cat" : "dog";
  const pairs: [string, string, string][] = [
    [creature, other, "two animals point the same way"],
    [creature, motion, "an animal and an action are further apart"],
    [creature, "mat", "an animal and a place point away from each other"],
  ];
  for (let j = 0; j < pairs.length; j++) {
    const [a, b, why] = pairs[j];
    const cos = round(cosine(entry(a).vec, entry(b).vec));
    sims.push({ a, b, cos });
    yield frame({
      key: `c${j}`,
      kind: "compare",
      explain: EXPLAIN.compare,
      tone: "accent",
      label: `cosine("${a}", "${b}") = ${cos.toFixed(2)}: ${why}.`,
      code: [`cos = a·b / (|a| |b|) = ${cos.toFixed(2)}`],
      placed: tokens.length,
      pair: [a, b],
    });
  }
  yield frame({
    key: "done",
    kind: "done",
    explain: EXPLAIN.done,
    tone: "good",
    label: "Meaning has become geometry: similar words are nearby points, and the model can do arithmetic on them.",
    placed: tokens.length,
    pair: null,
  });
};

export const embedding = defineExplainer({
  name: "llm-embed",
  simulation: sim,
  input: {
    default: { prompt: 0 },
    serialize: ({ prompt }) => `p${prompt}`,
    parse: parsePrompt,
  },
});
