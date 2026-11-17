"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StepTone } from "@sphynxoid/stepwise";
import { useExplainer } from "@sphynxoid/stepwise/kit";
import type { Outcome } from "./tidepool";
import { CATEGORIES, FEATURES, FEATURE_LABEL, type ThinkInput, type ThinkStep } from "./think.explainer";
import {
  AGE_MAX,
  AGE_MIN,
  MAX_PROBES,
  PARTITIONS,
  PRESETS,
  partitionOf,
  type BoundaryInput,
  type BoundaryStep,
} from "./boundaries.explainer";

// One view per explainer: each draws the current frame and owns the
// controls that edit its input. The player, links, keys and predict mode
// come from the kit.

// ─── Shared pieces ───────────────────────────────────────────────────

const TONE_TEXT: Record<StepTone, string> = {
  neutral: "text-muted-foreground",
  accent: "text-primary",
  good: "text-accent",
  bad: "text-destructive",
  write: "text-amber-500 [[data-theme=light]_&]:text-amber-700",
  idle: "text-muted-foreground/60",
};

/** The frame's box: a terminal-ish title bar with a status, then the picture. */
export function Frame({
  title,
  tone,
  status,
  label,
  controls,
  children,
}: {
  title: string;
  tone: StepTone;
  status?: ReactNode;
  label: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-3 py-1.5 font-mono text-[10.5px]">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="flex gap-1">
            <i className="h-2 w-2 rounded-full bg-destructive/60" />
            <i className="h-2 w-2 rounded-full bg-amber-400/60" />
            <i className="h-2 w-2 rounded-full bg-accent/60" />
          </span>
          {title}
        </span>
        {status && <span className={TONE_TEXT[tone]}>{status}</span>}
      </div>
      <div role="img" aria-label={label} className="p-4">
        {children}
      </div>
      {controls && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2.5 font-mono text-[11px] text-foreground/70">{controls}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
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

/** A pass/fail mark, as a runner prints it. */
export function Mark({ pass, className = "" }: { pass: boolean | null; className?: string }) {
  if (pass === null) return <span className={`text-muted-foreground ${className}`}>·</span>;
  return <span className={`${pass ? "text-accent" : "text-destructive"} ${className}`}>{pass ? "✓" : "✗"}</span>;
}

export const showOutcome = (o: Outcome) => (o.ok ? `${o.tier} $${o.total}` : `reject:${o.error}`);

// ─── §01 How would you test this? ────────────────────────────────────

export function ThinkView() {
  const { step, input, setInput } = useExplainer<ThinkInput, ThinkStep>();
  if (!step) return null;
  const current = step.ideas.length - 1;
  return (
    <Frame
      title={`test-plan · ${FEATURE_LABEL[input.feature]}`}
      tone={step.tone}
      status={`${step.ideas.length} ideas`}
      label={`Test plan for ${FEATURE_LABEL[input.feature]}: ${step.ideas.length} ideas`}
      controls={<Segmented label="Feature" value={input.feature} options={FEATURES} onChange={(feature) => setInput({ feature })} />}
    >
      <ol className="space-y-1.5">
        {CATEGORIES.map((c, ci) => {
          const ideas = step.ideas.map((idea, i) => ({ ...idea, i })).filter((x) => x.cat === c.id);
          const active = step.kind === c.id;
          return (
            <li
              key={c.id}
              className={`grid grid-cols-[7.5rem_1fr] gap-3 rounded-md border px-2.5 py-1.5 transition-colors sm:grid-cols-[9rem_1fr] ${
                active ? "border-primary/50 bg-primary/[0.07]" : ideas.length ? "border-border" : "border-dashed border-border/70"
              }`}
            >
              <span className="font-mono text-[11px]">
                <span className="text-muted-foreground">{ci + 1}.</span>{" "}
                <span className={ideas.length ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                <span className="block text-[9.5px] leading-tight text-muted-foreground/80">{c.hint}</span>
              </span>
              <ul className="space-y-0.5 text-[12.5px] leading-snug">
                {ideas.length === 0 && <li className="text-muted-foreground/50">-</li>}
                {ideas.map((x) => (
                  <li key={x.i} className={x.i === current ? "text-foreground" : "text-foreground/65"}>
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">[ ]</span>
                    {x.text}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}

// ─── §02 Partitions and boundaries ───────────────────────────────────

const PART_FILL: Record<string, string> = {
  low: "fill-destructive/15",
  child: "fill-primary/15",
  adult: "fill-accent/15",
  senior: "fill-amber-400/20",
  high: "fill-destructive/15",
};

function AgeInput({ values, onApply }: { values: number[]; onApply: (v: number[]) => void }) {
  const [text, setText] = useState(values.join(", "));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(values.join(", ")), [values]);
  const apply = () => {
    const v = text.split(/[\s,]+/).filter(Boolean).map(Number);
    const ok = v.length >= 1 && v.length <= MAX_PROBES && v.every((x) => Number.isInteger(x) && x >= AGE_MIN && x <= AGE_MAX);
    setBad(!ok);
    if (ok) onApply(v);
  };
  return (
    <label className="inline-flex items-center gap-2">
      Ages
      <input
        aria-label="Ages to probe"
        aria-invalid={bad}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        className={`w-56 rounded-md border bg-background px-2 py-1 ${bad ? "border-destructive" : "border-border"}`}
      />
      {bad && <span className="text-destructive">whole numbers {AGE_MIN} to {AGE_MAX}, up to {MAX_PROBES}</span>}
    </label>
  );
}

export function BoundaryView() {
  const { step, input, setInput } = useExplainer<BoundaryInput, BoundaryStep>();
  if (!step) return null;
  const W = 640;
  const x = (age: number) => 16 + ((Math.max(AGE_MIN, Math.min(AGE_MAX, age)) - AGE_MIN) / (AGE_MAX - AGE_MIN)) * (W - 32);
  const caught = step.probes.filter((p) => p.mismatch).length;
  const bands = PARTITIONS.map((p) => ({ ...p, a: x(Math.max(p.from, AGE_MIN)), b: x(Math.min(p.to, AGE_MAX) + (p.to === Infinity ? 0 : 1)) }));
  return (
    <Frame
      title="age-field · validateBooking(age)"
      tone={step.tone}
      status={<span data-testid="bnd-verdict">{caught ? `bug caught by ${caught}` : step.kind === "done" ? "bug not found" : "bug not found yet"}</span>}
      label={`Number line of ages with ${step.probes.length} probes; ${caught} found a mismatch`}
      controls={
        <>
          <span className="inline-flex items-center gap-1.5">
            Preset
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setInput({ values: p.values })}
                aria-pressed={p.values.join() === input.values.join()}
                className="rounded-md border border-border px-2 py-1 hover:bg-secondary aria-pressed:border-primary aria-pressed:text-primary"
              >
                {p.label}
              </button>
            ))}
          </span>
          <AgeInput values={input.values} onApply={(values) => setInput({ values })} />
        </>
      }
    >
      <svg viewBox={`0 0 ${W} 92`} className="w-full" aria-hidden>
        {bands.map((p) => (
          <g key={p.id}>
            <rect x={p.a} y={22} width={Math.max(0, p.b - p.a)} height={26} className={PART_FILL[p.id]} />
            <text x={(p.a + p.b) / 2} y={16} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              {p.label}
            </text>
          </g>
        ))}
        {[0, 12, 65, 120].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={20} y2={50} className="stroke-foreground/30" strokeDasharray="2 2" />
            <text x={x(t)} y={64} textAnchor="middle" className="fill-foreground/60 font-mono text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {input.values.map((age, i) => {
          const done = step.probes[i];
          const isCurrent = step.current === age && step.probes.length === (step.kind === "result" ? i + 1 : i);
          const cls = done ? (done.mismatch ? "fill-destructive" : "fill-accent") : isCurrent ? "fill-primary" : "fill-muted-foreground/40";
          return (
            <g key={`${age}.${i}`}>
              <circle cx={x(age)} cy={35} r={isCurrent ? 7 : 5} className={`${cls} transition-all`} />
              {(isCurrent || done?.mismatch) && (
                <text x={x(age)} y={82} textAnchor="middle" className={`font-mono text-[10px] ${done?.mismatch ? "fill-destructive" : "fill-foreground/70"}`}>
                  {age}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="mt-2 w-full font-mono text-[11.5px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-1 font-normal">age</th>
            <th className="font-normal">partition</th>
            <th className="font-normal">spec</th>
            <th className="font-normal">shipped</th>
            <th className="text-right font-normal">result</th>
          </tr>
        </thead>
        <tbody>
          {step.probes.map((p, i) => (
            <tr key={i} className={`border-t border-border/60 ${p.mismatch ? "text-destructive" : ""}`}>
              <td className="py-1">{p.age}</td>
              <td className="text-muted-foreground">{partitionOf(p.age)}</td>
              <td>{showOutcome(p.spec)}</td>
              <td>{showOutcome(p.shipped)}</td>
              <td className="text-right">
                <Mark pass={!p.mismatch} />
              </td>
            </tr>
          ))}
          {step.probes.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-muted-foreground">No probes run yet. Press → to run the first.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Frame>
  );
}
