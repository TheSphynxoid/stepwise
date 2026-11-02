"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlayerBar, TONE_CHIP_CLASS } from "@sphynxoid/stepwise";
import {
  fromGraph,
  useWalk,
  type GraphStep,
  type WalkSimulation,
  type WalkStep,
} from "@sphynxoid/stepwise/experimental";
import { useSiteTheme } from "../theme-provider";

// A finite automaton that decides whether a binary number is divisible by 3.
// Its state is the remainder of what it has read so far: reading a bit
// doubles the number and adds the bit, so the remainder r becomes (2r + bit)
// mod 3. Declared once as data, it is both run (over the typed word) and
// drawn (from `dfa.graph`).

type Bit = "0" | "1";
type State = "r0" | "r1" | "r2";

const dfa = fromGraph<Bit>({
  start: "r0",
  nodes: { r0: { label: "r0" }, r1: { label: "r1" }, r2: { label: "r2" } },
  edges: [
    { from: "r0", on: "0", to: "r0" },
    { from: "r0", on: "1", to: "r1" },
    { from: "r1", on: "0", to: "r2" },
    { from: "r1", on: "1", to: "r0" },
    { from: "r2", on: "0", to: "r1" },
    { from: "r2", on: "1", to: "r2" },
  ],
  accept: ["r0"],
});

// Part 2: the reader is the automaton. At each bit the walk asks "which
// state next?" (a choice point); a wrong pick takes a detour that explains
// the rule, then the walk continues from the right state.
type Ask = WalkStep & { node: State; read: number; bit?: Bit; truth?: State };

const beTheAutomaton: WalkSimulation<string, Ask, State> = function* (word) {
  let node: State = "r0";
  yield { key: "start", tone: "neutral", label: "Start in r0: nothing read, remainder 0", node, read: 0 };
  for (let i = 0; i < word.length; i++) {
    const bit = word[i] as Bit;
    const truth = dfa.delta(node, bit) as State;
    const pick: State | undefined = yield { key: `ask${i}`, await: true, tone: "accent", label: `Read '${bit}' in ${node}: which state next?`, node, read: i, bit, truth };
    if (pick !== truth) {
      const r = Number(node[1]);
      yield {
        key: `wrong${i}`,
        tone: "bad",
        label: `Not ${pick}: (2·${r} + ${bit}) mod 3 = ${(2 * r + Number(bit)) % 3}, so ${truth}`,
        node,
        read: i,
        bit,
        truth,
      };
    }
    node = truth;
    yield { key: `at${i + 1}`, tone: "write", label: `'${bit}' read: now in ${node}`, node, read: i + 1, bit };
  }
  const accepted = node === "r0";
  yield {
    key: "end",
    tone: accepted ? "good" : "bad",
    label: accepted ? "End in r0: accepted (divisible by 3)" : `End in ${node}: rejected (remainder ${node[1]})`,
    node,
    read: word.length,
  };
};

const word = {
  key: "w",
  serialize: (w: string) => w,
  parse: (v: string) => (/^[01]{0,12}$/.test(v) ? v : null),
};
const states: State[] = ["r0", "r1", "r2"];

export default function Demo() {
  const { theme } = useSiteTheme();
  const [input, setInput] = useState("1001");

  // Part 1: the word is the input; typing extends the walk. Step i means
  // "after i bits", so `anchor: "index"` keeps the position when you edit.
  const run = useWalk(dfa.simulation, input, {
    anchor: "index",
    autoPlay: true,
    follow: true,
    baseDelayMs: 600,
    syncHash: "f",
    syncInput: { ...word, onRestore: setInput },
  });
  const at = run.step as GraphStep<Bit>;
  const done = at.read === input.length;
  const prefix = input.slice(0, at.read);
  const changed = run.lastChange && run.lastChange.divergedAt >= 0 ? run.lastChange.divergedAt : null;

  // Part 2: same word, the reader picks each transition.
  const quiz = useWalk(beTheAutomaton, input, {
    autoPlay: true,
    baseDelayMs: 900,
    syncHash: "g",
    syncInput: { ...word, onRestore: setInput },
    syncChoices: { key: "p", serialize: (s) => s.slice(1), parse: (v) => (/^[012]$/.test(v) ? (`r${v}` as State) : null) },
  });
  const q = quiz.step!;
  const asking = quiz.choicePoints.includes(quiz.frame);
  const answered = quiz.choiceAt(quiz.frame);
  const mistakes = quiz.steps.filter((s) => s.key?.startsWith("wrong")).length;

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">Demo - Automaton (experimental)</p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">Watch an automaton read a word</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          This automaton decides whether a binary number is divisible by 3. Its state is the remainder so far:
          reading a bit doubles the number and adds the bit. It is declared once with{" "}
          <code className="text-primary">fromGraph</code>, then both run and drawn. Type a word and the walk grows as
          you type; edit it and the playhead stays at the same position. Below, you play the automaton yourself:
          each answer is a <code className="text-primary">choice</code>, a wrong one takes a detour, and changing an
          earlier answer cuts off the old future.
        </p>

        {/* Part 1: run it */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-[11px] font-mono text-muted-foreground" htmlFor="word">
              word
            </label>
            <input
              id="word"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^01]/g, "").slice(0, 12))}
              inputMode="numeric"
              aria-label="Binary word"
              className="w-40 rounded-md border border-border bg-background px-2 py-1 font-mono text-[14px] tracking-widest focus:outline-none focus:border-primary/60"
            />
            <span className="text-[11px] font-mono text-muted-foreground">
              = {input === "" ? 0 : parseInt(input, 2)} in decimal
            </span>
            <span
              data-testid="verdict"
              className={`ml-auto text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded border ${
                TONE_CHIP_CLASS[done ? (at.accepted ? "good" : "bad") : "idle"]
              }`}
            >
              {done ? (at.accepted ? "accepted" : "rejected") : "reading…"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-center">
            <Diagram node={at.node as State} from={at.from as State | null} on={at.on} />
            <div className="font-mono text-[13px] space-y-2 min-w-48">
              <div className="flex gap-1" aria-label="Bits read">
                {input.split("").map((b, i) => (
                  <span
                    key={i}
                    className={`w-6 h-7 grid place-items-center rounded border ${
                      i < at.read ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-foreground/30"
                    } ${changed !== null && i >= changed && i < at.read ? "ring-1 ring-accent/60" : ""}`}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground" data-testid="run-label">
                {at.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                read {prefix || "nothing"} = {prefix === "" ? 0 : parseInt(prefix, 2)}, remainder {at.node[1]}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <PlayerBar player={run.player} toneAt={run.toneAt} titleAt={run.titleAt} theme={theme} />
          </div>
        </div>

        {/* Part 2: be the automaton */}
        <h2 className="text-lg font-semibold mt-10 mb-2">Now you be the automaton</h2>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-4">
          Same word. At each bit, pick the state the automaton moves to. Scrub back to an earlier question and pick
          differently: everything after it is replayed from your new answer. The link in the address bar holds the
          word and your answers, so it replays this exact walk.
        </p>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[q.tone]}`}>
                {q.node}
              </span>
              <span className="text-[13px] font-semibold truncate" data-testid="quiz-label">
                {q.label}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0" data-testid="quiz-score">
              {quiz.choices.length} answered · {mistakes} detour{mistakes === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-h-9" data-testid="quiz-choices">
            {asking ? (
              states.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => quiz.choose(s)}
                  aria-pressed={answered === s}
                  className={`rounded-md border px-3 py-1.5 text-[12px] font-mono transition ${
                    answered === s ? "border-primary bg-primary/15 text-foreground" : "border-border text-foreground/70 hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s} (remainder {s[1]})
                </button>
              ))
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground">
                {quiz.awaiting ? "Playing up to the next question…" : "Scrub to a question to change your answer."}
              </span>
            )}
          </div>

          <div className="mt-4">
            <PlayerBar player={quiz.player} toneAt={quiz.toneAt} titleAt={quiz.titleAt} theme={theme} />
          </div>
        </div>
      </div>
    </main>
  );
}

// The DFA drawn from its declared edges: states in a row, forward edges
// arcing above, backward edges below, self-loops on top.
const X: Record<State, number> = { r0: 70, r1: 230, r2: 390 };
const Y = 110;

function Diagram({ node, from, on }: { node: State; from: State | null; on: string | null }) {
  return (
    <svg viewBox="0 0 460 210" className="w-full max-w-md" role="img" aria-label={`Automaton in state ${node}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-foreground/50" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
        </marker>
      </defs>
      {dfa.graph.edges.map((e) => {
        const a = e.from as State;
        const b = e.to as State;
        const lit = from === a && on === e.on && node === b;
        let d: string;
        let lx: number;
        let ly: number;
        if (a === b) {
          d = `M${X[a] - 12},${Y - 22} C${X[a] - 40},${Y - 85} ${X[a] + 40},${Y - 85} ${X[a] + 12},${Y - 22}`;
          lx = X[a];
          ly = Y - 72;
        } else {
          const forward = X[b] > X[a];
          const dy = forward ? -55 : 55;
          const sy = forward ? Y - 20 : Y + 20;
          d = `M${X[a]},${sy} Q${(X[a] + X[b]) / 2},${Y + dy * 1.4} ${X[b]},${sy}`;
          lx = (X[a] + X[b]) / 2;
          ly = Y + dy + (forward ? -4 : 12);
        }
        return (
          <g key={`${e.from}-${e.on}`}>
            <path
              d={d}
              fill="none"
              strokeWidth={lit ? 2.5 : 1.5}
              className={lit ? "stroke-primary" : "stroke-foreground/30"}
              markerEnd={`url(#${lit ? "arrow-on" : "arrow"})`}
            />
            <text x={lx} y={ly} textAnchor="middle" className={`font-mono text-[13px] ${lit ? "fill-primary" : "fill-foreground/60"}`}>
              {e.on}
            </text>
          </g>
        );
      })}
      {(Object.keys(X) as State[]).map((s) => (
        <g key={s}>
          {dfa.graph.accept.has(s) && <circle cx={X[s]} cy={Y} r={25} fill="none" className="stroke-foreground/40" strokeWidth={1.5} />}
          <circle
            cx={X[s]}
            cy={Y}
            r={20}
            strokeWidth={2}
            className={`transition-colors duration-300 ${s === node ? "fill-primary/25 stroke-primary" : "fill-card stroke-foreground/40"}`}
          />
          <text x={X[s]} y={Y + 5} textAnchor="middle" className="font-mono text-[13px] fill-foreground">
            {s}
          </text>
        </g>
      ))}
      <path d={`M${X.r0 - 60},${Y} L${X.r0 - 27},${Y}`} className="stroke-foreground/50" strokeWidth={1.5} markerEnd="url(#arrow)" />
    </svg>
  );
}
