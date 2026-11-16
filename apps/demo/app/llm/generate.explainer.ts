import { createRng, defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { PROMPTS, nextLogits, round, softmax, tokenize } from "./toy-model";

// Chapter 4: score every candidate next token, turn scores into
// probabilities (temperature reshapes them), draw one at random, append it,
// repeat. The draw is seeded per round, so changing the temperature keeps
// the dice and only moves the odds.

const EXPLAIN = {
  start: "Generation is a loop: score every possible next token, turn the scores into odds, pick one at random by those odds, add it to the text, and repeat.",
  logits: "Each candidate gets a score, called a logit. In this toy it is two numbers added together: how often the word follows the last token, plus a bonus from the words attention focused on.",
  probs: "Softmax turns the scores into probabilities. Temperature divides the scores first: a low temperature widens the gaps, so the favourite almost always wins; a high one narrows them, so surprises become likely.",
  draw: "The model rolls a number between 0 and 1 and takes the token whose slice of the bar it lands in. A likelier token has a wider slice, so it wins more often, but not every time.",
  append: "The chosen token joins the text, and the whole loop runs again on the longer text. One loop, one token.",
  done: "That is all text generation is: a very good guess at the next token, made over and over. Nothing in this loop checks whether the result is true.",
};

export type GenerateInput = { prompt: number; temperature: number; seed: number };
export type GenerateKind = "start" | "logits" | "probs" | "draw" | "append" | "done";
export type Candidate = { token: string; base: number; pull: number; logit: number; p: number };

export type GenerateStep = StepwiseStep<{
  kind: GenerateKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  /** The text so far, as tokens. */
  tokens: string[];
  /** How many tokens the prompt had; the rest were generated. */
  promptLength: number;
  round: number;
  cands: Candidate[];
  /** The random number of this round's draw (in [0, 1)), once drawn. */
  u: number | null;
  chosen: string | null;
  argmax: string | null;
  temperature: number;
}>;

export const TEMPERATURES = [0.2, 0.7, 1, 1.5] as const;
export const MAX_SEED = 99;
const MAX_ROUNDS = 4;
const f2 = (x: number) => x.toFixed(2);

const sim: Simulation<GenerateInput, GenerateStep> = function* ({ prompt, temperature, seed }) {
  const tokens = tokenize(PROMPTS[prompt]).map((t) => t.text);
  const promptLength = tokens.length;
  const frame = (s: Omit<GenerateStep, "tokens" | "promptLength" | "temperature">): GenerateStep => ({
    ...s,
    tokens: [...tokens],
    promptLength,
    temperature,
  });
  const empty = { cands: [], u: null, chosen: null, argmax: null };
  yield frame({
    ...empty,
    key: "start",
    kind: "start",
    explain: EXPLAIN.start,
    tone: "neutral",
    label: `Continue "${PROMPTS[prompt]}" one token at a time, at temperature ${temperature}.`,
    round: 0,
  });
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const logits = nextLogits(tokens);
    const probs = softmax(logits.map((l) => l.logit), temperature);
    const cands = logits.map((l, i) => ({ ...l, p: round(probs[i], 3) }));
    const argmax = cands.reduce((a, b) => (b.p > a.p ? b : a)).token;
    yield frame({
      ...empty,
      cands,
      key: `r${r}-logits`,
      kind: "logits",
      explain: EXPLAIN.logits,
      tone: "accent",
      label: `Round ${r + 1}: score each candidate. What usually follows "${tokens[tokens.length - 1]}", plus a vote from the words attention picked out.`,
      code: cands.map((c) => `${JSON.stringify(c.token).padEnd(7)} ${f2(c.base)} + ${f2(c.pull)} = ${f2(c.logit)}`),
      round: r,
    });
    yield frame({
      ...empty,
      cands,
      argmax,
      key: `r${r}-probs`,
      kind: "probs",
      explain: EXPLAIN.probs,
      tone: "accent",
      label: `Softmax at temperature ${temperature} turns the scores into odds: "${argmax}" is most likely, at ${Math.round(cands.find((c) => c.token === argmax)!.p * 100)}%.`,
      code: [`p = softmax(scores / ${temperature})`],
      round: r,
    });
    // One generator per round, so the temperature never changes which number is drawn.
    const u = round(createRng(`${seed}:${r}`).next(), 3);
    let acc = 0;
    let chosen = cands[cands.length - 1].token;
    for (const c of cands) {
      acc += c.p;
      if (u < acc) {
        chosen = c.token;
        break;
      }
    }
    yield frame({
      cands,
      u,
      chosen,
      argmax,
      key: `r${r}-draw`,
      kind: "draw",
      explain: EXPLAIN.draw,
      tone: chosen === argmax ? "write" : "bad",
      label:
        chosen === argmax
          ? `The dice say ${u.toFixed(3)}: that lands on "${chosen}", the most likely token.`
          : `The dice say ${u.toFixed(3)}: that lands on "${chosen}", not the favourite "${argmax}". Sampling sometimes picks an unlikely token.`,
      code: [`u = rng(seed ${seed}, round ${r + 1}) = ${u.toFixed(3)} → ${JSON.stringify(chosen)}`],
      round: r,
    });
    tokens.push(chosen);
    yield frame({
      cands,
      u,
      chosen,
      argmax,
      key: `r${r}-append`,
      kind: "append",
      explain: EXPLAIN.append,
      tone: "write",
      label: `Append "${chosen}". The new text goes back in as the prompt for the next round.`,
      round: r,
    });
    if (chosen === ".") break;
  }
  yield frame({
    ...empty,
    key: "done",
    kind: "done",
    explain: EXPLAIN.done,
    tone: "good",
    label: `Finished: "${tokens.join(" ").replace(" .", ".")}"`,
    round: MAX_ROUNDS,
  });
};

export const generation = defineExplainer({
  name: "llm-generate",
  simulation: sim,
  input: {
    default: { prompt: 0, temperature: 0.7, seed: 1 },
    serialize: ({ prompt, temperature, seed }) => `p${prompt}~t${temperature}~s${seed}`,
    parse: (raw) => {
      const m = /^p(\d)~t([\d.]+)~s(\d+)$/.exec(raw);
      if (!m) return null;
      const prompt = Number(m[1]);
      const temperature = Number(m[2]);
      const seed = Number(m[3]);
      if (prompt >= PROMPTS.length || !(TEMPERATURES as readonly number[]).includes(temperature)) return null;
      if (seed < 1 || seed > MAX_SEED) return null;
      return { prompt, temperature, seed };
    },
  },
  predict: {
    at: (step) => step.kind === "probs",
    options: [
      { value: "yes", label: "Yes, the favourite" },
      { value: "no", label: "No, an underdog" },
    ],
    truth: (next) => (next?.kind === "draw" ? (next.chosen === next.argmax ? "yes" : "no") : undefined),
    feedback: (guess, truth, held) => {
      const fav = held.cands.find((c) => c.token === held.argmax)!;
      const pct = Math.round(fav.p * 100);
      if (guess === truth) return truth === "yes" ? `Right: at ${pct}% the favourite usually wins.` : `Right: the favourite had only ${pct}%, and this time it lost.`;
      return truth === "yes" ? `Not this time: the favourite had ${pct}%.` : `Unlucky: the favourite had ${pct}%, and the dice went the other way.`;
    },
    hint: "Lower temperature makes the favourite safer; higher makes upsets common.",
  },
});
