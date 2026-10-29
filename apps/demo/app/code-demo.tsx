"use client";

import {
  CodeBlock,
  PlayerBar,
  TourCard,
  TourSpotlight,
  useGuidedTour,
  useStepPlayer,
  type StepTone,
  type TourStepInput,
} from "@sphynxoid/stepwise";
import { useSiteTheme } from "./theme-provider";
import { darkCodePanelTheme } from "./site-themes";
import { useState } from "react";

const PLAYER_FRAMES: { tone: StepTone; label: string; code: string[] }[] = [
  { tone: "write", label: "Parse", code: ["tokens = lexer(src)"] },
  { tone: "write", label: "Reduce", code: ["ast = parser(tokens)"] },
  { tone: "good", label: "Done", code: ["return ast"] },
];

const PLAYER_CODE = [
  'const FRAMES = [',
  '  { tone: "write", label: "Parse", code: ["tokens = lexer(src)"] },',
  '  { tone: "write", label: "Reduce", code: ["ast = parser(tokens)"] },',
  '  { tone: "good", label: "Done", code: ["return ast"] },',
  '];',
  '',
  'function PipelineDemo() {',
  '  const player = useStepPlayer({',
  '    total: FRAMES.length,',
  '    autoPlay: true,',
  '    onEnd: () => console.log("done"),',
  '  });',
  '  const frame = FRAMES[Math.max(0, player.index)];',
  '',
  '  return (',
  '    <>',
  '      <CodeBlock lines={frame.code} />',
  '      <PlayerBar player={player} />',
  '      {player.ended && <DoneBadge />}',
  '    </>  );',
  '} ',
];

function PlayerExample() {
  const { theme } = useSiteTheme();
  const player = useStepPlayer({ total: PLAYER_FRAMES.length, autoPlay: true, baseDelayMs: 1200 });
  const frame = PLAYER_FRAMES[Math.max(0, player.index)];

  return (
    <div className="space-y-3">
      <CodeBlock lines={frame.code} theme={theme} className="min-h-[46px]" />
      <PlayerBar
        player={player}
        toneAt={(i) => PLAYER_FRAMES[i]?.tone ?? "neutral"}
        titleAt={(i) => PLAYER_FRAMES[i]?.label ?? `frame ${i + 1}`}
        theme={theme}
        className="rounded-md border border-border/60 bg-background/40"
      />
      <p className="text-[11px] font-mono text-muted-foreground">
        frame {Math.max(0, player.index) + 1}/{PLAYER_FRAMES.length} - {frame.label}
      </p>
      {player.ended && (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-mono leading-relaxed text-accent">
          playback complete - ended is set and onEnd has fired. Replay moves the
          cursor, which clears it.
        </p>
      )}
    </div>
  );
}

const TOUR_STEPS: TourStepInput[] = [
  {
    id: "left",
    title: "Source",
    body: "Everything enters here - the trace your engine produces.",
    target: "cdemo-src",
  },
  {
    id: "right",
    title: "Output",
    body: "The kit narrates it: spotlight, card, keyboard, focus.",
    target: "cdemo-out",
  },
  {
    id: "end",
    title: "That's the tour",
    body: "Three steps of state - the card and spotlight are just components.",
  },
];

const TOUR_CODE = [
  'const STEPS: TourStepInput[] = [',
  '  { id: "left", title: "Source", body: "...", target: "cdemo-src" },',
  '  { id: "right", title: "Output", body: "...", target: "cdemo-out" },',
  '  { id: "end", title: "That\'s the tour", body: "..." },',
  '];',
  '',
  'function TourDemo() {',
  '  const tour = useGuidedTour(STEPS);',
  '',
  '  return (',
  '    <>',
  '      <button onClick={tour.start}>Run tour</button>',
  '      {tour.active && tour.current && (',
  '        <>',
  '          <TourSpotlight target={tour.current.target} />',
  '          <TourCard step={tour.current} index={tour.index ?? 0}',
  '            total={STEPS.length} onNext={tour.next}',
  '            onBack={tour.back} onEnd={tour.end} />',
  '        </>  )}',
  '    </>  );',
  '} ',
];

function TourExample() {
  const { theme } = useSiteTheme();
  const tour = useGuidedTour(TOUR_STEPS);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div id="cdemo-src" className="rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/40">
          <p className="text-[12px] font-semibold text-foreground/80">Source</p>
          <p className="mt-1 text-[11px] font-mono text-muted-foreground">frames -&gt;</p>
        </div>
        <div id="cdemo-out" className="rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/40">
          <p className="text-[12px] font-semibold text-foreground/80">Output</p>
          <p className="mt-1 text-[11px] font-mono text-muted-foreground">-&gt; narration</p>
        </div>
      </div>
      <button
        type="button"
        onClick={tour.start}
        className="inline-flex h-8 items-center rounded-md border border-primary/40 bg-background/40 px-3 text-[11px] font-mono text-foreground/85 transition hover:border-primary/70 hover:text-foreground cursor-pointer"
      >
        {tour.active ? "Tour running..." : "Run tour"}
      </button>
      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} theme={theme} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={TOUR_STEPS.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
            theme={theme}
          />
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: "player", label: "useStepPlayer" },
  { id: "tour", label: "useGuidedTour" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CodeDemo() {
  const [tab, setTab] = useState<TabId>("player");

  return (
    <section id="code" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
          In code
        </p>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl sw-fade-up sw-fade-up-1">
          What it looks like in your app
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sw-fade-up sw-fade-up-2">
          Each tab pairs the usage code with the component it renders, running
          live on the right.
        </p>

        <div className="mt-8 inline-flex rounded-lg border border-border bg-card/60 p-1 sw-fade-up sw-fade-up-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`h-8 rounded-md px-3.5 font-mono text-[11px] transition cursor-pointer ${
                tab === t.id
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div style={{ "--foreground": "#e9eef8" } as React.CSSProperties}>
            <div className="rounded-xl border border-slate-700/60 bg-[#0b1020] p-1.5 shadow-xl sw-card-glow">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                <span className="text-[10.5px] font-mono text-slate-500">
                  {tab === "player" ? "pipeline-demo.tsx" : "tour-demo.tsx"}
                </span>
              </div>
              <CodeBlock
                lines={tab === "player" ? PLAYER_CODE : TOUR_CODE}
                theme={darkCodePanelTheme}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-md shadow-xl sw-card-glow">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Result
              </span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground">live</span>
            </div>
            {tab === "player" ? <PlayerExample /> : <TourExample />}
          </div>
        </div>
      </div>
    </section>
  );
}