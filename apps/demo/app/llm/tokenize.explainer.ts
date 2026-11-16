import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { TEXT_PATTERN, tokenId, tokenize } from "./toy-model";

// Chapter 1: text becomes tokens. Greedy longest match over a tiny
// vocabulary; a word it lacks falls apart into smaller pieces.

const EXPLAIN = {
  start: "A model works on numbers, not letters. Its first job is to cut the text into pieces it knows, called tokens, and swap each piece for its number.",
  try: "The tokenizer starts with the longest piece that could match here, then shortens it one letter at a time until it finds a piece the vocabulary has.",
  emit: "A match: that piece becomes a token, and reading continues right after it.",
  fallback: "A word the vocabulary lacks still works, because single letters always match. It just costs more tokens, which is why rare words are expensive for a model.",
  done: "This list of numbers is all the model ever receives. Everything in the next chapters works on these ids, not on the letters.",
};

export type TokenizeInput = { text: string };
export type TokenizeKind = "start" | "try" | "emit" | "done";
export type EmittedToken = { text: string; id: number; start: number };

export type TokenizeStep = StepwiseStep<{
  kind: TokenizeKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  text: string;
  /** Tokens emitted so far. */
  tokens: EmittedToken[];
  /** Where the tokenizer is looking, as an index into `text` (-1 when done). */
  pos: number;
  /** Candidates checked at `pos`, longest first (on try and emit steps). */
  tried: string[];
}>;

const quote = (s: string) => `"${s}"`;

const sim: Simulation<TokenizeInput, TokenizeStep> = function* ({ text }) {
  const all = tokenize(text);
  const tokens: EmittedToken[] = [];
  const frame = (s: Omit<TokenizeStep, "text" | "tokens">): TokenizeStep => ({ ...s, text, tokens: [...tokens] });
  yield frame({
    key: "start",
    kind: "start",
    explain: EXPLAIN.start,
    tone: "neutral",
    label: text.trim() ? `Split "${text}" into tokens, reading left to right.` : "Nothing to split: type some words.",
    pos: all[0]?.start ?? -1,
    tried: [],
  });
  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    yield frame({
      key: `t${i}-try`,
      kind: "try",
      explain: EXPLAIN.try,
      tone: "accent",
      label: `At "${text.slice(t.start).split(" ")[0]}": find the longest piece that is in the vocabulary.`,
      // Only the first (longest) candidate: the rest would give the prediction away.
      code: [`try ${quote(t.tried[0])} first`],
      pos: t.start,
      tried: t.tried.slice(0, 1),
    });
    const id = tokenId(t.text);
    tokens.push({ text: t.text, id, start: t.start });
    const fallback = t.text.length === 1 && t.tried.length > 1;
    yield frame({
      key: `t${i}-emit`,
      kind: "emit",
      explain: fallback ? EXPLAIN.fallback : EXPLAIN.emit,
      tone: "write",
      label: fallback
        ? `No longer piece is in the vocabulary, so the single letter "${t.text}" becomes token #${id}.`
        : `"${t.text}" is in the vocabulary: it becomes token #${id}.`,
      code: [`tried ${t.tried.map(quote).join(", ")} → emit ${quote(t.text)} = ${id}`],
      pos: t.start,
      tried: t.tried,
    });
  }
  yield frame({
    key: "done",
    kind: "done",
    explain: EXPLAIN.done,
    tone: "good",
    label: all.length
      ? `${all.length} tokens. The model never sees letters, only these ids: [${tokens.map((t) => t.id).join(", ")}].`
      : "No tokens.",
    pos: -1,
    tried: [],
  });
};

export const tokenizer = defineExplainer({
  name: "llm-tokenize",
  simulation: sim,
  input: {
    default: { text: "the cats jumped" },
    // Spaces travel as "_" so the link stays readable.
    serialize: ({ text }) => text.replace(/ /g, "_"),
    parse: (raw) => {
      const text = raw.replace(/_/g, " ");
      return TEXT_PATTERN.test(text) ? { text } : null;
    },
  },
  predict: {
    at: (step) => step.kind === "try",
    options: [
      { value: "1", label: "1 letter" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4+", label: "4 or more" },
    ],
    truth: (next) => {
      if (next?.kind !== "emit") return undefined;
      const n = next.tokens[next.tokens.length - 1].text.length;
      return n >= 4 ? "4+" : String(n);
    },
    feedback: (guess, truth) =>
      guess === truth
        ? "Right: that is the longest piece the vocabulary has."
        : `Not quite: the longest piece in the vocabulary here is ${truth === "4+" ? "4 or more" : truth} letter${truth === "1" ? "" : "s"} long.`,
    hint: "Check the vocabulary under the player: the longest entry that matches the next letters wins.",
  },
});
