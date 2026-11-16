"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TONE_CHIP_CLASS, type StepTone } from "@sphynxoid/stepwise";
import { useExplainer } from "@sphynxoid/stepwise/kit";
import {
  CENTROIDS,
  CHUNKS,
  PROMPTS,
  QUESTIONS,
  SECTIONS,
  TEXT_PATTERN,
  VOCAB,
  chunk,
  entry,
  type Group,
  type Vec,
} from "./toy-model";
import type { TokenizeInput, TokenizeStep } from "./tokenize.explainer";
import type { EmbedStep, PromptInput } from "./embed.explainer";
import type { AttendStep } from "./attend.explainer";
import { MAX_SEED, TEMPERATURES, type GenerateInput, type GenerateStep } from "./generate.explainer";
import { MAX_K, type RagInput, type RagStep } from "./rag.explainer";
import { MAX_NPROBE, type IndexInput, type IndexStep } from "./index.explainer";

// One view per explainer: each draws the current frame and owns the
// controls that edit the input. Everything else (player, links, keys,
// predict mode) comes from the kit.

// ── Shared pieces ────────────────────────────────────────────────────────

const GROUP_FILL: Record<Group, string> = {
  creature: "fill-primary",
  motion: "fill-accent",
  // Amber is too light on white: a darker shade in light mode.
  place: "fill-amber-500 [[data-theme=light]_&]:fill-amber-600",
  function: "fill-muted-foreground",
  piece: "fill-violet-500",
};
const GROUP_TEXT: Record<Group, string> = {
  creature: "text-primary",
  motion: "text-accent",
  place: "text-amber-500 [[data-theme=light]_&]:text-amber-700",
  function: "text-muted-foreground",
  piece: "text-violet-500",
};
const BUCKET_FILL = ["fill-primary", "fill-accent", GROUP_FILL.place];
const BUCKET_TEXT = ["text-primary", "text-accent", GROUP_TEXT.place];

function Card({
  kind,
  tone,
  meta,
  label,
  controls,
  children,
}: {
  kind: string;
  tone: StepTone;
  meta?: ReactNode;
  label: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${TONE_CHIP_CLASS[tone]}`}>{kind}</span>
        {meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}
      </div>
      <div role="img" aria-label={label}>
        {children}
      </div>
      {controls && <Controls>{controls}</Controls>}
    </div>
  );
}

function Controls({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-foreground/70">{children}</div>;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format = String,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <span className="inline-flex items-center gap-2" role="group" aria-label={label}>
      {label}
      <span className="inline-flex overflow-hidden rounded-md border border-border">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`px-2 py-1 transition ${o === value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
          >
            {format(o)}
          </button>
        ))}
      </span>
    </span>
  );
}

function PromptSelect({ value, onChange }: { value: number; onChange: (prompt: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      Prompt
      <select
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
      >
        {PROMPTS.map((p, i) => (
          <option key={p} value={i}>
            {p} …
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestionSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="inline-flex min-w-0 items-center gap-2">
      Question
      <select
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="min-w-0 max-w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
      >
        {QUESTIONS.map((q) => (
          <option key={q.id} value={q.id}>
            {q.text}
          </option>
        ))}
      </select>
    </label>
  );
}

type MapPoint = { at: Vec; label?: string; fill: string; r?: number; ring?: "solid" | "dashed"; dim?: boolean };
type MapArrow = { to: Vec; className: string; label?: string; dashed?: boolean };
type MapWedge = { from: number; to: number; className: string };

const sx = (x: number) => x;
const sy = (y: number) => -y;

function wedgePath(from: number, to: number, r = 1.05) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const sweep = ((to - from) % 360 + 360) % 360;
  const [x1, y1] = [r * Math.cos(rad(from)), r * Math.sin(rad(from))];
  const [x2, y2] = [r * Math.cos(rad(from + sweep)), r * Math.sin(rad(from + sweep))];
  return `M0 0 L${sx(x1)} ${sy(y1)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${sx(x2)} ${sy(y2)} Z`;
}

/** A 2-D vector space: points, arrows from the origin, optional bucket wedges. */
function VectorMap({ points, arrows = [], wedges = [] }: { points: MapPoint[]; arrows?: MapArrow[]; wedges?: MapWedge[] }) {
  return (
    <svg viewBox="-1.15 -1.15 2.3 2.3" className="mx-auto block aspect-square w-full max-w-[340px]" aria-hidden="true">
      {wedges.map((w, i) => (
        <path key={i} d={wedgePath(w.from, w.to)} className={`${w.className} transition-opacity duration-300`} />
      ))}
      <line x1={-1.1} y1={0} x2={1.1} y2={0} className="stroke-border" strokeWidth={0.008} />
      <line x1={0} y1={-1.1} x2={0} y2={1.1} className="stroke-border" strokeWidth={0.008} />
      <circle cx={0} cy={0} r={1} fill="none" className="stroke-border" strokeWidth={0.006} strokeDasharray="0.03 0.03" />
      {arrows.map((a, i) => (
        <g key={i} className={a.className}>
          <line x1={0} y1={0} x2={sx(a.to[0])} y2={sy(a.to[1])} stroke="currentColor" strokeWidth={0.018} strokeDasharray={a.dashed ? "0.05 0.03" : undefined} />
          <circle cx={sx(a.to[0])} cy={sy(a.to[1])} r={0.028} fill="currentColor" />
          {a.label && (
            <text x={sx(a.to[0]) + 0.04} y={sy(a.to[1]) + 0.1} fontSize={0.075} fill="currentColor" className="font-mono">
              {a.label}
            </text>
          )}
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i} className={`transition-opacity duration-300 ${p.dim ? "opacity-25" : ""}`}>
          {p.ring && (
            <circle
              cx={sx(p.at[0])}
              cy={sy(p.at[1])}
              r={(p.r ?? 0.035) + 0.035}
              fill="none"
              className="stroke-foreground"
              strokeWidth={0.012}
              strokeDasharray={p.ring === "dashed" ? "0.03 0.02" : undefined}
            />
          )}
          <circle cx={sx(p.at[0])} cy={sy(p.at[1])} r={p.r ?? 0.035} className={p.fill} />
          {p.label && (
            <text x={sx(p.at[0]) + 0.05} y={sy(p.at[1]) - 0.04} fontSize={0.07} className="fill-foreground font-mono">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const WORD_POINTS = VOCAB.filter((v) => v.group !== "piece" && v.text !== ".");
/** Every entry longer than one letter, plus "a": what the tokenizer can match before falling back to letters. */
const VOCAB_WORDS = VOCAB.filter((v) => v.text.length > 1 || v.group !== "piece").filter((v) => v.text !== ".").map((v) => v.text);
const f2 = (x: number) => x.toFixed(2);

// ── Chapter 1: tokens ────────────────────────────────────────────────────

export function TokenizeView() {
  const { step, input, setInput } = useExplainer<TokenizeInput, TokenizeStep>();
  // A draft, so a rejected character never fights the cursor; every valid draft applies at once.
  const [draft, setDraft] = useState(input.text);
  useEffect(() => setDraft((d) => (d === input.text ? d : input.text)), [input.text]);
  if (!step) return null;
  const valid = TEXT_PATTERN.test(draft);
  const edit = (raw: string) => {
    setDraft(raw);
    if (TEXT_PATTERN.test(raw) && raw !== input.text) setInput({ text: raw });
  };
  const tokenAt = new Map<number, number>();
  step.tokens.forEach((t, i) => {
    for (let c = t.start; c < t.start + t.text.length; c++) tokenAt.set(c, i);
  });
  const match = step.kind === "emit" ? step.tried[step.tried.length - 1] : null;
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={`${step.tokens.length} tokens`}
      label={`Text "${step.text}" split into ${step.tokens.length} tokens so far: ${step.tokens.map((t) => t.text).join(", ")}`}
      controls={
        <>
            <label className="inline-flex items-center gap-2">
              Text
              <input
                value={draft}
                onChange={(e) => edit(e.currentTarget.value)}
                onBlur={() => setDraft(input.text)}
                aria-invalid={!valid}
                aria-label="Text to tokenize"
                maxLength={40}
                spellCheck={false}
                className="w-56 rounded-md border border-border bg-background px-2 py-1 text-foreground aria-[invalid=true]:border-destructive"
              />
            </label>
            {!valid && <span className="text-destructive">lowercase a–z and spaces only</span>}
        </>
      }
    >
      <div className="flex flex-wrap gap-0.5 font-mono text-[15px]">
        {step.text.split("").map((ch, i) => {
          const t = tokenAt.get(i);
          const here = step.pos >= 0 && i >= step.pos && i < step.pos + (step.tried[0]?.length ?? 1);
          return (
            <span
              key={i}
              className={`flex h-8 w-6 items-center justify-center rounded border transition-colors duration-200 ${
                ch === " "
                  ? "border-transparent"
                  : here
                    ? "border-primary bg-primary/15 text-primary"
                    : t !== undefined
                      ? t % 2
                        ? "border-accent/40 bg-accent/10"
                        : "border-primary/30 bg-primary/5"
                      : "border-border text-foreground/50"
              }`}
            >
              {ch === " " ? "·" : ch}
            </span>
          );
        })}
      </div>
      <div className="mt-3 min-h-7 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        {step.tried.length > 0 && <span className="text-muted-foreground">tried:</span>}
        {step.tried.map((c, i) => {
          const hit = i === step.tried.length - 1;
          return (
            <span
              key={i}
              className={`rounded border px-1.5 py-0.5 ${
                hit && match ? "border-accent bg-accent/15 text-accent" : hit ? "border-border" : "border-border text-foreground/40 line-through"
              }`}
            >
              {c}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex min-h-9 flex-wrap gap-1.5">
        {step.tokens.map((t, i) => (
          <span key={i} className={`flex items-baseline gap-1 rounded-md border px-2 py-1 font-mono text-[12px] ${GROUP_TEXT[entry(t.text).group]} border-border bg-background/50`}>
            {t.text}
            <span className="text-[9px] text-muted-foreground">#{t.id}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        vocabulary: {VOCAB_WORDS.join(" · ")} · and every single letter
      </p>
    </Card>
  );
}

// ── Chapter 2: vectors ───────────────────────────────────────────────────

export function EmbedView() {
  const { step, input, setInput } = useExplainer<PromptInput, EmbedStep>();
  if (!step) return null;
  const placed = new Set(step.tokens.slice(0, step.placed));
  const pair = new Set(step.pair ?? []);
  const points: MapPoint[] = WORD_POINTS.map((v) => ({
    at: v.vec,
    fill: GROUP_FILL[v.group],
    label: placed.has(v.text) || pair.has(v.text) ? v.text : undefined,
    dim: !placed.has(v.text) && !pair.has(v.text),
    ring: pair.has(v.text) ? "solid" : undefined,
    r: placed.has(v.text) ? 0.045 : 0.03,
  }));
  const arrows: MapArrow[] = (step.pair ?? []).map((t) => ({ to: entry(t).vec, className: "text-foreground/60" }));
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={`${step.placed}/${step.tokens.length} placed`}
      label={`Map of word vectors. Placed: ${[...placed].join(", ")}. ${step.label}`}
      controls={
        <>
            <PromptSelect value={input.prompt} onChange={(prompt) => setInput({ prompt })} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <VectorMap points={points} arrows={arrows} />
        <div className="space-y-3 font-mono text-[11px]">
          <ul className="space-y-1">
            {(["creature", "motion", "place", "function"] as Group[]).map((g) => (
              <li key={g} className={`flex items-center gap-2 ${GROUP_TEXT[g]}`}>
                <span className="inline-block size-2 rounded-full bg-current" /> {g === "creature" ? "animals" : g === "motion" ? "actions" : g === "place" ? "places" : "function words"}
              </li>
            ))}
          </ul>
          {step.sims.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-2">
              {step.sims.map((s) => (
                <li key={`${s.a}-${s.b}`} className="flex justify-between gap-2">
                  <span>
                    {s.a} · {s.b}
                  </span>
                  <span className={s.cos > 0.8 ? "text-accent" : s.cos < 0 ? "text-destructive" : ""}>{f2(s.cos)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Chapter 3: attention ─────────────────────────────────────────────────

export function AttendView() {
  const { step, input, setInput } = useExplainer<PromptInput, AttendStep>();
  if (!step) return null;
  const weighted = step.kind === "softmax" || step.kind === "mix" || step.kind === "done";
  const last = step.tokens.length - 1;
  const points: MapPoint[] = step.tokens.map((t, i) => ({
    at: entry(t).vec,
    fill: GROUP_FILL[entry(t).group],
    label: i === last ? undefined : t,
    r: weighted ? 0.025 + 0.07 * step.weights[i] : 0.04,
  }));
  const arrows: MapArrow[] = [{ to: step.query, className: "text-primary", label: "query", dashed: true }];
  if (step.kind === "mix" || step.kind === "done") arrows.push({ to: step.context, className: "text-accent", label: "mix" });
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={`last token "${step.tokens[last]}"`}
      label={`Attention from "${step.tokens[last]}" over ${step.tokens.join(", ")}. ${step.label}`}
      controls={
        <>
            <PromptSelect value={input.prompt} onChange={(prompt) => setInput({ prompt })} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col justify-center gap-1.5">
          {step.tokens.map((t, i) => {
            const shown = i < step.scored;
            return (
              <div key={i} className="grid grid-cols-[3.5rem_3rem_minmax(0,1fr)] items-center gap-2 font-mono text-[12px]">
                <span className={`${GROUP_TEXT[entry(t).group]} ${i === last ? "underline decoration-primary underline-offset-4" : ""}`}>{t}</span>
                <span className="text-right text-[10px] text-muted-foreground">{shown ? f2(step.scores[i]) : "·"}</span>
                <span className="relative h-4 overflow-hidden rounded-sm bg-secondary">
                  <span
                    className="absolute inset-y-0 left-0 bg-accent/70 transition-all duration-500"
                    style={{ width: `${weighted ? step.weights[i] * 100 : 0}%` }}
                  />
                  {weighted && <span className="absolute inset-y-0 right-1 text-[9px] leading-4 text-foreground/70">{Math.round(step.weights[i] * 100)}%</span>}
                </span>
              </div>
            );
          })}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">token · score · weight</p>
        </div>
        <VectorMap points={points} arrows={arrows} />
      </div>
    </Card>
  );
}

// ── Chapter 4: sampling ──────────────────────────────────────────────────

export function GenerateView() {
  const { step, input, setInput } = useExplainer<GenerateInput, GenerateStep>();
  if (!step) return null;
  const odds = step.kind !== "logits" && step.cands.length > 0;
  const drawn = step.kind === "draw" || step.kind === "append";
  let acc = 0;
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={`round ${Math.min(step.round + 1, 4)} · T=${step.temperature} · seed ${input.seed}`}
      label={`Text so far: ${step.tokens.join(" ")}. ${step.label}`}
      controls={
        <>
            <PromptSelect value={input.prompt} onChange={(prompt) => setInput((p) => ({ ...p, prompt }))} />
            <Segmented label="Temperature" value={input.temperature} options={TEMPERATURES} onChange={(temperature) => setInput((p) => ({ ...p, temperature }))} />
            <button
              type="button"
              onClick={() => setInput((p) => ({ ...p, seed: (p.seed % MAX_SEED) + 1 }))}
              className="rounded-md border border-border bg-background px-2 py-1 hover:bg-secondary"
            >
              New dice (seed {input.seed})
            </button>
        </>
      }
    >
      <p className="mb-3 font-mono text-[15px]">
        {step.tokens.map((t, i) => (
          <span key={i} className={i >= step.promptLength ? "rounded bg-accent/15 px-0.5 text-accent" : ""}>
            {i > 0 && t !== "." ? " " : ""}
            {t}
          </span>
        ))}
        <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary" />
      </p>
      {step.cands.length > 0 && (
        <div className="space-y-1">
          {step.cands.map((c) => (
            <div key={c.token} className="grid grid-cols-[3.5rem_7.5rem_minmax(0,1fr)] items-center gap-2 font-mono text-[11px]">
              <span className={drawn && c.token === step.chosen ? "font-semibold text-accent" : ""}>
                {c.token}
                {odds && c.token === step.argmax ? " ★" : ""}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {f2(c.base)} + {f2(c.pull)} = {f2(c.logit)}
              </span>
              <span className="relative h-4 overflow-hidden rounded-sm bg-secondary">
                <span className="absolute inset-y-0 left-0 bg-primary/60 transition-all duration-500" style={{ width: `${odds ? c.p * 100 : 0}%` }} />
                {odds && <span className="absolute inset-y-0 right-1 text-[9px] leading-4 text-foreground/70">{Math.round(c.p * 100)}%</span>}
              </span>
            </div>
          ))}
          {odds && (
            <div className="pt-2">
              <div className="relative flex h-5 overflow-hidden rounded-sm border border-border" aria-hidden="true">
                {step.cands.map((c, i) => {
                  const left = acc;
                  acc += c.p;
                  return (
                    <span
                      key={c.token}
                      className={`flex items-center justify-center overflow-hidden border-r border-background font-mono text-[9px] ${i % 2 ? "bg-primary/25" : "bg-primary/45"} ${drawn && c.token === step.chosen ? "!bg-accent/70 text-accent-foreground" : ""}`}
                      style={{ width: `${c.p * 100}%` }}
                      title={`${c.token}: ${left.toFixed(3)}–${acc.toFixed(3)}`}
                    >
                      {c.p > 0.08 ? c.token : ""}
                    </span>
                  );
                })}
                {drawn && step.u !== null && <span className="absolute inset-y-0 w-[2px] bg-foreground" style={{ left: `${step.u * 100}%` }} />}
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {drawn ? `dice: ${step.u!.toFixed(3)}, the slice it lands in wins` : "each token gets a slice as wide as its odds"}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Chapters 5 and 6: retrieval ──────────────────────────────────────────

export function RagView() {
  const { step, input, setInput } = useExplainer<RagInput, RagStep>();
  if (!step) return null;
  const scored = ["score", "topk", "prompt", "answer"].includes(step.kind) && step.retrieve;
  const top = new Set(step.top);
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={step.retrieve ? `k = ${step.k}` : "closed book"}
      label={step.label}
      controls={
        <>
            <QuestionSelect value={input.question} onChange={(question) => setInput((p) => ({ ...p, question }))} />
            {input.retrieve && (
              <Segmented label="k" value={input.k} options={Array.from({ length: MAX_K }, (_, i) => i + 1)} onChange={(k) => setInput((p) => ({ ...p, k }))} />
            )}
        </>
      }
    >
      <p className="mb-3 rounded-md border border-border bg-background/50 px-3 py-2 text-[13px]">
        <span className="mr-2 font-mono text-[10px] uppercase text-muted-foreground">Q</span>
        {step.question}
      </p>
      {step.retrieve && (
        <div className="space-y-1">
          {(scored ? step.ranking : CHUNKS.map((c) => ({ id: c.id, score: 0 }))).slice(0, scored ? 6 : 12).map((s) => {
            const kept = top.has(s.id);
            return (
              <div
                key={s.id}
                className={`grid grid-cols-[4.5rem_2.5rem_minmax(0,1fr)] items-center gap-2 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                  kept ? "bg-accent/15" : ""
                }`}
              >
                <span className={kept ? "text-accent" : "text-muted-foreground"}>{s.id}</span>
                <span className="text-right text-[10px]">{scored ? f2(s.score) : ""}</span>
                <span className={`truncate font-sans text-[12px] ${scored && !kept && step.top.length ? "text-foreground/40" : "text-foreground/80"}`}>{chunk(s.id).text}</span>
              </div>
            );
          })}
          {scored && <p className="px-1.5 font-mono text-[10px] text-muted-foreground">… and {CHUNKS.length - 6} more, lower</p>}
        </div>
      )}
      {step.prompt && (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
          {step.prompt}
        </pre>
      )}
      {step.answer && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-[13px] ${step.answer.correct ? "border-accent/50 bg-accent/10" : "border-destructive/50 bg-destructive/10"}`}>
          <span className="mr-2 font-mono text-[10px] uppercase text-muted-foreground">A</span>
          <span data-testid="rag-answer">{step.answer.text}</span>
          {step.answer.chunk && <span className="ml-2 font-mono text-[10px] text-muted-foreground">[{step.answer.chunk}]</span>}
        </div>
      )}
    </Card>
  );
}

// ── Chapter 7: the index ─────────────────────────────────────────────────

const angleOf = (v: Vec) => ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;
/** Each centroid's wedge: from the midpoint with its clockwise neighbour to the one with its counter-clockwise neighbour. */
const WEDGES = (() => {
  const angles = CENTROIDS.map(angleOf);
  const order = angles.map((a, i) => ({ a, i })).sort((x, y) => x.a - y.a);
  const out: { from: number; to: number }[] = [];
  order.forEach(({ a, i }, j) => {
    const prev = order[(j - 1 + order.length) % order.length].a;
    const next = order[(j + 1) % order.length].a;
    const mid = (x: number, y: number) => (x + (((y - x) % 360) + 360) % 360 / 2) % 360;
    out[i] = { from: mid(prev, a), to: mid(a, next) };
  });
  return out;
})();

export function IndexView() {
  const { step, input, setInput } = useExplainer<IndexInput, IndexStep>();
  if (!step) return null;
  const shownSections = new Set(SECTIONS.slice(0, step.sections).map((s) => s.id));
  const scanned = new Set(step.scanned.map((s) => s.id));
  const wedges: MapWedge[] = step.buckets
    ? WEDGES.map((w, b) => ({
        ...w,
        className: `${BUCKET_FILL[b]} ${step.probed.includes(b) ? "opacity-25" : step.probed.length ? "opacity-[0.04]" : "opacity-10"}`,
      }))
    : [];
  const points: MapPoint[] = CHUNKS.filter((c) => shownSections.has(c.section)).map((c) => {
    const i = CHUNKS.indexOf(c);
    return {
      at: c.vec,
      fill: step.buckets ? BUCKET_FILL[step.buckets[i]] : "fill-muted-foreground",
      label: c.id === step.best || c.id === step.exact ? c.id : undefined,
      ring: c.id === step.exact ? "dashed" : c.id === step.best ? "solid" : undefined,
      // The true best stays readable even when the search skipped it: that is the miss.
      dim: step.probed.length > 0 && !scanned.has(c.id) && c.id !== step.exact,
    };
  });
  if (step.buckets) CENTROIDS.forEach((c) => points.push({ at: c, fill: "fill-foreground/70", r: 0.02 }));
  // No arrow label: the query sits next to the chunks it is compared with; the legend names it.
  const arrows: MapArrow[] = step.qvec ? [{ to: step.qvec, className: "text-foreground", dashed: true }] : [];
  return (
    <Card
      kind={step.kind}
      tone={step.tone}
      meta={`nprobe ${step.nprobe} · ${step.scanned.length || "–"} scanned`}
      label={`Vector index with ${points.length} points. ${step.label}`}
      controls={
        <>
            <QuestionSelect value={input.query} onChange={(query) => setInput((p) => ({ ...p, query }))} />
            <Segmented label="nprobe" value={input.nprobe} options={Array.from({ length: MAX_NPROBE }, (_, i) => i + 1)} onChange={(nprobe) => setInput((p) => ({ ...p, nprobe }))} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <VectorMap points={points} arrows={arrows} wedges={wedges} />
        <div className="space-y-3 font-mono text-[11px]">
          <ul className="space-y-0.5">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className={i < step.sections ? "text-foreground/80" : "text-foreground/30"}>
                {i < step.sections ? "✓" : "·"} {s.title}
              </li>
            ))}
          </ul>
          {step.buckets && (
            <ul className="space-y-0.5 border-t border-border pt-2">
              {CENTROIDS.map((_, b) => (
                <li key={b} className={`${BUCKET_TEXT[b]} ${step.probed.length && !step.probed.includes(b) ? "opacity-40" : ""}`}>
                  bucket {b + 1}: {step.buckets!.filter((x) => x === b).length} chunks{step.probed.includes(b) ? " · scanned" : ""}
                </li>
              ))}
            </ul>
          )}
          {step.qvec && (
            <ul className="space-y-0.5 border-t border-border pt-2 text-muted-foreground">
              <li>- - - query</li>
              {step.best && <li>◯ best found: {step.best}</li>}
              {step.exact && <li>◌ true best: {step.exact}</li>}
            </ul>
          )}
          {step.found !== null && (
            <p data-testid="index-verdict" className={step.found ? "text-accent" : "text-destructive"}>
              {step.found ? "found the true best" : "missed the true best"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
