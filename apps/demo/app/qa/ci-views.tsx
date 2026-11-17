"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerBar, useTrace } from "@sphynxoid/stepwise";
import { useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { COMMITS, SLEEP_MS } from "./tidepool";
import { LATENCY, SELECTORS, SELECTOR_CODE, STRATEGIES, STRATEGY_CODE, type FlakyInput, type FlakyStep } from "./flaky.explainer";
import type { BisectInput, BisectStep } from "./bisect.explainer";
import { BUILDS, BUILD_EVERY_MS, INITIAL_BUILDS, type Build } from "./ci.builds";
import { Frame, Mark, Segmented } from "./views";

// Views for §08 (flaky tests) and §09 (CI: a live feed outside the kit,
// and bisect as a kit explainer).

// ─── §08 Flaky tests ─────────────────────────────────────────────────

export function FlakyView() {
  const { step, input, setInput } = useExplainer<FlakyInput, FlakyStep>();
  if (!step) return null;
  const set = (patch: Partial<FlakyInput>) => setInput({ ...input, ...patch });
  const x = (ms: number) => (ms / (LATENCY.max + 40)) * 100;
  const cur = step.current;
  return (
    <Frame
      title={`ui-test · book.spec.ts · seed ${input.seed}`}
      tone={step.tone}
      status={<span data-testid="flaky-rate">{step.results.length ? `${Math.round(step.passRate * 100)}% pass` : "not run"}</span>}
      label={`${step.results.length} runs, ${Math.round(step.passRate * 100)}% passed`}
      controls={
        <>
          <Segmented label="Wait" value={input.strategy} options={STRATEGIES} onChange={(strategy) => set({ strategy })} />
          <Segmented label="Selector" value={input.selector} options={SELECTORS} onChange={(selector) => set({ selector })} />
          <span className="inline-flex items-center gap-2">
            Seed
            <button type="button" onClick={() => set({ seed: (input.seed + 1) % 10000 })} className="rounded-md border border-border px-2 py-1 hover:bg-secondary" aria-label="Next seed">
              {input.seed} ↻
            </button>
          </span>
        </>
      }
    >
      <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
        <span className="text-muted-foreground">test(&apos;book a ticket&apos;, async ({"{ page }"}) =&gt; {"{"}</span>
        {"\n  await page.goto('/book')\n  "}
        <span className={input.strategy === "sleep" ? "text-destructive" : "text-accent"}>{STRATEGY_CODE[input.strategy]}</span>
        {"\n  await "}
        <span className={input.selector === "fragile" ? "text-destructive" : "text-accent"}>{SELECTOR_CODE[input.selector]}</span>
        {"\n"}
        <span className="text-muted-foreground">{"})"}</span>
      </pre>
      <div className="relative mb-1 h-14 rounded-md border border-border bg-background/40" aria-hidden>
        {input.strategy === "sleep" && (
          <div className="absolute inset-y-0 border-l-2 border-dashed border-destructive/70" style={{ left: `${x(SLEEP_MS)}%` }}>
            <span className="absolute -top-0.5 left-1 font-mono text-[9.5px] text-destructive">click @ {SLEEP_MS} ms</span>
          </div>
        )}
        {step.results.map((r) => (
          <span
            key={r.n}
            title={`run ${r.n}: ${r.latency} ms`}
            className={`absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full ${r.pass ? "bg-accent/70" : "bg-destructive"}`}
            style={{ left: `${x(r.latency)}%`, top: `${18 + (r.n % 4) * 8}px` }}
          />
        ))}
        {cur && (
          <span className="absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/30" style={{ left: `${x(cur.latency)}%`, top: "18px" }} />
        )}
        <span className="absolute bottom-0.5 left-1 font-mono text-[9px] text-muted-foreground">0 ms</span>
        <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-muted-foreground">{LATENCY.max} ms · when the Book button rendered</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: input.runs }, (_, i) => {
          const r = step.results[i];
          const isCur = cur?.n === i + 1 && !r;
          return (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] ${
                r ? (r.pass ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive") : isCur ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground/50"
              }`}
            >
              {r ? (r.pass ? "✓" : r.banner && input.selector === "fragile" ? "B" : "✗") : i + 1}
            </span>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">✗ clicked too early · B clicked the banner · same seed, same runs: the link replays this exact sequence</p>
    </Frame>
  );
}

// ─── §09 CI: a live feed, then bisect ────────────────────────────────

/** Builds stream in on a timer, like a CI dashboard; the player follows the newest one. */
export function CiFeed() {
  const { theme } = useSiteTheme();
  const [count, setCount] = useState(INITIAL_BUILDS);
  useEffect(() => {
    if (count >= BUILDS.length) return;
    const t = setTimeout(() => setCount((c) => Math.min(BUILDS.length, c + 1)), BUILD_EVERY_MS);
    return () => clearTimeout(t);
  }, [count]);
  // Memoized: useTrace re-anchors on every new array, and a fresh slice per render loops forever.
  const builds = useMemo(() => BUILDS.slice(0, count), [count]);
  const { step, player, toneAt, titleAt } = useTrace(builds, { follow: true, autoPlay: true, baseDelayMs: 500 });
  const b = step as Build;
  return (
    <div data-testid="qa-ci" data-stepwise="" className="space-y-3">
      <Frame
        title="ci · main"
        tone={b.tone}
        status={<span data-testid="ci-count">{`${count}/${BUILDS.length} builds`}</span>}
        label={`Build ${b.n}: ${b.status}`}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <ol className="max-h-56 space-y-0.5 overflow-y-auto font-mono text-[11px]" aria-label="Builds">
            {builds
              .map((x, i) => ({ x, i }))
              .reverse()
              .map(({ x, i }) => (
                <li key={x.n}>
                  <button
                    type="button"
                    onClick={() => player.seek(i)}
                    className={`flex w-full gap-2 rounded px-1.5 py-0.5 text-left ${x.n === b.n ? "bg-primary/10" : "hover:bg-secondary"} ${x.status === "failed" ? "text-destructive" : "text-foreground/75"}`}
                  >
                    <Mark pass={x.status === "passed"} />
                    <span className="text-muted-foreground">#{x.n}</span>
                    <span className="truncate">{x.msg}</span>
                  </button>
                </li>
              ))}
          </ol>
          <div className="rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px]">
            <p className="mb-2 text-foreground">
              #{b.n} <span className="text-muted-foreground">{b.sha}</span> {b.msg}
            </p>
            <div className="flex items-center gap-1.5">
              {b.stages.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/50">→</span>}
                  <span
                    className={`rounded border px-2 py-1 ${
                      s.status === "passed" ? "border-accent/40 text-accent" : s.status === "failed" ? "border-destructive/60 bg-destructive/10 text-destructive" : "border-border text-muted-foreground/60"
                    }`}
                  >
                    {s.name}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-muted-foreground">
              {b.status === "failed" ? `unit failed: "12 is an adult" · api, e2e skipped · ${b.minutes} min` : `all stages green · ${b.minutes} min`}
            </p>
          </div>
        </div>
      </Frame>
      <PlayerBar player={player} toneAt={toneAt} titleAt={titleAt} theme={theme} live />
    </div>
  );
}

export function BisectView() {
  const { step } = useExplainer<BisectInput, BisectStep>();
  if (!step) return null;
  return (
    <Frame title="git bisect" tone={step.tone} status={`${step.probes} test run${step.probes === 1 ? "" : "s"}`} label={`Bisect range ${step.lo} to ${step.hi}`}>
      <ol className="grid grid-cols-10 gap-1 sm:grid-cols-20" aria-hidden>
        {COMMITS.map((c, i) => {
          const mark = step.marks[i];
          const inRange = i > step.lo && i < step.hi;
          const isMid = i === step.mid;
          const isFound = i === step.found;
          return (
            <li
              key={c.sha}
              title={`${c.sha} ${c.msg}`}
              className={`flex h-9 flex-col items-center justify-center rounded font-mono text-[9.5px] transition-all ${
                isFound
                  ? "bg-destructive text-destructive-foreground"
                  : isMid
                    ? "bg-primary/25 text-primary ring-1 ring-primary"
                    : mark === "good"
                      ? "bg-accent/15 text-accent"
                      : mark === "bad"
                        ? "bg-destructive/15 text-destructive"
                        : inRange
                          ? "bg-secondary text-foreground/70"
                          : "bg-secondary/30 text-muted-foreground/40"
              }`}
            >
              {i}
              <span className="text-[8px]">{mark ?? (inRange ? "?" : "")}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 font-mono text-[11px] text-foreground/75">
        {step.mid !== null ? (
          <p>
            <span className="text-muted-foreground">$</span> git checkout {COMMITS[step.mid].sha} <span className="text-muted-foreground"># {COMMITS[step.mid].msg}</span>
          </p>
        ) : step.found !== null ? (
          <p className="text-destructive">
            {COMMITS[step.found].sha} is the first bad commit: {COMMITS[step.found].msg}
          </p>
        ) : (
          <p>
            <span className="text-muted-foreground">$</span> git bisect start HEAD {COMMITS[0].sha}
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          suspects left: {Math.max(0, step.hi - step.lo - 1)} · range {step.lo}..{step.hi}
        </p>
      </div>
    </Frame>
  );
}
