"use client";

import { useMemo, useRef } from "react";
import { StepScrubber, useStepPlayer, useGlobalKeys, CodeBlock, usePrefersReducedMotion } from "@sphynx/stepwise";

const PHASES = [
  { label: "Parse", desc: "The lexer converts raw source into tokens.", code: ["tokens = lex(source)"] },
  { label: "Tokenize", desc: "Each token carries a type and a value.", code: ["type: KEYWORD, value: 'let'"] },
  { label: "AST", desc: "The parser builds an abstract syntax tree from tokens.", code: ["ast = parse(tokens)"] },
  { label: "Transform", desc: "Visitor passes rewrite the tree — scope analysis, constant folding.", code: ["ast = transform(ast, visitors)"] },
  { label: "Emit", desc: "The code generator produces output from the transformed tree.", code: ["output = generate(ast)"] },
];

export default function ScrollDemo() {
  const reduced = usePrefersReducedMotion();
  const player = useStepPlayer({ total: PHASES.length });
  const containerRef = useRef<HTMLDivElement>(null);

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
  });

  const activePhase = PHASES[Math.min(player.index, PHASES.length - 1)] ?? PHASES[0];

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">Demo — Scroll-Driven</p>
        <h1 className="text-2xl font-bold mb-4">Compiler pipeline phases</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6">
          Scroll through this page to advance through the compiler phases. The scrubber tracks your
          scroll position.
        </p>

        <div className="border border-border rounded-md bg-card p-4 mb-4">
          <StepScrubber
            count={PHASES.length}
            index={Math.max(0, player.index)}
            onSeek={(i) => player.seek(i)}
            toneAt={(i) => (i <= player.index ? "good" : "neutral")}
            className="mb-4"
          />
          <p className="text-sm font-semibold text-foreground/90 mb-1">{activePhase.label}</p>
          <CodeBlock lines={activePhase.code} />
          <p className="text-[12px] text-foreground/55 leading-relaxed mt-2">{activePhase.desc}</p>
        </div>

        <div ref={containerRef} className="space-y-4">
          {PHASES.map((phase, i) => (
            <div key={phase.label} className="border border-border rounded-md p-4 bg-card">
              <h2 className="text-sm font-semibold text-primary mb-1">
                Phase {i + 1}: {phase.label}
              </h2>
              <p className="text-[12px] text-foreground/55 leading-relaxed">{phase.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
