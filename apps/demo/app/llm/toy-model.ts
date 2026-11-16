// The /llm lesson's toy language model: every number here is hand-made so
// the reader can check the arithmetic. Real models learn thousands of
// dimensions, separate query/key/value projections and many layers; this
// one has 2-D vectors, one hand-written attention rule and a lookup table.
// Pure data and functions (no "use client"): the explainer definitions run
// it on the server at build time and again in the browser.

export type Vec = [number, number];
export type Group = "creature" | "motion" | "place" | "function" | "piece";

export interface VocabEntry {
  text: string;
  vec: Vec;
  group: Group;
}

const at = (deg: number, r: number): Vec => {
  const a = (deg * Math.PI) / 180;
  return [round(r * Math.cos(a)), round(r * Math.sin(a))];
};
export const round = (x: number, places = 2) => {
  const f = 10 ** places;
  return Math.round(x * f) / f;
};

const WORDS: VocabEntry[] = [
  // Creatures sit up top, motions to the right, places to the left, the
  // little function words near the middle: distance is meaning.
  { text: "cat", vec: [0.15, 0.85], group: "creature" },
  { text: "dog", vec: [0.25, 0.8], group: "creature" },
  { text: "bird", vec: [-0.1, 0.85], group: "creature" },
  { text: "fox", vec: [0.35, 0.75], group: "creature" },
  { text: "sat", vec: [0.8, 0.3], group: "motion" },
  { text: "ran", vec: [0.85, 0.15], group: "motion" },
  { text: "sang", vec: [0.75, 0.4], group: "motion" },
  { text: "went", vec: [0.9, 0.05], group: "motion" },
  { text: "jump", vec: [0.8, 0.1], group: "motion" },
  { text: "mat", vec: [-0.75, -0.35], group: "place" },
  { text: "park", vec: [-0.85, -0.2], group: "place" },
  { text: "tree", vec: [-0.7, -0.5], group: "place" },
  { text: "hill", vec: [-0.9, -0.05], group: "place" },
  { text: "home", vec: [-0.6, -0.6], group: "place" },
  { text: "the", vec: [0.05, -0.2], group: "function" },
  { text: "a", vec: [0.1, -0.15], group: "function" },
  { text: "on", vec: [-0.2, -0.2], group: "function" },
  { text: "to", vec: [-0.15, -0.25], group: "function" },
  { text: "in", vec: [-0.25, -0.15], group: "function" },
  { text: "and", vec: [0.15, -0.1], group: "function" },
  { text: ".", vec: [0, -0.3], group: "function" },
  // Pieces of words: a word the vocabulary lacks is built from these.
  { text: "ing", vec: [0.3, -0.05], group: "piece" },
  { text: "ed", vec: [0.35, 0], group: "piece" },
  { text: "er", vec: [0.2, 0.05], group: "piece" },
  { text: "s", vec: [0.05, 0.1], group: "piece" },
];

// Every single letter is a token too, so any a-z text can be tokenized.
const LETTERS: VocabEntry[] = "abcdefghijklmnopqrstuvwxyz"
  .split("")
  .filter((ch) => !WORDS.some((w) => w.text === ch))
  .map((ch, i) => ({ text: ch, vec: at(i * 137.5, 0.12), group: "piece" as const }));

export const VOCAB: readonly VocabEntry[] = [...WORDS, ...LETTERS];
const BY_TEXT = new Map(VOCAB.map((v) => [v.text, v]));
const MAX_LEN = Math.max(...VOCAB.map((v) => v.text.length));

export const entry = (text: string): VocabEntry => {
  const e = BY_TEXT.get(text);
  if (!e) throw new Error(`not in the toy vocabulary: ${JSON.stringify(text)}`);
  return e;
};
export const tokenId = (text: string) => VOCAB.findIndex((v) => v.text === text);

// ── Tokenizer ────────────────────────────────────────────────────────────

export interface Token {
  text: string;
  /** Index of the token's first character in the input. */
  start: number;
  /** The candidates checked at this position, longest first; the last is the match. */
  tried: string[];
}

/** Text the tokenizer accepts: lowercase a-z and spaces, at most 40 characters. */
export const TEXT_PATTERN = /^[a-z ]{0,40}$/;

/** Greedy longest match over VOCAB, one word at a time; spaces separate words and are not tokens. */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === " ") {
      i++;
      continue;
    }
    let end = i;
    while (end < text.length && text[end] !== " ") end++;
    const tried: string[] = [];
    for (let len = Math.min(MAX_LEN, end - i); len >= 1; len--) {
      const piece = text.slice(i, i + len);
      tried.push(piece);
      if (BY_TEXT.has(piece)) break;
    }
    const match = tried[tried.length - 1];
    out.push({ text: match, start: i, tried });
    i += match.length;
  }
  return out;
}

// ── Vector math ──────────────────────────────────────────────────────────

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
export const norm = (a: Vec) => Math.hypot(a[0], a[1]);
export const cosine = (a: Vec, b: Vec) => dot(a, b) / (norm(a) * norm(b) || 1);

export function softmax(xs: number[], temperature = 1): number[] {
  const scaled = xs.map((x) => x / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// ── Attention ────────────────────────────────────────────────────────────

export const PROMPTS: readonly string[] = ["the cat sat on the", "a dog ran to the", "the bird sang in the"];

/**
 * The query the last token asks with. A real model learns this projection;
 * the toy's rule: a function word looks for the creature and the action
 * before it (a point between those clusters); any other token asks with
 * its own embedding.
 */
export function queryFor(text: string): Vec {
  const e = entry(text);
  return e.group === "function" || e.group === "piece" ? [0.6, 0.6] : e.vec;
}

/** Scores are scaled so the softmax is decisive enough to see. */
export const ATTENTION_SCALE = 4 / Math.SQRT2;

export function attention(tokens: string[]): { query: Vec; scores: number[]; weights: number[]; context: Vec } {
  const query = queryFor(tokens[tokens.length - 1]);
  const scores = tokens.map((t) => dot(query, entry(t).vec) * ATTENTION_SCALE);
  const weights = softmax(scores);
  const context: Vec = [0, 0];
  tokens.forEach((t, i) => {
    context[0] += weights[i] * entry(t).vec[0];
    context[1] += weights[i] * entry(t).vec[1];
  });
  return { query, scores, weights, context };
}

// ── Next token ───────────────────────────────────────────────────────────

/** What usually follows a token: a hand-written stand-in for learned weights. */
const FOLLOWS: Record<string, Record<string, number>> = {
  the: { mat: 0.5, park: 0.5, tree: 0.5, hill: 0.3, cat: 0.2, dog: 0.2 },
  a: { mat: 0.5, park: 0.5, tree: 0.5, hill: 0.3, cat: 0.2, dog: 0.2 },
  on: { the: 1.2, a: 0.8 },
  to: { the: 1.2, a: 0.8 },
  in: { the: 1.2, a: 0.8 },
  and: { the: 1, a: 0.6, ran: 0.3, sat: 0.3 },
  creature: { sat: 0.8, ran: 0.8, sang: 0.6, ".": 0.2 },
  motion: { on: 0.6, to: 0.6, in: 0.6, ".": 0.3 },
  place: { ".": 1.2, and: 0.6, in: 0.2 },
};

/** Which words pull which continuations: an attended "sat" votes for "mat". */
const PULLS: Record<string, Record<string, number>> = {
  sat: { mat: 2, on: 0.5 },
  ran: { park: 2, to: 0.5 },
  sang: { tree: 2, in: 0.5 },
  cat: { mat: 0.6 },
  dog: { park: 0.6 },
  bird: { tree: 0.6 },
};

export const PULL_WEIGHT = 2;

export interface Logit {
  token: string;
  /** From the last token alone (FOLLOWS). */
  base: number;
  /** From the attended words (PULLS, weighted by attention). */
  pull: number;
  logit: number;
}

/** Candidate next tokens with their scores, in a fixed order. */
export function nextLogits(tokens: string[]): Logit[] {
  const last = tokens[tokens.length - 1];
  const table = FOLLOWS[last] ?? FOLLOWS[entry(last).group] ?? { ".": 1 };
  const { weights } = attention(tokens);
  return Object.entries(table).map(([token, base]) => {
    let pull = 0;
    tokens.forEach((t, i) => (pull += weights[i] * (PULLS[t]?.[token] ?? 0)));
    pull = PULL_WEIGHT * pull;
    return { token, base, pull: round(pull, 3), logit: round(base + pull, 3) };
  });
}

// ── Retrieval: the rulebook of an invented game ──────────────────────────

export interface Section {
  id: string;
  title: string;
}

export const SECTIONS: readonly Section[] = [
  { id: "setup", title: "Setup" },
  { id: "turns", title: "Turns" },
  { id: "scoring", title: "Scoring" },
  { id: "tides", title: "Tides" },
  { id: "ties", title: "Ties" },
  { id: "end", title: "End of the game" },
];

export interface Chunk {
  id: string;
  section: string;
  text: string;
  /** A hand-placed embedding: the direction is the topic. */
  vec: Vec;
}

/** Tidepool's rulebook, already split into chunks (chapter 7 shows the split). */
export const CHUNKS: readonly Chunk[] = [
  { id: "setup-1", section: "setup", text: "Each player starts with five tiles and one shell marker.", vec: at(40, 0.85) },
  { id: "setup-2", section: "setup", text: "Shuffle the tide cards and put the board between the players.", vec: at(62, 0.7) },
  { id: "turns-1", section: "turns", text: "On your turn, place one tile next to a tile already on the board.", vec: at(15, 0.8) },
  { id: "turns-2", section: "turns", text: "After placing, draw a tile from the bag. Play passes to the left.", vec: at(78, 0.85) },
  { id: "scoring-1", section: "scoring", text: "A pool is a ring of tiles closed on every side.", vec: at(120, 0.8) },
  { id: "scoring-2", section: "scoring", text: "A closed pool scores one point per tile in its ring, plus two if a shell is inside.", vec: at(150, 0.85) },
  { id: "tides-1", section: "tides", text: "When a tide card is drawn, every open pool loses its outermost tile.", vec: at(168, 0.75) },
  { id: "tides-2", section: "tides", text: "High tide doubles the score of the next pool closed.", vec: at(104, 0.65) },
  { id: "ties-1", section: "ties", text: "If the scores are tied, the player with fewer tiles left in hand wins.", vec: at(206, 0.8) },
  { id: "ties-2", section: "ties", text: "If they are still tied, the players share the win.", vec: at(250, 0.75) },
  { id: "end-1", section: "end", text: "The game ends when the bag is empty and nobody can place a tile.", vec: at(290, 0.85) },
  { id: "end-2", section: "end", text: "Add up every closed pool. The highest total wins.", vec: at(322, 0.8) },
];

export const chunk = (id: string): Chunk => {
  const c = CHUNKS.find((x) => x.id === id);
  if (!c) throw new Error(`no chunk ${id}`);
  return c;
};

export interface Question {
  id: string;
  text: string;
  vec: Vec;
  /** The chunk that truly answers it. */
  answerChunk: string;
  /** What the model says from the chunk it leans on (keyed by chunk id). */
  answers: Record<string, string>;
  /** What it says with no retrieval: fluent, confident, wrong. */
  closedBook: string;
}

export const QUESTIONS: readonly Question[] = [
  {
    id: "start-tiles",
    text: "How many tiles does each player start with?",
    vec: at(43, 0.8),
    answerChunk: "setup-1",
    answers: { "setup-1": "Each player starts with five tiles (and one shell marker)." },
    closedBook: "Each player starts with seven tiles, as in most tile-laying games.",
  },
  {
    id: "scoring",
    text: "How many points does a closed pool score?",
    vec: at(130, 0.8),
    answerChunk: "scoring-2",
    answers: {
      "scoring-1": "A closed pool scores one point. (The passage only defines a pool, so the rest is a guess.)",
      "scoring-2": "One point per tile in its ring, plus two if a shell is inside.",
    },
    closedBook: "A closed pool scores ten points.",
  },
  {
    id: "tie-break",
    text: "Who wins if the scores are tied?",
    vec: at(198, 0.8),
    answerChunk: "ties-1",
    answers: {
      "ties-1": "The player with fewer tiles left in hand wins.",
      "tides-1": "The passage is about tides, not ties, so the model guesses: the player who went first wins.",
    },
    closedBook: "The youngest player wins a tie.",
  },
];

export const question = (id: string): Question => {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
};

export interface Scored {
  id: string;
  score: number;
}

/** Exact search: score every chunk by cosine similarity, best first, keep k. */
export function retrieve(vec: Vec, k: number): Scored[] {
  return CHUNKS.map((c) => ({ id: c.id, score: round(cosine(vec, c.vec), 3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** The answer grounded in the retrieved chunks: the answering chunk if it was retrieved, else the top one. */
export function ragAnswer(q: Question, top: Scored[]): { chunk: string; text: string } {
  const used = top.some((s) => s.id === q.answerChunk) ? q.answerChunk : top[0].id;
  return { chunk: used, text: q.answers[used] ?? q.closedBook };
}

// ── The vector index: chunks grouped into buckets around centroids ───────

export const CENTROIDS: readonly Vec[] = [at(45, 0.45), at(135, 0.45), at(270, 0.45)];

/** Centroid indices, most similar first. */
export function nearestCentroids(vec: Vec): number[] {
  return CENTROIDS.map((c, i) => ({ i, s: cosine(vec, c) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);
}

export const bucketOf = (vec: Vec) => nearestCentroids(vec)[0];

/** Approximate search: scan only the `nprobe` nearest buckets. */
export function probeIndex(vec: Vec, nprobe: number): { buckets: number[]; scanned: Scored[]; best: string } {
  const buckets = nearestCentroids(vec).slice(0, nprobe);
  const scanned = CHUNKS.filter((c) => buckets.includes(bucketOf(c.vec)))
    .map((c) => ({ id: c.id, score: round(cosine(vec, c.vec), 3) }))
    .sort((a, b) => b.score - a.score);
  return { buckets, scanned, best: scanned[0].id };
}
