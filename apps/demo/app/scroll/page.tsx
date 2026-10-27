"use client";

import { useChapters, StepScrubber, flattenChapters, type Chapter, type StepTone } from "@sphynx/stepwise";
import { useCallback, useEffect } from "react";

interface Phase {
  id: string;
  label: string;
  tone: StepTone;
  title: string;
  lead: string;
  filler: string[];
}

const PHASES: Phase[] = [
  {
    id: "phase-lex",
    label: "Lex",
    tone: "neutral",
    title: "Lexical analysis",
    lead: "The lexer converts source text into tokens — keywords, identifiers, literals, operators.",
    filler: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The scanner walks the input character by character, grouping runes into maximal munches. Whitespace and comments are discarded here; they carry no meaning to the parser downstream. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. Every token carries a source span, so later diagnostics can point at the exact column where something went wrong. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. The token stream is a flat array — the cheapest possible representation, because the parser will rebuild structure from it anyway.",
    ],
  },
  {
    id: "phase-parse",
    label: "Parse",
    tone: "write",
    title: "Syntax analysis",
    lead: "The parser consumes the token stream and builds a tree of syntactic constructs.",
    filler: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt. Each node in the tree represents a construct — a function, a loop, an expression. Grammar rules are checked here: a missing semicolon fails before any semantic work begins. Ut labore et dolore magna aliqua ut enim ad minim veniam.",
      "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Recursive descent handles most grammars comfortably; the tricky cases are left recursion and operator precedence, both solved with precedence climbing. Duis aute irure dolor in reprehenderit in voluptate.",
      "Velit esse cillum dolore eu fugiat nulla pariatur. The tree is immutable from here on — downstream passes annotate it rather than rewrite it, which keeps every phase's input trustworthy. Excepteur sint occaecat cupidatat non proident.",
    ],
  },
  {
    id: "phase-typecheck",
    label: "Typecheck",
    tone: "accent",
    title: "Semantic analysis",
    lead: "The typechecker annotates the tree — declarations resolve, overloads narrow, expressions get types.",
    filler: [
      "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Variables resolve to their declarations through a scope chain, and every expression is assigned a type. Errors surface here with the most useful diagnostics, because the tree still mirrors the source. Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.",
      "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. Subtyping, variance, and inference interact in ways that are easy to get subtly wrong; most compiler bugs live in this phase, not in codegen. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
      "Consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt. The output is a fully annotated tree: every node knows its type, and every identifier knows its declaration. Ut labore et dolore magnam aliquam quaerat voluptatem.",
    ],
  },
  {
    id: "phase-optimize",
    label: "Optimize",
    tone: "good",
    title: "Optimization",
    lead: "The optimizer rewrites the lowered form — dead code out, loops unrolled, registers allocated.",
    filler: [
      "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam. Dead code is removed, loops are unrolled when profitable, and common subexpressions are folded. Correctness invariants are preserved at every step — an optimizer that changes meaning is worse than no optimizer. Nisi ut aliquid ex ea commodi consequatur.",
      "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae. Passes run to a fixed point or a budget, whichever comes first; the order matters, and bad orders undo each other's work. Et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.",
      "Atque corrupti quos dolores et quas molestias excepturi sint occaecati. Register allocation maps the infinite virtual registers of the IR onto the finite physical registers of the target, spilling the rest to stack slots. Cupiditate non provident, similique sunt in culpa qui officia.",
    ],
  },
  {
    id: "phase-codegen",
    label: "Codegen",
    tone: "bad",
    title: "Code generation",
    lead: "The backend emits target instructions — each abstract op becomes concrete machine code.",
    filler: [
      "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus. Each abstract operation becomes a concrete machine instruction or ISA pattern. The result is a linear stream — an artifact the assembler or linker consumes. Quod maxime placeat, facere possimus, omnis voluptas assumenda est.",
      "Omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe. Instruction selection, scheduling, and peephole fixes happen here; a bad schedule costs cycles on every execution of the hot loop. Itaque earum rerum hic tenetur a sapiente delectus.",
      "Ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. The emitted object file carries relocation records so the linker can patch addresses it could not know at compile time. This is the end of the pipeline — what leaves is bytes.",
    ],
  },
];

const CHAPTERS: Chapter[] = PHASES.map((p) => ({ id: p.id, label: p.label }));
const FLAT = flattenChapters(CHAPTERS);

export default function ScrollDemo() {
  const chapters = useChapters(CHAPTERS);
  const active = chapters.active;

  const phaseAt = useCallback((i: number) => PHASES[i]?.tone ?? "neutral", []);
  const titleAt = useCallback((i: number) => PHASES[i]?.title ?? `phase ${i + 1}`, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); chapters.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); chapters.prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapters]);

  return (
    <main className="min-h-screen bg-background text-foreground pb-32">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary">
              Compiler pipeline
            </span>
            <span className="text-[10px] font-mono text-foreground/40 ml-auto">
              {active + 1}/{FLAT.length} — {PHASES[active]?.title ?? ""}
            </span>
          </div>
          <StepScrubber
            count={FLAT.length}
            index={active}
            toneAt={phaseAt}
            titleAt={titleAt}
            onSeek={chapters.goTo}
            emptyHint="scroll to track"
            className="min-h-6"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12">
        <h1 className="text-2xl font-bold mb-2">Scroll-driven sequence</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-10">
          A compiler&apos;s five phases as a scroll-driven sequence. The scrubber at
          the top tracks your scroll position; clicking a segment smooth-scrolls
          to that phase. Arrow keys work too.
        </p>

        {PHASES.map((p, i) => (
          <section
            key={p.id}
            id={p.id}
            className={`border-l-2 pl-5 mb-24 scroll-mt-28 transition-colors duration-300 ${
              i === active ? "border-primary/50" : "border-white/10"
            }`}
          >
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-[9px] font-mono text-foreground/30">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2
                className={`text-sm font-semibold transition-colors ${
                  i === active ? "text-primary" : "text-foreground/50"
                }`}
              >
                {p.title}
              </h2>
            </div>
            <p className="text-[13px] text-foreground/75 leading-relaxed mb-4">{p.lead}</p>
            <div className="space-y-4">
              {p.filler.map((para, j) => (
                <p key={j} className="text-[13px] text-foreground/60 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}

        <p className="text-[11px] font-mono text-foreground/30 text-center">— end of pipeline —</p>
      </div>
    </main>
  );
}
