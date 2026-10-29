"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useChapters,
  StepScrubber,
  ChapterNav,
  GlossaryProvider,
  GlossaryAppendix,
  Term,
  flattenChapters,
  type Chapter,
  type GlossaryEntry,
  type StepTone,
} from "@sphynxoid/stepwise";
import { useCallback, useEffect, type ReactNode } from "react";
import { useSiteTheme } from "../theme-provider";

const GLOSSARY: GlossaryEntry[] = [
  { id: "token", term: "Token", definition: (<>The atomic unit the <Term id="lexer">lexer</Term> emits: a category (keyword, identifier, literal) plus a source span. The <Term id="parser">parser</Term> rebuilds structure from a flat stream of these.</>) },
  { id: "lexer", term: "Lexer", definition: (<>Converts raw source text into <Term id="token">tokens</Term>, discarding whitespace and comments. Its output feeds the <Term id="parser">parser</Term>; nothing downstream ever sees the original characters again.</>) },
  { id: "parser", term: "Parser", definition: (<>Consumes the <Term id="token">token</Term> stream and builds an <Term id="ast">AST</Term> according to the grammar. A missing semicolon fails here, before any semantic work begins.</>) },
  { id: "ast", term: "AST", definition: (<>Abstract syntax tree - the parsed structure of the program. The <Term id="typecheck">typechecker</Term> annotates it, and lowering turns it into an <Term id="ir">IR</Term> the optimizer can rewrite.</>) },
  { id: "typecheck", term: "Typechecker", definition: (<>Assigns a type to every expression in the <Term id="ast">AST</Term> and resolves identifiers to declarations. Most user-facing diagnostics originate here, while the tree still mirrors the source.</>) },
  { id: "scope", term: "Scope", definition: (<>The region of the program in which a name is visible. The <Term id="typecheck">typechecker</Term> resolves identifiers by walking outward through nested scopes to their declaration.</>) },
  { id: "overload", term: "Overload", definition: (<>Multiple declarations sharing a name, distinguished by signature. The <Term id="typecheck">typechecker</Term> narrows candidates using the argument <Term id="scope">types</Term> in scope.</>) },
  { id: "ir", term: "IR", definition: (<>Intermediate representation - the optimization-friendly form the <Term id="ast">AST</Term> lowers into. The <Term id="opt">optimizer</Term> rewrites it until a budget or a fixed point, then <Term id="codegen">codegen</Term> consumes it.</>) },
  { id: "opt", term: "Optimizer", definition: (<>Rewrites the <Term id="ir">IR</Term> - dead code elimination, inlining, loop transforms - preserving meaning. Feeds its output to <Term id="regalloc">register allocation</Term> on the way to <Term id="codegen">codegen</Term>.</>) },
  { id: "regalloc", term: "Register allocation", definition: (<>Maps the IR&apos;s infinite virtual registers onto the target&apos;s finite physical <Term id="codegen">machine</Term> registers, spilling the rest to stack slots. Runs after the <Term id="opt">optimizer</Term> settles.</>) },
  { id: "codegen", term: "Code generation", definition: (<>The backend: selects instructions, schedules them, and emits an object file with relocation records the <Term id="linker">linker</Term> patches. The end of the pipeline - what leaves is bytes.</>) },
  { id: "linker", term: "Linker", definition: (<>Combines object files, resolves symbols, and patches the relocation records that <Term id="codegen">codegen</Term> left behind. Addresses unknowable at compile time become final here.</>) },
];

interface Unit {
  id: string;
  tone: StepTone;
  title: string;
  lead: ReactNode;
  filler?: string[];
}

const UNITS: Unit[] = [
  { id: "phase-lex", tone: "neutral", title: "Lexical analysis", lead: (<>The <Term id="lexer">lexer</Term> converts source text into <Term id="token">tokens</Term> - keywords, identifiers, literals, operators.</>), filler: ["Lorem ipsum dolor sit amet, consectetur adipiscing elit. The scanner walks the input character by character, grouping runes into maximal munches. Whitespace and comments are discarded here; they carry no meaning to the parser downstream. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. Every token carries a source span, so later diagnostics can point at the exact column where something went wrong. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.", "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. The token stream is a flat array - the cheapest possible representation, because the parser will rebuild structure from it anyway."] },
  { id: "phase-parse", tone: "write", title: "Syntax analysis", lead: (<>The <Term id="parser">parser</Term> consumes the token stream and builds a <Term id="ast">tree</Term> of syntactic constructs.</>), filler: ["Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt. Each node in the tree represents a construct - a function, a loop, an expression. Grammar rules are checked here: a missing semicolon fails before any semantic work begins. Ut labore et dolore magna aliqua ut enim ad minim veniam.", "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Recursive descent handles most grammars comfortably; the tricky cases are left recursion and operator precedence, both solved with precedence climbing. Duis aute irure dolor in reprehenderit in voluptate.", "Velit esse cillum dolore eu fugiat nulla pariatur. The tree is immutable from here on - downstream passes annotate it rather than rewrite it, which keeps every phase's input trustworthy. Excepteur sint occaecat cupidatat non proident."] },
  { id: "phase-typecheck", tone: "accent", title: "Semantic analysis", lead: (<>The <Term id="typecheck">typechecker</Term> annotates the <Term id="ast">tree</Term> - declarations resolve, overloads narrow, expressions get types. Two sub-passes below: scopes first, then overload resolution.</>) },
  { id: "phase-scopes", tone: "accent", title: "Semantic analysis - Scopes", lead: (<>Sub-chapter 1 of 2 - every identifier resolves through a <Term id="scope">scope</Term> chain to its declaration.</>), filler: ["Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Variables resolve to their declarations through a scope chain, walking outward from the innermost block until a binding matches. Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.", "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. Shadowing is legal when the inner declaration's type is compatible; the outer binding becomes unreachable by name for the rest of the inner block. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet."] },
  { id: "phase-overloads", tone: "accent", title: "Semantic analysis - Overloads", lead: (<>Sub-chapter 2 of 2 - <Term id="overload">overload</Term> candidates narrow as argument types become known.</>), filler: ["Consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt. Candidate sets shrink as each argument's type is inferred; when exactly one survives, the call resolves. Ambiguity is a hard error. Ut labore et dolore magnam aliquam quaerat voluptatem.", "Atque corrupti quos dolores et quas molestias excepturi sint occaecati. The output is a fully annotated tree: every node knows its type, and every identifier knows its declaration. Cupiditate non provident, similique sunt in culpa qui officia."] },
  { id: "phase-optimize", tone: "good", title: "Optimization", lead: (<>The <Term id="opt">optimizer</Term> rewrites the <Term id="ir">lowered form</Term> - dead code out, loops unrolled, <Term id="regalloc">registers</Term> allocated.</>), filler: ["Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam. Dead code is removed, loops are unrolled when profitable, and common subexpressions are folded. Correctness invariants are preserved at every step - an optimizer that changes meaning is worse than no optimizer. Nisi ut aliquid ex ea commodi consequatur.", "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae. Passes run to a fixed point or a budget, whichever comes first; the order matters, and bad orders undo each other's work. Et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.", "Atque corrupti quos dolores et quas molestias excepturi sint occaecati. Register allocation maps the infinite virtual registers of the IR onto the finite physical registers of the target, spilling the rest to stack slots. Cupiditate non provident, similique sunt in culpa qui officia."] },
  { id: "phase-codegen", tone: "bad", title: "Code generation", lead: (<>The backend emits target instructions - each abstract op becomes concrete machine code an <Term id="linker">assembler or linker</Term> consumes.</>), filler: ["Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus. Each abstract operation becomes a concrete machine instruction or ISA pattern. The result is a linear stream - an artifact the assembler or linker consumes. Quod maxime placeat, facere possimus, omnis voluptas assumenda est.", "Omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe. Instruction selection, scheduling, and peephole fixes happen here; a bad schedule costs cycles on every execution of the hot loop. Itaque earum rerum hic tenetur a sapiente delectus.", "Ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. The emitted object file carries relocation records so the linker can patch addresses it could not know at compile time. This is the end of the pipeline - what leaves is bytes."] },
];

const CHAPTERS: Chapter[] = [
  { id: "phase-lex", label: "Lex" },
  { id: "phase-parse", label: "Parse" },
  { id: "phase-typecheck", label: "Typecheck", hint: "Two sub-passes: scopes, then overloads", children: [{ id: "phase-scopes", label: "Scopes" }, { id: "phase-overloads", label: "Overloads" }] },
  { id: "phase-optimize", label: "Optimize" },
  { id: "phase-codegen", label: "Codegen" },
];

const FLAT = flattenChapters(CHAPTERS);

export default function ScrollDemo() {
  const chapters = useChapters(CHAPTERS);
  const { theme } = useSiteTheme();
  const active = chapters.active;

  const phaseAt = useCallback((i: number) => UNITS[i]?.tone ?? "neutral", []);
  const titleAt = useCallback((i: number) => UNITS[i]?.title ?? `unit ${i + 1}`, []);
  const groupOf = useCallback((i: number) => FLAT[i]?.rootIndex ?? i, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); chapters.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); chapters.prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapters]);

  const unit = UNITS[active];

  return (
    <GlossaryProvider entries={GLOSSARY} theme={theme}>
      <main className="min-h-screen bg-background text-foreground pb-32">
        <div className="sticky top-14 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-primary">
                Compiler pipeline
              </span>
              <span className="text-[10px] font-mono text-foreground/40 ml-auto">
                {active + 1}/{FLAT.length} - {unit?.title ?? ""}
              </span>
            </div>
            <StepScrubber
              count={FLAT.length}
              index={active}
              toneAt={phaseAt}
              titleAt={titleAt}
              onSeek={chapters.goTo}
              emptyHint="scroll to track"
              groupOf={groupOf}
              theme={theme}
              className="min-h-6"
            />
            <ChapterNav
              chapters={CHAPTERS}
              active={active}
              onNavigate={chapters.goTo}
              theme={theme}
              className="static z-auto mt-2 mb-0 border-white/10 bg-transparent shadow-none"
            />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 pt-12">
          <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
            <ArrowLeft size={14} /> Back to demos
          </Link>
          <h1 className="text-2xl font-bold mb-2 sw-fade-up">Scroll-driven sequence</h1>
          <p className="text-[13px] text-foreground/60 leading-relaxed mb-10 sw-fade-up sw-fade-up-1">
            A compiler&apos;s five phases as a scroll-driven sequence - with
            sub-chapters: <Term id="typecheck">Typecheck</Term> splits into
            Scopes and Overloads, sharing one proportional span in the scrubber
            so the chapter visibly fills halfway as its children pass. Every
            dotted term opens a glossary tooltip; the glossary appends itself
            from the provider&apos;s entries.
          </p>

          {UNITS.map((u, i) => {
            const flat = FLAT[i];
            const isActive = i === active;
            return (
              <section
                key={u.id}
                id={u.id}
                className={`border-l-2 pl-5 mb-24 scroll-mt-40 transition-colors duration-300 ${
                  isActive ? "border-primary/60" : "border-border/60"
                } ${flat.depth > 0 ? "ml-6" : ""}`}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-[9px] font-mono text-foreground/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2
                    className={`text-sm font-semibold transition-colors ${
                      isActive ? "text-primary" : "text-foreground/50"
                    }`}
                  >
                    {flat.depth > 0 && (
                      <span className="text-foreground/25 mr-2" aria-hidden="true">
                        +
                      </span>
                    )}
                    {u.title}
                  </h2>
                </div>
                <p className="text-[13px] text-foreground/75 leading-relaxed mb-4">{u.lead}</p>
                {u.filler && (
                  <div className="space-y-4">
                    {u.filler.map((para, j) => (
                      <p key={j} className="text-[13px] text-foreground/60 leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <GlossaryAppendix
            title="Glossary"
            intro={
              <>
                Every term referenced above, in declaration order - collected
                automatically from the provider, no list passed by hand. Inside
                this appendix, references become anchor links instead of nested
                tooltips. The intro, footer, columns, and each row are all
                overridable.
              </>
            }
            footer={
              <p className="text-[11px] font-mono text-foreground/30">
                12 entries - declared once in <span className="text-foreground/50">GLOSSARY</span> - rendered by{" "}
                <span className="text-foreground/50">&lt;GlossaryAppendix /&gt;</span>
              </p>
            }
          />

          <p className="text-[11px] font-mono text-foreground/30 text-center mt-16">- end of pipeline -</p>
        </div>
      </main>
    </GlossaryProvider>
  );
}