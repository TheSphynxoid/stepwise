"use client";

import { PlayerBar, useSyncedTracks } from "@sphynxoid/stepwise";
import { useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { IMPLS, type ApiInput, type ApiStep } from "./api.explainer";
import { LEVELS, PYRAMID, type LevelStep } from "./pyramid.traces";
import { Frame, Mark, Segmented } from "./views";

// Views for §06 (the pyramid, a synced-tracks player outside the kit) and
// §07 (API testing, a kit explainer).

// ─── §06 The test pyramid ────────────────────────────────────────────

const MAX_MS = PYRAMID.ui[PYRAMID.ui.length - 1].elapsed;
// Log scale: 1 ms and 2.4 s on one bar would otherwise leave unit invisible.
const barPct = (ms: number) => Math.max(2, (Math.log10(1 + ms) / Math.log10(1 + MAX_MS)) * 100);

const syncKey = (s: LevelStep) => s.sync;

export function Pyramid() {
  const { theme } = useSiteTheme();
  const cmp = useSyncedTracks(PYRAMID, { key: syncKey, baseDelayMs: 900 });
  return (
    <div data-testid="qa-pyramid" data-stepwise="" className="space-y-3">
      <Frame title="one bug · three levels · one player" tone="neutral" status={`frame ${Math.max(0, cmp.frame) + 1}/${cmp.total}`} label="Unit, API and UI tests catching the same bug">
        <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
          <svg viewBox="0 0 140 120" className="mx-auto hidden w-36 md:block" aria-hidden>
            <polygon points="70,6 100,46 40,46" className="fill-destructive/15 stroke-destructive/50" />
            <polygon points="40,50 100,50 120,80 20,80" className="fill-amber-400/15 stroke-amber-500/50" />
            <polygon points="20,84 120,84 138,114 2,114" className="fill-accent/15 stroke-accent/50" />
            <text x="70" y="36" textAnchor="middle" className="fill-foreground/80 font-mono text-[9px]">UI</text>
            <text x="70" y="69" textAnchor="middle" className="fill-foreground/80 font-mono text-[9px]">API</text>
            <text x="70" y="103" textAnchor="middle" className="fill-foreground/80 font-mono text-[9px]">unit</text>
          </svg>
          <div className="space-y-3">
            {LEVELS.map((lvl) => {
              const view = cmp.tracks[lvl.id];
              const s = view.step!;
              const failed = view.done && s.tone === "bad";
              return (
                <div key={lvl.id} data-testid={`pyr-${lvl.id}`} className={`rounded-lg border px-3 py-2 transition-colors ${failed ? "border-destructive/50" : "border-border"}`}>
                  <div className="mb-1 flex items-center justify-between font-mono text-[10.5px]">
                    <span className="text-foreground">
                      {lvl.name} <span className="text-muted-foreground">· {lvl.share} of tests · runs {lvl.runs}</span>
                    </span>
                    <span className={failed ? "text-destructive" : view.held ? "text-muted-foreground" : "text-primary"}>
                      {failed ? "FAIL" : view.held ? "waiting" : s.label}
                    </span>
                  </div>
                  <code className={`block truncate font-mono text-[11px] ${view.held ? "text-foreground/45" : "text-foreground/85"}`}>{s.line}</code>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className={`block h-full rounded-full transition-all duration-500 ${failed ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${barPct(s.elapsed)}%` }}
                      />
                    </span>
                    <span className="w-16 text-right font-mono text-[10.5px] text-muted-foreground">{s.elapsed} ms</span>
                  </div>
                </div>
              );
            })}
            <p className="font-mono text-[10px] text-muted-foreground">time bars are log scale: the UI test is ~2,400× slower than the unit test</p>
          </div>
        </div>
      </Frame>
      <PlayerBar player={cmp.player} toneAt={cmp.toneAt} titleAt={cmp.titleAt} theme={theme} />
    </div>
  );
}

// ─── §07 API testing ─────────────────────────────────────────────────

export function ApiView() {
  const { step, input, setInput } = useExplainer<ApiInput, ApiStep>();
  if (!step) return null;
  const passed = step.history.filter((h) => h.pass).length;
  const showing = step.kind === "request" || step.kind === "response";
  return (
    <Frame
      title={`api-tests · ${input.impl} build`}
      tone={step.tone}
      status={<span data-testid="api-summary">{`${passed}/${step.history.length} pass`}</span>}
      label={`API test run: ${passed} of ${step.history.length} requests passed`}
      controls={<Segmented label="API" value={input.impl} options={IMPLS} onChange={(impl) => setInput({ impl })} />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2 font-mono text-[11.5px]">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">request</p>
            {showing ? (
              <>
                <p>
                  <span className="text-primary">{step.call.method}</span> {step.call.path}
                </p>
                <pre className="mt-1 whitespace-pre-wrap text-foreground/70">{step.call.body ? JSON.stringify(step.call.body) : "(no body)"}</pre>
              </>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </div>
          <div className={`rounded-lg border p-3 ${step.kind === "response" ? (step.tone === "bad" ? "border-destructive/50" : "border-accent/40") : "border-border"} bg-background/60`}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">response</p>
            {step.res ? (
              <>
                <p className={step.res.status >= 400 ? "text-amber-500 [[data-theme=light]_&]:text-amber-700" : "text-accent"}>HTTP {step.res.status}</p>
                <pre className="mt-1 whitespace-pre-wrap text-foreground/70">{JSON.stringify(step.res.body)}</pre>
              </>
            ) : (
              <p className="text-muted-foreground">{step.kind === "request" ? "waiting..." : "-"}</p>
            )}
            {step.checks.map((c) => (
              <p key={c.kind} className={`mt-1 ${c.pass ? "text-accent" : "text-destructive"}`}>
                <Mark pass={c.pass} className="mr-1" />
                {c.kind}: {c.detail}
              </p>
            ))}
          </div>
        </div>
        <ol className="space-y-1 font-mono text-[11px]">
          {step.history.map((h) => (
            <li key={h.id} className={`flex justify-between gap-2 ${h.pass ? "text-foreground/75" : "text-destructive"}`}>
              <span>
                <Mark pass={h.pass} className="mr-1.5" />
                {h.id}
              </span>
              <span>{h.status}</span>
            </li>
          ))}
          {step.history.length === 0 && <li className="text-muted-foreground">results appear here</li>}
        </ol>
      </div>
    </Frame>
  );
}
