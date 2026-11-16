import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { CHUNKS, QUESTIONS, SECTIONS, chunk, question, ragAnswer, retrieve, type Scored, type Vec } from "./toy-model";

// Chapters 5 and 6: the same question, closed-book (retrieve: false) and
// with retrieval: embed the question, score every chunk of the rulebook,
// keep the top k, paste them into the prompt, answer from them.

const EXPLAIN = {
  closedQuestion: "The model has never read this game's rulebook. All it knows is what text usually looks like.",
  closedAnswer: "It answers anyway, because it always writes the most likely-sounding words. Sounding right and being right are different things: this is a hallucination.",
  question: "This time, before answering, we search the rulebook for passages about the question and hand them to the model.",
  embed: "The question is turned into a vector the same way every rulebook chunk was, so the question and the chunks can be compared on the same map.",
  score: "Each chunk gets a cosine similarity score against the question: how closely the two vectors point the same way. A higher score means the chunk is more likely to be about the same thing.",
  topk: "Only the k best chunks are kept. The prompt has limited room, and extra passages only add noise.",
  prompt: "The kept chunks are pasted into the prompt, above the question. The model is not retrained; it simply has the facts in front of it.",
  right: "Now the most likely-sounding answer is the one backed by the passage in the prompt. Retrieval works by changing what the model reads.",
  wrong: "Retrieval only helps if it finds the right passage. With k this small, the passage that answers was left out, so the model guessed from a related one.",
};

export type RagInput = { question: string; k: number; retrieve: boolean };
export type RagKind = "question" | "embed" | "score" | "topk" | "prompt" | "answer";

export type RagStep = StepwiseStep<{
  kind: RagKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  question: string;
  qvec: Vec;
  retrieve: boolean;
  k: number;
  /** Every chunk, best first (shown from the score step on). */
  ranking: Scored[];
  /** The ids kept (from the topk step on). */
  top: string[];
  /** The augmented prompt (from the prompt step on). */
  prompt: string | null;
  answer: { chunk: string | null; text: string; correct: boolean } | null;
}>;

export const MAX_K = 3;

const sim: Simulation<RagInput, RagStep> = function* ({ question: qid, k, retrieve: useRetrieval }) {
  const q = question(qid);
  const ranking = retrieve(q.vec, CHUNKS.length);
  const base = { question: q.text, qvec: q.vec, retrieve: useRetrieval, k, ranking, top: [] as string[], prompt: null, answer: null };
  yield {
    ...base,
    key: "question",
    kind: "question",
    tone: "neutral",
    label: useRetrieval
      ? `"${q.text}" This time, look it up in the rulebook first.`
      : `"${q.text}" The model has never seen Tidepool's rulebook. It answers anyway.`,
    explain: useRetrieval ? EXPLAIN.question : EXPLAIN.closedQuestion,
  };
  if (!useRetrieval) {
    yield {
      ...base,
      key: "answer",
      kind: "answer",
      explain: EXPLAIN.closedAnswer,
      tone: "bad",
      label: `"${q.closedBook}" Fluent, confident and wrong: the model wrote what usually follows such a question, not what the rulebook says.`,
      answer: { chunk: null, text: q.closedBook, correct: false },
    };
    return;
  }
  yield {
    ...base,
    key: "embed",
    kind: "embed",
    explain: EXPLAIN.embed,
    tone: "accent",
    label: "Embed the question into the same vector space as the rulebook's chunks.",
    code: [`q = embed(question) = (${q.vec[0].toFixed(2)}, ${q.vec[1].toFixed(2)})`],
  };
  yield {
    ...base,
    key: "score",
    kind: "score",
    explain: EXPLAIN.score,
    tone: "accent",
    label: `Score all ${CHUNKS.length} chunks by cosine similarity with the question. Best: "${ranking[0].id}" at ${ranking[0].score.toFixed(2)}.`,
    code: ranking.slice(0, 4).map((s) => `cos(q, ${s.id.padEnd(9)}) = ${s.score.toFixed(2)}`),
  };
  const top = ranking.slice(0, k).map((s) => s.id);
  yield {
    ...base,
    top,
    key: "topk",
    kind: "topk",
    explain: EXPLAIN.topk,
    tone: "write",
    label: `Keep the top ${k}: ${top.join(", ")}. Everything else stays out of the prompt.`,
  };
  const prompt = [
    "Answer using only these rulebook passages:",
    ...top.map((id) => `- ${chunk(id).text}`),
    "",
    `Question: ${q.text}`,
  ].join("\n");
  yield {
    ...base,
    top,
    prompt,
    key: "prompt",
    kind: "prompt",
    explain: EXPLAIN.prompt,
    tone: "write",
    label: "Paste the kept chunks into the prompt, above the question. The model itself is unchanged; only its input grew.",
  };
  const answer = ragAnswer(q, ranking.slice(0, k));
  const correct = answer.chunk === q.answerChunk;
  yield {
    ...base,
    top,
    prompt,
    answer: { ...answer, correct },
    key: "answer",
    kind: "answer",
    explain: correct ? EXPLAIN.right : EXPLAIN.wrong,
    tone: correct ? "good" : "bad",
    label: correct
      ? `"${answer.text}" Grounded in ${answer.chunk}, and right.`
      : `"${answer.text}" The right passage (${q.answerChunk}) was not in the top ${k}, so the answer leans on the wrong one. Try a larger k.`,
  };
};

export const rag = defineExplainer({
  name: "llm-rag",
  simulation: sim,
  input: {
    default: { question: "start-tiles", k: 2, retrieve: true },
    serialize: ({ question: q, k, retrieve: r }) => `${q}~k${k}~r${r ? 1 : 0}`,
    parse: (raw) => {
      const m = /^([a-z-]+)~k(\d)~r([01])$/.exec(raw);
      if (!m || !QUESTIONS.some((q) => q.id === m[1])) return null;
      const k = Number(m[2]);
      if (k < 1 || k > MAX_K) return null;
      return { question: m[1], k, retrieve: m[3] === "1" };
    },
  },
  predict: {
    at: (step) => step.kind === "embed",
    options: SECTIONS.map((s) => ({ value: s.id, label: s.title })),
    truth: (_next, held) => chunk(held.ranking[0].id).section,
    feedback: (guess, truth) => {
      const title = SECTIONS.find((s) => s.id === truth)!.title;
      return guess === truth
        ? `Right: the closest chunk is in "${title}".`
        : `Not quite: the closest chunk is in "${title}". Closeness is about direction, not shared words.`;
    },
    hint: "Which section would a person flip to?",
  },
});
