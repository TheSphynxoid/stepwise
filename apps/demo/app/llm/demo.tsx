"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChapterNav, GlossaryProvider, Term, useChapters, type Chapter, type GlossaryEntry, type StepwiseStep } from "@sphynxoid/stepwise";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { tokenizer } from "./tokenize.explainer";
import { embedding } from "./embed.explainer";
import { attending } from "./attend.explainer";
import { generation } from "./generate.explainer";
import { rag } from "./rag.explainer";
import { vectorIndex } from "./index.explainer";
import { AttendView, EmbedView, GenerateView, IndexView, RagView, TokenizeView } from "./views";

// The lesson's client half: six explainers (a definition from a
// *.explainer.ts file plus a view from views.tsx, bound by createExplainer),
// and the shell around the server-rendered prose: chapter nav that follows
// the scroll, and the glossary the prose's <Term>s read from.

const Tokenizer = createExplainer({ definition: tokenizer, view: TokenizeView });
const Embedding = createExplainer({ definition: embedding, view: EmbedView });
const Attending = createExplainer({ definition: attending, view: AttendView });
const Generation = createExplainer({ definition: generation, view: GenerateView });
const Rag = createExplainer({ definition: rag, view: RagView });
const VectorIndex = createExplainer({ definition: vectorIndex, view: IndexView });

// The page passes plain data (precomputed traces, ids); the theme follows
// the site's light/dark toggle from here.
export function TokenizerClient(props: ComponentProps<typeof Tokenizer>) {
  return <Tokenizer {...props} theme={useSiteTheme().theme} />;
}
export function EmbeddingClient(props: ComponentProps<typeof Embedding>) {
  return <Embedding {...props} theme={useSiteTheme().theme} />;
}
export function AttendingClient(props: ComponentProps<typeof Attending>) {
  return <Attending {...props} theme={useSiteTheme().theme} />;
}
export function GenerationClient(props: ComponentProps<typeof Generation>) {
  return <Generation {...props} theme={useSiteTheme().theme} />;
}
export function RagClient(props: ComponentProps<typeof Rag>) {
  return <Rag {...props} theme={useSiteTheme().theme} />;
}
export function VectorIndexClient(props: ComponentProps<typeof VectorIndex>) {
  return <VectorIndex {...props} theme={useSiteTheme().theme} />;
}

/**
 * The current step's plain-language explanation: what the step means, for
 * someone new to the idea. The narration above it says what happened; this
 * says why it matters. A custom part, read from the same provider as the kit's.
 */
export function Explain() {
  const { step } = useExplainer<unknown, StepwiseStep<{ explain?: string }>>();
  if (!step?.explain) return null;
  return (
    <div data-stepwise="" className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-primary">Why</span>
      {step.explain}
    </div>
  );
}

const GLOSSARY: GlossaryEntry[] = [
  { id: "token", term: "Token", definition: <>The unit a model reads and writes: a word, a piece of a word, or a single character. Each has a number, its id, from the <Term id="vocabulary">vocabulary</Term>.</> },
  { id: "vocabulary", term: "Vocabulary", definition: <>The fixed list of every <Term id="token">token</Term> a model knows. Real ones hold tens of thousands of entries; this lesson&apos;s holds about fifty.</> },
  { id: "embedding", term: "Embedding", definition: <>A list of numbers (a vector) standing for a token or a text. Learned so that similar meanings get similar vectors, which <Term id="cosine">cosine similarity</Term> can measure.</> },
  { id: "cosine", term: "Cosine similarity", definition: <>How closely two vectors point the same way: 1 for the same direction, 0 for unrelated, -1 for opposite. Length does not matter, only direction.</> },
  { id: "attention", term: "Attention", definition: <>The step where each token gathers information from earlier tokens: it scores them against its query, turns the scores into weights with <Term id="softmax">softmax</Term>, and mixes their vectors by those weights.</> },
  { id: "softmax", term: "Softmax", definition: <>Turns any list of scores into positive weights that add up to 1, with bigger scores getting a bigger share. Used inside <Term id="attention">attention</Term> and to turn <Term id="logit">logits</Term> into probabilities.</> },
  { id: "logit", term: "Logit", definition: <>The raw score a model gives each candidate next token, before <Term id="softmax">softmax</Term> turns the scores into probabilities.</> },
  { id: "temperature", term: "Temperature", definition: <>Divides the <Term id="logit">logits</Term> before <Term id="softmax">softmax</Term>. Low temperature sharpens the odds toward the favourite; high temperature flattens them, so unlikely tokens get picked more often.</> },
  { id: "sampling", term: "Sampling", definition: <>Picking the next token at random, weighted by its probability, instead of always taking the most likely one. Controlled by <Term id="temperature">temperature</Term>.</> },
  { id: "hallucination", term: "Hallucination", definition: <>A fluent, confident answer that is false. The model produces what usually follows such a question, whether or not it knows the facts. <Term id="rag">Retrieval</Term> is one remedy.</> },
  { id: "rag", term: "Retrieval-augmented generation (RAG)", definition: <>Before answering, search a document collection for passages related to the question and paste the best <Term id="top-k">top k</Term> into the prompt, so the answer can rest on them.</> },
  { id: "chunk", term: "Chunk", definition: <>A short passage cut from a longer document, small enough to embed and paste into a prompt. Chunks are often a fixed number of tokens, with a little overlap so no sentence is cut in two.</> },
  { id: "top-k", term: "Top-k", definition: <>Keep only the k best-scoring results. A small k keeps the prompt short but can miss the passage that answers; a large k adds noise.</> },
  { id: "vector-index", term: "Vector index", definition: <>A data structure that finds vectors near a query without comparing against every one, by grouping them (here, into buckets around <Term id="centroid">centroids</Term>) and searching only some groups.</> },
  { id: "centroid", term: "Centroid", definition: <>The centre point of a group of vectors. A <Term id="vector-index">vector index</Term> files each vector under its nearest centroid.</> },
  { id: "nprobe", term: "nprobe", definition: <>How many of a <Term id="vector-index">vector index</Term>&apos;s buckets a query scans. More buckets: slower, but better <Term id="recall">recall</Term>.</> },
  { id: "recall", term: "Recall", definition: <>The share of the true best matches a search actually returns. An exact scan has perfect recall; an approximate index trades some recall for speed.</> },
];

/**
 * The lesson shell: glossary provider, chapter nav that follows the scroll,
 * and the column the server-rendered chapters go in.
 */
export function LlmLesson({ chapters, children }: { chapters: Chapter[]; children: ReactNode }) {
  const { theme } = useSiteTheme();
  const nav = useChapters(chapters);
  return (
    <GlossaryProvider entries={GLOSSARY} theme={theme}>
      <main className="min-h-screen bg-background pb-24 text-foreground">
        <div className="sticky top-14 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-6 py-2">
            <ChapterNav
              chapters={chapters}
              active={nav.active}
              onNavigate={nav.goTo}
              theme={theme}
              className="static z-auto border-transparent bg-transparent shadow-none"
            />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-6 pt-10">{children}</div>
      </main>
    </GlossaryProvider>
  );
}
