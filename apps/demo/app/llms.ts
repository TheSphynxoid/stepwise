import { readFileSync } from "node:fs";
import path from "node:path";
import { API } from "./docs/api";

// /llms.txt and /llms-full.txt: docs for AI assistants, which won't know a
// library this new. Built at build time from the same sources as everything
// else, so they can't drift: packages/stepwise/LLMS.md (also shipped in the
// npm package) and the /docs reference data (app/docs/api.ts).

export const SITE = process.env.SITE_URL ?? "https://stepwise.thesphynx.net";
const REPO = "https://github.com/TheSphynxoid/stepwise";

/** The llmstxt.org index: what this is, and where the full text lives. */
export function llmsIndex(): string {
  return `# @sphynxoid/stepwise

> React 18/19 hooks and optional components for interactive explainers: step-through players for algorithm traces, traces computed live from an input (edit it mid-playback, the playhead keeps its place), pause-and-predict checkpoints with graded answers, guided tours, scroll-driven chapters and glossary tooltips. One primitive underneath: a clamped cursor over an ordered list. ESM only; styles via a precompiled styles.css, Tailwind, or a shadcn registry.

## Docs

- [Full guide for AI assistants](${SITE}/llms-full.txt): setup, patterns with code, pitfalls, and the complete API reference in one file
- [Guide](${SITE}/guide): the same patterns written for people, one goal per section, with a live example each
- [API reference](${SITE}/docs): every hook, component and option
- [Recipes](${REPO}/blob/master/docs/RECIPES.md): Next.js + MDX article, shareable links, grading a checkpoint, testing

## Examples

- [Live simulation](${SITE}/simulate): useSimulation, syncInput links, predict mode on usePrompts (score, answers locked or cleared on an edit)
- [Explainer kit](${SITE}/kit): experimental defineExplainer + createExplainer + precomputed: a definition and a view become one component, its first frame rendered on the server; two on one page with separate links and keys, predict mode
- [How LLMs work](${SITE}/llm): a seven-chapter lesson built with the experimental kit: tokenization, embeddings, attention, sampling with temperature, hallucination, RAG (top-k retrieval) and a vector index (nprobe vs recall), on toy 2-D data, with chapters, glossary and predict mode
- [The QA Engineer interview](${SITE}/qa): an eleven-chapter lesson mixing the experimental kit with walks, synced tracks and a live feed: partitions and boundaries, decision tables (pairwise vs full), state transitions played as the tester (useWalk + fromGraph), coverage vs mutation testing, the test pyramid on one clock (useSyncedTracks), API status and contract checks, seeded flaky tests, a live CI feed (follow) and git bisect, minimal repro and triage, and a remembered question drill (useSteps + useDiscoveries)
- [Text adventure](${SITE}/adventure): experimental prompts on a walk (usePrompts, usePromptHistory): a story that branches on picked and typed answers, Back to answer again, and the paths a changed answer cut off kept in history
- [Live edge](${SITE}/live): a growing timeline with follow and Go live
- [Automaton](${SITE}/automaton): experimental branching walks (useWalk, fromGraph): a DFA run and drawn from one declaration, and a walk that branches on the reader's answers
- [Composed lesson](${SITE}/lesson): scroll chapters + embedded player + tour + glossary
- [Next.js + MDX article](${REPO}/tree/master/examples/next-mdx): a complete interactive article
- [Vite starter](${REPO}/tree/master/examples/vite-starter): the smallest app, no Tailwind
`;
}

/** LLMS.md followed by the whole API reference, as plain text. */
export function llmsFull(): string {
  const guide = readFileSync(path.join(process.cwd(), "../../packages/stepwise/LLMS.md"), "utf8").replace(/\r\n/g, "\n");
  const lines: string[] = [guide.trimEnd(), "", "---", "", "# API reference", ""];
  for (const group of API) {
    lines.push(`## ${group.title}`, "", group.blurb, "");
    for (const e of group.entries) {
      lines.push(`### ${e.name}`, "", "```ts", e.signature, "```", "", e.summary, "");
      for (const t of e.tables) {
        lines.push(`${t.title}:`, "");
        for (const r of t.rows) lines.push(`- \`${r.name}\`: \`${r.type}\`${r.def ? ` (default ${r.def})` : ""}. ${r.desc}`);
        lines.push("");
      }
      if (e.demo) lines.push(`Example: ${SITE}${e.demo}`, "");
    }
  }
  return lines.join("\n");
}
