"use client";

import { useExplainer } from "@sphynxoid/stepwise/kit";
import { FAILING_PAYLOAD, PAYLOAD_FIELDS } from "./driftwood";
import type { ShrinkInput, ShrinkStep } from "./shrink.explainer";
import { QUADRANTS, quadrantOf, type TriageInput, type TriageStep } from "./triage.explainer";
import { Frame } from "./views";

// Views for §10: shrinking a failing payload, and triage on a 2×2.

export function ShrinkView() {
  const { step } = useExplainer<ShrinkInput, ShrinkStep>();
  if (!step) return null;
  return (
    <Frame
      title="repro · POST /checkout"
      tone={step.tone}
      status={`${step.kept.length} suspect${step.kept.length === 1 ? "" : "s"} · ${step.runs} runs`}
      label={`Payload with ${step.kept.length} fields still at the customer's values`}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <table className="w-full font-mono text-[11.5px]">
          <tbody>
            {PAYLOAD_FIELDS.map((f) => {
              const suspect = step.kept.includes(f);
              const testing = step.field === f;
              const original = JSON.stringify(FAILING_PAYLOAD[f]);
              const now = JSON.stringify(step.payload[f]);
              return (
                <tr key={f} className={`border-t border-border/50 ${testing ? "bg-primary/[0.08]" : ""}`}>
                  <td className="w-24 py-1 text-muted-foreground">{f}</td>
                  <td className={suspect ? "text-foreground" : "text-muted-foreground/50 line-through"}>{original}</td>
                  <td className="text-muted-foreground">{now !== original ? `→ ${now}` : ""}</td>
                  <td className="text-right">
                    {testing && step.kind === "try" ? (
                      <span className="text-primary">running…</span>
                    ) : testing && step.kind === "result" ? (
                      <span className={step.fails ? "text-muted-foreground" : "text-destructive"}>{step.fails ? "noise" : "matters"}</span>
                    ) : !suspect ? (
                      <span className="text-muted-foreground/60">noise</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="min-w-44 rounded-lg border border-destructive/40 bg-destructive/[0.05] p-3 font-mono text-[11px]">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-destructive">bug report draft</p>
          <p className="text-foreground/85">Checkout crashes when:</p>
          <p data-testid="shrink-kept" className="mt-1 text-foreground">
            {step.kept.join(", ")}
          </p>
          <p className="mt-2 text-muted-foreground">expected: 422 (max 8)</p>
          <p className="text-muted-foreground">actual: 500</p>
        </div>
      </div>
    </Frame>
  );
}

const Q_CLASS: Record<string, string> = {
  "high-high": "border-destructive/50 bg-destructive/[0.06]",
  "high-low": "border-amber-500/40 bg-amber-400/[0.06]",
  "low-high": "border-primary/40 bg-primary/[0.06]",
  "low-low": "border-border bg-secondary/30",
};

export function TriageView() {
  const { step } = useExplainer<TriageInput, TriageStep>();
  if (!step) return null;
  return (
    <Frame title="triage board" tone={step.tone} status={`${step.placed.length} placed`} label={`${step.placed.length} bugs placed on the severity and priority grid`}>
      {step.kind === "card" && step.current && (
        <div className="mb-3 rounded-lg border border-primary/50 bg-primary/[0.06] px-3 py-2 text-[13px]">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-primary">new</span>
          {step.current.title}
        </div>
      )}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 font-mono text-[10px]">
        <span />
        <span className="text-center text-muted-foreground">priority: high (fix now)</span>
        <span className="text-center text-muted-foreground">priority: low (can wait)</span>
        {(["high", "low"] as const).map((sev) => (
          <div key={sev} className="contents">
            <span className="flex items-center text-muted-foreground [writing-mode:vertical-rl] rotate-180">severity: {sev}</span>
            {(["high", "low"] as const).map((pri) => {
              const q = `${sev}-${pri}`;
              const cards = step.placed.filter((c) => quadrantOf(c) === q);
              return (
                <div key={q} className={`min-h-24 rounded-lg border p-2 ${Q_CLASS[q]}`}>
                  <p className="mb-1 text-[9.5px] text-muted-foreground">{QUADRANTS.find((x) => x.value === q)!.label}</p>
                  <ul className="space-y-1">
                    {cards.map((c) => (
                      <li
                        key={c.id}
                        className={`rounded border border-border bg-card px-1.5 py-1 text-[11px] leading-snug text-foreground/85 ${step.current?.id === c.id && step.kind === "placed" ? "ring-1 ring-primary" : ""}`}
                      >
                        {c.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Frame>
  );
}
