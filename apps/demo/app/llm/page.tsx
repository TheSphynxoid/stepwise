import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GlossaryAppendix, Term, type Chapter } from "@sphynxoid/stepwise";
import { EndNote, ExplainerBar, Narration, Predict, PredictToggle, Stage, StepCode } from "@sphynxoid/stepwise/kit";
import { precomputed } from "@sphynxoid/stepwise/kit/mdx";
import { ViewSource } from "../view-source";
import { tokenizer } from "./tokenize.explainer";
import { embedding } from "./embed.explainer";
import { attending } from "./attend.explainer";
import { generation } from "./generate.explainer";
import { rag } from "./rag.explainer";
import { vectorIndex } from "./index.explainer";
import {
  AttendingClient,
  EmbeddingClient,
  Explain,
  GenerationClient,
  LlmLesson,
  RagClient,
  TokenizerClient,
  VectorIndexClient,
} from "./demo";

export const metadata: Metadata = { title: "How LLMs work" };

// A server component: the prose, and one precomputed explainer per
// chapter. Each trace is computed here at build time and shipped as JSON;
// the browser re-runs a definition only when the reader edits its input.

const Tokenizer = precomputed(tokenizer, TokenizerClient);
const Embedding = precomputed(embedding, EmbeddingClient);
const Attending = precomputed(attending, AttendingClient);
const Generation = precomputed(generation, GenerationClient);
const Rag = precomputed(rag, RagClient);
const VectorIndex = precomputed(vectorIndex, VectorIndexClient);

const CHAPTERS: Chapter[] = [
  { id: "tokens", label: "Tokens" },
  { id: "vectors", label: "Vectors" },
  { id: "attention", label: "Attention" },
  { id: "sampling", label: "Sampling" },
  { id: "hallucination", label: "Making things up" },
  { id: "retrieval", label: "Retrieval" },
  { id: "index", label: "The index" },
  { id: "glossary", label: "Glossary", numbered: false },
];

function Chapter({ id, n, title, lead, children }: { id: string; n: number; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-20 scroll-mt-32">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">Chapter {n}</p>
      <h2 className="mb-1 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mb-5 text-[14px] font-medium text-foreground/85">{lead}</p>
      {children}
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="mb-6 max-w-2xl space-y-3 text-[14px] leading-relaxed text-foreground/75">{children}</div>;
}

/** Suggestions under a player: things worth changing, with what to watch for. */
function TryThis({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-dashed border-border px-4 py-3 text-[13px] leading-relaxed text-foreground/70">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-accent">Try this</span>
      {children}
    </div>
  );
}

/**
 * The parts in the lesson's order: the frame; what just happened (the
 * narration); why it matters (Explain); the predict prompt; the arithmetic;
 * the player bar.
 */
function Parts({ ask, end }: { ask?: ReactNode; end: ReactNode }) {
  return (
    <>
      <Stage />
      <Narration />
      <Explain />
      {ask && <PredictToggle>Predict before each reveal</PredictToggle>}
      {ask && <Predict>{ask}</Predict>}
      <StepCode />
      <ExplainerBar />
      <EndNote>{end}</EndNote>
    </>
  );
}

const code = (s: string) => <code className="text-primary">{s}</code>;

export default function Page() {
  return (
    <>
      <LlmLesson chapters={CHAPTERS}>
        <Link href="/#demos" className="mb-6 inline-flex items-center gap-2 font-mono text-[12px] text-muted-foreground transition hover:text-foreground">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="sw-fade-up mb-2 font-mono text-[11px] uppercase tracking-widest text-primary">Lesson - How LLMs work</p>
        <h1 className="sw-fade-up sw-fade-up-1 mb-4 text-3xl font-semibold tracking-tight">How a language model writes, and how retrieval helps it</h1>
        <div className="sw-fade-up sw-fade-up-2 mb-6 max-w-2xl space-y-3 text-[14px] leading-relaxed text-muted-foreground">
          <p>
            A large language model (LLM) does one thing, over and over: it reads some text and guesses the next
            word. That is the whole trick. Everything it writes, it writes one piece at a time.
          </p>
          <p>
            Chapters 1 to 4 open up that guessing loop. Chapters 5 to 7 show why the loop makes things up, and how
            looking facts up first (retrieval) fixes it.
          </p>
          <p>
            <strong className="text-foreground/90">This model is a toy, on purpose.</strong> Its word vectors have 2
            numbers instead of thousands. It knows about fifty word pieces instead of tens of thousands. Its
            &quot;learned&quot; numbers are written by hand. That keeps every step small enough to check yourself. Real
            models have the same parts, at a far larger scale.
          </p>
        </div>
        <div className="sw-fade-up sw-fade-up-3 mb-14 max-w-2xl rounded-lg border border-border bg-card px-4 py-3 text-[13px] leading-relaxed text-foreground/75">
          <strong className="text-foreground/90">How to use the players.</strong> Press <strong>→</strong> (or the
          arrow button) to take one step; <strong>Play</strong> runs them all. Under each picture, the first line says
          what just happened and the <span className="font-mono text-[11px] text-primary">WHY</span> box says what it
          means. Dotted words like <Term id="token">token</Term> have a definition: hover or focus them. Where you see{" "}
          <em>Predict before each reveal</em>, the player stops during Play and asks you to guess first.
        </div>

        <Chapter id="tokens" n={1} title="From text to tokens" lead="A model can't read letters. First, the text is cut into known pieces, and each piece becomes a number.">
          <Prose>
            <p>
              The pieces are called <Term id="token">tokens</Term>. The list of every piece the model knows is its{" "}
              <Term id="vocabulary">vocabulary</Term>. Common words are usually one token each. Rarer words are split
              into smaller pieces.
            </p>
            <p>
              This tokenizer is greedy. At each position it tries the longest piece first, and shortens it until it
              finds one in the vocabulary. If nothing longer matches, a single letter always does, so any word can be
              tokenized.
            </p>
          </Prose>
          <Tokenizer id="tok" predict>
            <Parts ask="How many letters will the next token take?" end="Done. Edit the text and the tokens follow." />
          </Tokenizer>
          <TryThis>
            Type {code("jumping")}: the vocabulary has {code("jump")} and {code("ing")}, so the word splits in two. Then type a made-up word like {code("blorp")} and watch it fall apart into single letters.
          </TryThis>
        </Chapter>

        <Chapter id="vectors" n={2} title="Tokens as vectors" lead="Each token's number is swapped for a list of numbers, chosen so that similar words get similar lists.">
          <Prose>
            <p>
              That list is called an <Term id="embedding">embedding</Term>, or a vector. You can picture a vector as
              an arrow from the centre of a map. Real ones have thousands of numbers. Ours have two, so each one fits
              on a flat map.
            </p>
            <p>
              Look at where the words land: animals at the top, actions to the right, places to the left, and the
              small words like &quot;the&quot; and &quot;on&quot; near the middle. Nobody wrote those groups down.
              In a real model they come out of training, because words used in similar ways get pulled together. To
              measure how alike two words are, the model compares the directions of their arrows. That is{" "}
              <Term id="cosine">cosine similarity</Term>.
            </p>
          </Prose>
          <Embedding id="emb">
            <Parts end="Meaning is now a position on the map." />
          </Embedding>
          <TryThis>
            Switch the prompt to {code("a dog ran to the")}. The words change, but the map doesn&apos;t: the vectors
            belong to the words, not to the sentence.
          </TryThis>
        </Chapter>

        <Chapter id="attention" n={3} title="Attention: which words matter here" lead="To guess the next word, the last word looks back and decides which earlier words matter most.">
          <Prose>
            <p>
              Take &quot;the cat sat on the&quot;. The last word, &quot;the&quot;, tells you almost nothing about what
              comes next. &quot;cat&quot; and &quot;sat&quot; tell you a lot. <Term id="attention">Attention</Term> is
              how the model finds them.
            </p>
            <p>
              It works in three moves. The last word sends out a question, its <em>query</em>. Every word gets a score
              for how well it answers that question. <Term id="softmax">Softmax</Term> turns the scores into
              percentages, and the last word&apos;s vector becomes a blend of all the words, mixed by those percentages.
            </p>
            <p>
              In a real model the query is learned, and the whole thing runs many times in parallel and in layers. Our
              toy uses one hand-written rule instead: a small word like &quot;the&quot; looks for the animal and the
              action before it.
            </p>
          </Prose>
          <Attending id="att" predict>
            <Parts ask="Where will most of the attention go?" end="The blend now leans on the words that matter." />
          </Attending>
          <TryThis>
            Compare the three prompts. Each time, the big bars land on the animal and the action, and the
            &quot;mix&quot; arrow on the map points between them.
          </TryThis>
        </Chapter>

        <Chapter id="sampling" n={4} title="Picking the next token" lead="The model scores every possible next word, turns the scores into odds, and rolls dice.">
          <Prose>
            <p>
              The raw scores are called <Term id="logit">logits</Term>. In our toy, each score adds two things: how
              often that word follows the last word, plus a bonus from the words attention picked out (&quot;sat&quot;
              pushes for &quot;mat&quot;, &quot;ran&quot; for &quot;park&quot;).
            </p>
            <p>
              Softmax turns the scores into probabilities. Then the model picks one at random, weighted by those
              probabilities. That is called <Term id="sampling">sampling</Term>. The picked word is added to the text,
              and the loop starts again.
            </p>
            <p>
              <Term id="temperature">Temperature</Term> controls how adventurous the pick is. At 0.2 the favourite wins
              almost every time. At 1.5 the odds even out and surprises are common.
            </p>
          </Prose>
          <Generation id="gen" predict>
            <Parts ask="Will the dice pick the favourite (★)?" end="That loop is all generation is." />
          </Generation>
          <TryThis>
            Set the temperature to 1.5 and press <em>New dice</em> a few times: some runs wander off to
            &quot;hill&quot; or &quot;dog&quot;. At 0.2 nearly every roll gives the same sentence. Changing the temperature
            keeps the same dice and only changes the odds, so you can compare fairly.
          </TryThis>
        </Chapter>

        <Chapter id="hallucination" n={5} title="Why models make things up" lead="Nothing in that loop checks facts, so a model sounds just as sure when it is wrong.">
          <Prose>
            <p>
              The model always writes the most likely-sounding next words. When it knows the answer, those words are
              right. When it doesn&apos;t, they still sound right. A fluent, confident, false answer is called a{" "}
              <Term id="hallucination">hallucination</Term>.
            </p>
            <p>
              To see one, we ask about Tidepool, a board game invented for this page. The model has never seen its
              rulebook, but it answers anyway.
            </p>
          </Prose>
          <Rag id="closed" retrieve={false}>
            <Parts end="Confident and wrong. The next chapter hands it the rulebook." />
          </Rag>
          <TryThis>
            Pick the other questions. Every answer sounds plausible, and every one is wrong.
          </TryThis>
        </Chapter>

        <Chapter id="retrieval" n={6} title="Retrieval: look it up first" lead="Instead of answering from memory, find the relevant passages and put them in front of the model.">
          <Prose>
            <p>
              This is <Term id="rag">retrieval-augmented generation</Term>, or RAG. The model itself doesn&apos;t
              change. Only its input does.
            </p>
            <p>
              Ahead of time, the rulebook is cut into short <Term id="chunk">chunks</Term>, and each chunk gets a
              vector, exactly like the words in chapter 2. When a question comes in, it gets a vector too. Every chunk
              is scored by how close its vector is to the question&apos;s, the <Term id="top-k">top k</Term> chunks
              are pasted into the prompt, and the model answers with those passages in front of it.
            </p>
            <p>
              Retrieval is only as good as what it finds. Ask &quot;How many points does a closed pool score?&quot;
              with k = 1: the closest chunk defines a pool but never mentions points, so the answer is wrong again. With
              k = 2, the passage that answers gets in too.
            </p>
          </Prose>
          <Rag id="rag" predict>
            <Parts ask="Which section of the rulebook will rank first?" end="Same model, better input." />
          </Rag>
          <TryThis>
            Choose the pool-scoring question and switch k between 1 and 2. Then compare this answer with the one in
            chapter 5.
          </TryThis>
        </Chapter>

        <Chapter id="index" n={7} title="The index behind retrieval" lead="Comparing a question with every chunk is too slow at scale, so chunks are stored in buckets and only a few buckets are searched.">
          <Prose>
            <p>
              Twelve chunks are easy to compare one by one. A hundred million are not. So retrieval sits on a small
              data pipeline with three stages.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <strong className="text-foreground/90">Ingest</strong>: cut each document into chunks and give each
                chunk a vector. (Here a chunk is a sentence or two. Fixed-size chunks with a little overlap are also
                common.)
              </li>
              <li>
                <strong className="text-foreground/90">Index</strong>: group the vectors into buckets, each around a
                centre point called a <Term id="centroid">centroid</Term>. This structure is a{" "}
                <Term id="vector-index">vector index</Term>.
              </li>
              <li>
                <strong className="text-foreground/90">Query</strong>: find the buckets nearest the question, and only
                compare the chunks inside them.
              </li>
            </ol>
            <p>
              Skipping buckets is what makes it fast. It is also what can make it wrong. <Term id="nprobe">nprobe</Term>{" "}
              is the number of buckets searched. With nprobe = 1, the question about ties misses: its best chunk was
              filed just across a bucket border. Search more buckets and it is found, at the cost of more work. Every
              real retrieval system tunes this trade-off between speed and <Term id="recall">recall</Term>.
            </p>
          </Prose>
          <VectorIndex id="idx" predict>
            <Parts ask="Will this search find the true best chunk?" end="Change nprobe or the question and replay." />
          </VectorIndex>
          <TryThis>
            Play it at nprobe = 1 and watch the miss. Then set nprobe to 2: one more bucket is opened, and the true
            best chunk is found.
          </TryThis>
        </Chapter>

        <section id="glossary" className="scroll-mt-32">
          <GlossaryAppendix title="Glossary" intro={<>Every term the lesson defines, in one place.</>} className="mt-0" />
        </section>
      </LlmLesson>
      <ViewSource file="app/llm/page.tsx" />
      <ViewSource file="app/llm/demo.tsx" />
      <ViewSource file="app/llm/views.tsx" />
    </>
  );
}
