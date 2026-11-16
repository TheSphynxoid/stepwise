// Invariant check for the /llm lesson's toy model: the lesson's prose and
// e2e tests rely on these behaviors (clusters, a misleading k=1, an
// nprobe=1 miss). Run: npx jiti apps/demo/scripts/check-llm-model.ts
import assert from "node:assert/strict";
import {
  CHUNKS,
  PROMPTS,
  QUESTIONS,
  VOCAB,
  attention,
  bucketOf,
  cosine,
  nearestCentroids,
  nextLogits,
  ragAnswer,
  retrieve,
  probeIndex,
  tokenize,
} from "../app/llm/toy-model";

const vec = (t: string) => {
  const v = VOCAB.find((x) => x.text === t);
  assert.ok(v, `no vocab entry ${t}`);
  return v.vec;
};
const words = (s: string) => tokenize(s).map((t) => t.text);

// Tokenizer: greedy longest match, spaces skipped, letters as fallback.
assert.deepEqual(words("the cats"), ["the", "cat", "s"]);
assert.deepEqual(words("zq"), ["z", "q"]);
assert.deepEqual(words("dogs ran"), ["dog", "s", "ran"]);
for (const p of PROMPTS) assert.ok(tokenize(p).every((t) => VOCAB.find((v) => v.text === t.text)!.group !== "piece"), `prompt ${p} is all whole words`);

// Embeddings cluster by meaning.
assert.ok(cosine(vec("cat"), vec("dog")) > 0.9, "cat ~ dog");
assert.ok(cosine(vec("cat"), vec("ran")) < 0.5, "cat !~ ran");
assert.ok(cosine(vec("sat"), vec("ran")) > 0.9, "sat ~ ran");

// Attention: the last token attends most to a content word.
for (const p of PROMPTS) {
  const toks = words(p);
  const { weights } = attention(toks);
  assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const top = toks[weights.indexOf(Math.max(...weights))];
  const group = VOCAB.find((v) => v.text === top)!.group;
  assert.notEqual(group, "function", `${p}: top attention ${top} is a function word`);
}

// Next token: plausible endings win.
const argmax = (p: string) => {
  const l = nextLogits(words(p));
  return l.reduce((a, b) => (b.logit > a.logit ? b : a)).token;
};
assert.equal(argmax(PROMPTS[0]), "mat");
assert.equal(argmax(PROMPTS[1]), "park");
assert.equal(argmax(PROMPTS[2]), "tree");

// RAG: closed book is fluent and wrong; retrieval fixes it.
const q = (id: string) => QUESTIONS.find((x) => x.id === id)!;
assert.match(q("start-tiles").closedBook, /seven/);
assert.match(ragAnswer(q("start-tiles"), retrieve(q("start-tiles").vec, 1)).text, /five/);
// k=1 is misleading for "scoring"; k=2 surfaces the answering chunk.
const s1 = ragAnswer(q("scoring"), retrieve(q("scoring").vec, 1));
const s2 = ragAnswer(q("scoring"), retrieve(q("scoring").vec, 2));
assert.notEqual(s1.chunk, q("scoring").answerChunk);
assert.equal(s2.chunk, q("scoring").answerChunk);

// Index: nprobe=1 misses the true best for "tie-break"; nprobe=2 finds it.
const tb = q("tie-break");
const exact = retrieve(tb.vec, 1)[0].id;
assert.notEqual(bucketOf(CHUNKS.find((c) => c.id === exact)!.vec), nearestCentroids(tb.vec)[0]);
assert.notEqual(probeIndex(tb.vec, 1).best, exact);
assert.equal(probeIndex(tb.vec, 2).best, exact);
// The other queries are found at nprobe=1.
for (const other of QUESTIONS.filter((x) => x.id !== "tie-break")) {
  assert.equal(probeIndex(other.vec, 1).best, retrieve(other.vec, 1)[0].id, `${other.id} found at nprobe=1`);
}

console.log("ok");

// ── The explainer definitions precompute (what the build does) ───────────
import { precompute } from "@sphynxoid/stepwise/core";
import { tokenizer } from "../app/llm/tokenize.explainer";
import { embedding } from "../app/llm/embed.explainer";
import { attending } from "../app/llm/attend.explainer";
import { generation } from "../app/llm/generate.explainer";
import { rag } from "../app/llm/rag.explainer";
import { vectorIndex } from "../app/llm/index.explainer";

const last = <S>(steps: S[]) => steps[steps.length - 1];
for (const def of [tokenizer, embedding, attending, generation, rag, vectorIndex] as const) {
  const t = precompute(def as never);
  assert.ok(t.steps.length > 2, `${def.name} has steps`);
  const keys = t.steps.map((s) => (s as { key?: string }).key);
  assert.equal(new Set(keys).size, keys.length, `${def.name}: keys are unique`);
  // Links round-trip.
  const inp = def.input as { default: unknown; serialize: (i: never) => string; parse: (s: string) => unknown };
  assert.deepEqual(inp.parse(inp.serialize(inp.default as never)), inp.default, `${def.name}: link round-trips`);
  assert.equal(inp.parse("garbage~~"), null, `${def.name}: rejects garbage`);
}
assert.deepEqual(last(precompute(tokenizer, { text: "dogs ran" }).steps).tokens.map((t) => t.text), ["dog", "s", "ran"]);
assert.match(last(precompute(rag, { question: "start-tiles", k: 2, retrieve: false }).steps).answer!.text, /seven/);
assert.match(last(precompute(rag, { question: "start-tiles", k: 2, retrieve: true }).steps).answer!.text, /five/);
const k1 = last(precompute(rag, { question: "scoring", k: 1, retrieve: true }).steps).answer!;
const k2 = last(precompute(rag, { question: "scoring", k: 2, retrieve: true }).steps).answer!;
assert.notEqual(k1.text, k2.text);
assert.equal(last(precompute(vectorIndex, { query: "tie-break", nprobe: 1 }).steps).found, false);
assert.equal(last(precompute(vectorIndex, { query: "tie-break", nprobe: 3 }).steps).found, true);
// Some seed at temperature 1.5 draws a token that is not the most likely one.
const misses = Array.from({ length: 20 }, (_, s) => precompute(generation, { prompt: 0, temperature: 1.5, seed: s + 1 }).steps)
  .flat()
  .filter((s) => s.kind === "draw" && s.chosen !== s.argmax);
assert.ok(misses.length > 0, "temperature 1.5 sometimes picks an unlikely token");
const cold = precompute(generation, { prompt: 0, temperature: 0.2, seed: 1 }).steps.filter((s) => s.kind === "draw");
assert.ok(cold.every((s) => s.chosen === s.argmax), "temperature 0.2 picks the most likely token");
// Review fixes: no spoilers on the predict frame, honest labels.
for (const text of ["the cats jumped", "foxes jumping", "zq"]) {
  for (const s of precompute(tokenizer, { text }).steps.filter((x) => x.kind === "try")) {
    assert.equal(s.tried.length, 1, `try frame shows only the first candidate (${text})`);
    assert.ok(!(s.code ?? []).join(" ").includes(","), "try frame code names one candidate");
  }
}
const full = last(precompute(vectorIndex, { query: "tie-break", nprobe: 3 }).steps);
assert.doesNotMatch(full.label, /skipping 0/);
for (const def of [vectorIndex]) for (const s of precompute(def).steps) assert.doesNotMatch(s.label, /one sentence each/);
for (let seed = 1; seed <= 20; seed++)
  for (const s of precompute(generation, { prompt: 0, temperature: 1.5, seed }).steps.filter((x) => x.kind === "draw"))
    assert.ok(s.label.includes(s.u!.toFixed(3)), "draw label shows u at full precision");
// Claims in the page's "Try this" boxes.
assert.deepEqual(words("jumping"), ["jump", "ing"]);
assert.deepEqual(words("blorp"), ["b", "l", "o", "r", "p"]);
let coldDraws = 0;
let coldFavs = 0;
for (const prompt of [0, 1, 2])
  for (let seed = 1; seed <= 99; seed++)
    for (const s of precompute(generation, { prompt, temperature: 0.2, seed }).steps.filter((x) => x.kind === "draw")) {
      coldDraws++;
      if (s.chosen === s.argmax) coldFavs++;
    }
assert.ok(coldFavs / coldDraws > 0.9, `T=0.2 nearly always picks the favourite (${coldFavs}/${coldDraws})`);
const hot = new Set<string>();
for (let seed = 1; seed <= 10; seed++)
  for (const s of precompute(generation, { prompt: 0, temperature: 1.5, seed }).steps.filter((x) => x.kind === "draw" && x.round === 0)) hot.add(s.chosen!);
assert.ok(hot.has("hill") && hot.has("dog"), "T=1.5 wanders to hill and dog");
for (const q of QUESTIONS) assert.equal(last(precompute(rag, { question: q.id, k: 2, retrieve: false }).steps).answer!.correct, false);
assert.equal(last(precompute(vectorIndex, { query: "tie-break", nprobe: 2 }).steps).found, true);
// Every step explains itself.
for (const def of [tokenizer, embedding, attending, generation, rag, vectorIndex] as const)
  for (const s of precompute(def as never).steps as { explain?: string; key?: string }[])
    assert.ok(s.explain && s.explain.length > 20, `${def.name} ${s.key} has an explanation`);
console.log("definitions ok");
