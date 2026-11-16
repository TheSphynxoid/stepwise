import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { CENTROIDS, CHUNKS, QUESTIONS, SECTIONS, bucketOf, probeIndex, question, retrieve, type Scored, type Vec } from "./toy-model";

// Chapter 7: the data pipeline behind retrieval. Ingest: split each
// section into chunks, embed them, file each chunk in the bucket of its
// nearest centroid. Query: scan only the nprobe nearest buckets, then
// compare with an exact scan of everything.

const EXPLAIN = {
  chunk: "Ingestion, step 1: each document is cut into short chunks, and each chunk is turned into a vector. This happens once, ahead of time, not when a question arrives.",
  assign: "Ingestion, step 2: so that a question never has to be compared with every chunk, the chunks are grouped into buckets around a few centre points (centroids). Each chunk goes into the bucket of its nearest centre.",
  query: "When a question arrives, it is first compared with the few centres, which is cheap, to choose which buckets to open. nprobe is how many buckets get opened.",
  probe: "Only the chunks inside an opened bucket are compared with the question. Chunks in closed buckets are never looked at, and that is where the speed comes from.",
  result: "The best chunk among the ones scanned is what the index returns.",
  exact: "To check the index, here is what comparing against every single chunk finds. Real systems can't afford that on millions of chunks, which is why they build an index.",
  found: "The index found the true best match while doing less work than a full scan.",
  foundAll: "Opening every bucket always finds the true best match, but then the index saves no work at all.",
  missed: "The true best match sat in a bucket that was never opened, so the index returned a worse one. That is the trade-off: fewer buckets is faster but sometimes wrong (lower recall).",
};

export type IndexInput = { query: string; nprobe: number };
export type IndexKind = "chunk" | "assign" | "query" | "probe" | "result" | "exact" | "verdict";

export type IndexStep = StepwiseStep<{
  kind: IndexKind;
  /** A plain-language "why" for a newcomer, shown under the narration. */
  explain: string;
  /** Sections split so far (chunks of these are on the map). */
  sections: number;
  /** Bucket of each chunk, in CHUNKS order (shown from the assign step on). */
  buckets: number[] | null;
  query: string | null;
  qvec: Vec | null;
  nprobe: number;
  /** Buckets scanned so far, nearest first. */
  probed: number[];
  scanned: Scored[];
  best: string | null;
  exact: string | null;
  found: boolean | null;
}>;

export const MAX_NPROBE = 3;

const sim: Simulation<IndexInput, IndexStep> = function* ({ query: qid, nprobe }) {
  const q = question(qid);
  const blank = { buckets: null, query: null, qvec: null, nprobe, probed: [], scanned: [], best: null, exact: null, found: null };
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    const n = CHUNKS.filter((c) => c.section === s.id).length;
    yield {
      ...blank,
      sections: i + 1,
      key: `chunk-${s.id}`,
      kind: "chunk",
      explain: EXPLAIN.chunk,
      tone: "neutral",
      label: `Ingest "${s.title}": split it into ${n} chunks (a sentence or two each) and embed every chunk as a point.`,
    };
  }
  const buckets = CHUNKS.map((c) => bucketOf(c.vec));
  const sizes = CENTROIDS.map((_, b) => buckets.filter((x) => x === b).length);
  yield {
    ...blank,
    sections: SECTIONS.length,
    buckets,
    key: "assign",
    kind: "assign",
    explain: EXPLAIN.assign,
    tone: "write",
    label: `Index: file each chunk in the bucket of its nearest centroid. Buckets hold ${sizes.join(", ")} chunks.`,
    code: ["bucket(chunk) = argmax_c cos(chunk, centroid_c)"],
  };
  const { buckets: order, scanned, best } = probeIndex(q.vec, nprobe);
  const exact = retrieve(q.vec, 1)[0].id;
  const query = { ...blank, sections: SECTIONS.length, buckets, query: q.text, qvec: q.vec };
  yield {
    ...query,
    key: "query",
    kind: "query",
    explain: EXPLAIN.query,
    tone: "accent",
    label: `Query: "${q.text}" Find the nearest centroids, then scan only ${nprobe === 1 ? "the nearest bucket" : `the ${nprobe} nearest buckets`}.`,
    code: [`nprobe = ${nprobe}`],
  };
  for (let j = 0; j < order.length; j++) {
    const b = order[j];
    const inBucket = scanned.filter((s) => buckets[CHUNKS.findIndex((c) => c.id === s.id)] === b).length;
    yield {
      ...query,
      probed: order.slice(0, j + 1),
      scanned: scanned.filter((s) => order.slice(0, j + 1).includes(buckets[CHUNKS.findIndex((c) => c.id === s.id)])),
      key: `probe${j}`,
      kind: "probe",
      explain: EXPLAIN.probe,
      tone: "accent",
      label: `Scan bucket ${b + 1}: compare the query with its ${inBucket} chunks.`,
    };
  }
  const done = { ...query, probed: order, scanned, best };
  yield {
    ...done,
    key: "result",
    kind: "result",
    explain: EXPLAIN.result,
    tone: "write",
    label:
      scanned.length === CHUNKS.length
        ? `Best chunk found: ${best}. Every bucket was scanned, so this was an exact search after all.`
        : `Best chunk found: ${best}. ${CHUNKS.length - scanned.length} of ${CHUNKS.length} chunks were never looked at.`,
  };
  yield {
    ...done,
    exact,
    key: "exact",
    kind: "exact",
    explain: EXPLAIN.exact,
    tone: "neutral",
    label: `For comparison, an exact scan of all ${CHUNKS.length} chunks: the true best is ${exact}.`,
  };
  const found = best === exact;
  yield {
    ...done,
    exact,
    found,
    key: "verdict",
    kind: "verdict",
    explain: !found ? EXPLAIN.missed : scanned.length === CHUNKS.length ? EXPLAIN.foundAll : EXPLAIN.found,
    tone: found ? "good" : "bad",
    label: found
      ? scanned.length === CHUNKS.length
        ? "Found it, with perfect recall and no speed-up: scanning every bucket is just the exact search."
        : `Found it, while skipping ${CHUNKS.length - scanned.length} chunks. On millions of chunks that skip is the whole point.`
      : `Missed: the true best sat just across a bucket border. Raise nprobe to scan more buckets: slower, but better recall.`,
  };
};

export const vectorIndex = defineExplainer({
  name: "llm-index",
  simulation: sim,
  input: {
    default: { query: "tie-break", nprobe: 1 },
    serialize: ({ query, nprobe }) => `${query}~n${nprobe}`,
    parse: (raw) => {
      const m = /^([a-z-]+)~n(\d)$/.exec(raw);
      if (!m || !QUESTIONS.some((q) => q.id === m[1])) return null;
      const nprobe = Number(m[2]);
      return nprobe >= 1 && nprobe <= MAX_NPROBE ? { query: m[1], nprobe } : null;
    },
  },
  predict: {
    at: (step) => step.kind === "query",
    options: ["yes", "no"],
    truth: (_next, held) => {
      const { best } = probeIndex(held.qvec!, held.nprobe);
      return best === retrieve(held.qvec!, 1)[0].id ? "yes" : "no";
    },
    feedback: (guess, truth) =>
      guess === truth
        ? truth === "yes"
          ? "Right: the true best chunk is in a bucket that gets scanned."
          : "Right: the true best chunk is in a bucket this search skips."
        : truth === "yes"
          ? "It does find it: the true best chunk is in a scanned bucket."
          : "It misses: the true best chunk is filed in a bucket this search never opens.",
    hint: "Is the query's nearest chunk in the same bucket as the query's nearest centroid?",
  },
});
