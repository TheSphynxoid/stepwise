"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FastForward, Pause, Play, RotateCcw } from "lucide-react";
import {
  createRng,
  useGlobalKeys,
  useTrace,
  PlayerBar,
  TONE_CHIP_CLASS,
  type StepwiseStep,
} from "@sphynxoid/stepwise";
import { useSiteTheme } from "../theme-provider";

// A build pipeline that reports one event at a time. The events arrive on
// their own clock; the player plays them on its own. With `follow`, a reader
// at the live edge watches each event play in as it lands, and a reader who
// scrubbed back to inspect something stays there until they choose "Go live".

type Stage = "fetch" | "compile" | "test" | "deploy";
type Event = StepwiseStep<{ stage: Stage; detail: string }>;

const STAGES: Stage[] = ["fetch", "compile", "test", "deploy"];

// The whole run is computed up front from a seed (pure, module scope); the
// page only decides how much of it has "arrived" so far.
const EVENTS: Event[] = (() => {
  const rng = createRng("pipeline");
  const out: Event[] = [];
  const add = (stage: Stage, key: string, tone: Event["tone"], label: string, detail: string) =>
    out.push({ key, stage, tone, label, detail });

  add("fetch", "fetch", "neutral", "fetch sources", "git clone --depth 1");
  add("fetch", "install", "neutral", "install dependencies", `${rng.int(180, 260)} packages`);
  const modules = ["lexer", "parser", "checker", "codegen", "runtime"];
  for (const m of modules) add("compile", `compile:${m}`, "write", `compile ${m}`, `${rng.int(40, 400)} ms`);
  const flaky = rng.int(2, 6);
  for (let t = 0; t < 8; t++) {
    if (t === flaky) {
      add("test", `test:${t}`, "bad", `test suite ${t + 1} failed`, "timeout after 5000 ms");
      add("test", `test:${t}.retry`, "good", `test suite ${t + 1} passed on retry`, "flaky: network fixture");
    } else {
      add("test", `test:${t}`, "good", `test suite ${t + 1} passed`, `${rng.int(8, 40)} tests`);
    }
  }
  add("deploy", "bundle", "write", "bundle artifacts", `${rng.int(90, 160)} kB gzip`);
  add("deploy", "deploy", "accent", "deploy to preview", "preview.example.test");
  add("deploy", "done", "good", "pipeline finished", "all stages green");
  return out;
})();

// Arrival gaps vary (seeded), and on average the stream is slower than
// playback, so a following reader keeps catching up to the edge.
const GAPS = (() => {
  const rng = createRng("arrivals");
  return EVENTS.map(() => rng.int(700, 1600));
})();

export default function Demo() {
  const { theme } = useSiteTheme();
  const [received, setReceived] = useState(1);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    if (!streaming || received >= EVENTS.length) return;
    const id = setTimeout(() => setReceived((n) => Math.min(n + 1, EVENTS.length)), GAPS[received]);
    return () => clearTimeout(id);
  }, [streaming, received]);

  const steps = useMemo(() => EVENTS.slice(0, received), [received]);
  const { step, frame, player, toneAt, titleAt } = useTrace(steps, {
    autoPlay: true,
    follow: true,
    baseDelayMs: 450,
  });
  const cur = step!;
  const finished = received >= EVENTS.length;

  // Keep the playhead's row in view inside the log (scrolling the list
  // itself, never the page).
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = logRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !row) return;
    const top = row.offsetTop; // the list is `relative`, so this is list-relative
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight;
  }, [frame]);

  const burst = () => setReceived((n) => Math.min(n + 6, EVENTS.length));
  const restart = () => {
    setReceived(1);
    setStreaming(true);
    player.start();
  };

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(),
    l: player.goLive,
  });

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">Demo - Live edge</p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">Watch it live, then scrub back</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          These events arrive one at a time, like a build log or an agent&apos;s steps. With{" "}
          <code className="text-primary">follow</code>, the player plays each new event in as it lands. Click an earlier
          event to inspect it: the stream keeps arriving, but you stay where you are until you press{" "}
          <em>Go live</em> (or L). Try <em>Burst</em> to see the player catch up at its own pace.
        </p>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[cur.tone]}`}>
                {cur.stage}
              </span>
              <span className="text-[13px] font-semibold truncate" data-testid="live-label">{cur.label}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0" data-testid="live-count">
              {received}/{EVENTS.length} received{finished ? " · stream closed" : ""}
            </span>
          </div>

          {/* Stage progress at the playhead (not at the stream's edge). */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {STAGES.map((s) => {
              const all = EVENTS.filter((e) => e.stage === s).length;
              const done = steps.slice(0, frame + 1).filter((e) => e.stage === s).length;
              return (
                <div key={s}>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>{s}</span>
                    <span>{done}/{all}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(done / all) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <ol ref={logRef} className="relative max-h-72 overflow-y-auto rounded-md border border-border/60 bg-background/40 divide-y divide-border/40" aria-label="Event log">
            {steps.map((e, i) => (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => player.seek(i)}
                  aria-current={i === frame ? "step" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-[12px] font-mono transition ${
                    i === frame ? "bg-primary/10 text-foreground" : i > frame ? "text-foreground/30" : "text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  <span className="w-6 text-right text-muted-foreground">{i + 1}</span>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.tone === "bad" ? "bg-destructive" : e.tone === "good" ? "bg-accent" : "bg-primary/60"}`} />
                  <span className="flex-1 truncate">{e.label}</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">{e.detail}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setStreaming((s) => !s)}
              disabled={finished}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-mono text-foreground/70 hover:text-foreground hover:border-primary/40 transition disabled:opacity-40"
            >
              {streaming ? <Pause size={12} /> : <Play size={12} />} {streaming ? "Pause stream" : "Resume stream"}
            </button>
            <button
              type="button"
              onClick={burst}
              disabled={finished}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-mono text-foreground/70 hover:text-foreground hover:border-primary/40 transition disabled:opacity-40"
            >
              <FastForward size={12} /> Burst (+6)
            </button>
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-mono text-foreground/70 hover:text-foreground hover:border-primary/40 transition"
            >
              <RotateCcw size={12} /> Restart
            </button>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground hidden sm:inline">← → step · space play · L go live</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <PlayerBar player={player} toneAt={toneAt} titleAt={titleAt} theme={theme} live className="p-2" />
        </div>
      </div>
    </main>
  );
}
