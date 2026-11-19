"use client";

import type { StepTone } from "@sphynxoid/stepwise";
import { Choices, useExplainer } from "@sphynxoid/stepwise/kit";
import { LIFECYCLE_SHIPPED, LIFECYCLE_SPEC, type LifeState } from "./driftwood";
import { MAX_ACTIONS, specGraph, type LifeStep } from "./lifecycle.walk";
import { Frame } from "./views";

// §05's view. The chapter is a walk explainer (lifecycle.walk.ts): the kit
// runs the walk, links the path (#life.path=…) and renders the narration,
// the "why" box and the bar; this draws the spec's graph from fromGraph's
// `.graph` (typed: edges carry LifeState ids) and places <Choices> in the
// frame's controls.

const POS: Record<LifeState, [number, number]> = {
  draft: [70, 54],
  held: [230, 54],
  paid: [390, 54],
  issued: [550, 54],
  cancelled: [150, 170],
  refunded: [470, 170],
};
const W = 620;
const R = 30;

const edgeKey = (e: { from: string; on: string; to?: string | null }) => `${e.from}-${e.on}`;

function Edge({ from, to, on, cls, label }: { from: LifeState; to: LifeState; on: string; cls: string; label: string }) {
  const [x1, y1] = POS[from];
  const [x2, y2] = POS[to];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Bow the line slightly so overlapping edges stay apart.
  const mx = (x1 + x2) / 2 - uy * 14;
  const my = (y1 + y2) / 2 + ux * 14;
  const sx = x1 + ux * R;
  const sy = y1 + uy * R;
  const ex = x2 - ux * (R + 4);
  const ey = y2 - uy * (R + 4);
  return (
    <g>
      <path d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} className={`fill-none ${cls}`} strokeWidth={1.5} markerEnd="url(#qa-arrow)" />
      <text x={mx} y={my - 3} textAnchor="middle" className={`font-mono text-[10px] ${label}`}>
        {on}
      </text>
    </g>
  );
}

const RESULT_TONE: Record<string, StepTone> = { start: "neutral", moved: "good", refused: "accent", bug: "bad", end: "write" };

export function LifecycleView() {
  const { step: current } = useExplainer<null, LifeStep>();
  const step = current!;
  const found = step.result === "bug";
  const tried = new Set(step.log.map(edgeKey));
  const covered = LIFECYCLE_SPEC.filter((e) => step.log.some((a) => a.from === e.from && a.on === e.on)).length;
  const refusals = step.log.filter((a) => a.spec === null).length;
  const extra = LIFECYCLE_SHIPPED.filter((e) => !LIFECYCLE_SPEC.some((s) => edgeKey(s) === edgeKey(e)));

  return (
      <Frame
        title="booking-lifecycle · you are the tester"
        tone={RESULT_TONE[step.result]}
        status={found ? <span data-testid="qa-life-found">illegal transition found</span> : `${step.log.length}/${MAX_ACTIONS} actions`}
        label={`Booking in state ${step.state}; ${step.log.length} actions tried`}
        controls={
          <>
            <Choices label="Next action" className="font-mono">
              Try
            </Choices>
            <span className="text-muted-foreground">
              valid edges tried {covered}/{LIFECYCLE_SPEC.length} · refusals checked {refusals}
            </span>
          </>
        }
      >
        <svg viewBox={`0 0 ${W} 214`} className="w-full" aria-hidden>
          <defs>
            <marker id="qa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {specGraph.graph.edges.map((e) => (
            <Edge
              key={edgeKey(e)}
              from={e.from}
              to={e.to}
              on={e.on}
              cls={tried.has(edgeKey(e)) ? "stroke-accent" : "stroke-muted-foreground/40"}
              label={tried.has(edgeKey(e)) ? "fill-accent" : "fill-muted-foreground"}
            />
          ))}
          {found &&
            extra.map((e) => (
              <Edge key={edgeKey(e)} from={e.from} to={e.to} on={`${e.on} (!)`} cls="stroke-destructive [stroke-dasharray:4_3]" label="fill-destructive" />
            ))}
          {(Object.keys(POS) as LifeState[]).map((s) => {
            const [x, y] = POS[s];
            const here = s === step.state;
            return (
              <g key={s}>
                <circle
                  cx={x}
                  cy={y}
                  r={R}
                  className={`transition-colors ${here ? (found ? "fill-destructive/20 stroke-destructive" : "fill-primary/15 stroke-primary") : "fill-card stroke-border"}`}
                  strokeWidth={here ? 2.5 : 1.5}
                />
                <text x={x} y={y + 4} textAnchor="middle" className={`font-mono text-[11px] ${here ? "fill-foreground" : "fill-foreground/70"}`}>
                  {s}
                </text>
              </g>
            );
          })}
        </svg>
        <ol data-testid="qa-life-log" className="mt-2 max-h-36 space-y-0.5 overflow-y-auto font-mono text-[11px]">
          {step.log.map((a, i) => {
            const bug = a.spec === null && a.shipped !== null;
            return (
              <li key={i} className={bug ? "text-destructive" : a.spec === null ? "text-foreground/60" : "text-foreground/80"}>
                <span className="mr-2 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {a.from} --{a.on}--&gt; {bug ? `${a.shipped} (spec: refuse)` : a.spec ?? "refused"}
              </li>
            );
          })}
          {step.log.length === 0 && <li className="text-muted-foreground">No actions yet. Every state has five buttons; the interesting ones are the ones that should fail.</li>}
        </ol>
      </Frame>
  );
}
