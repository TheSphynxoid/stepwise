"use client";

import { CodeBlock, PlayerBar, useStepPlayer, type StepTone } from "@sphynx/stepwise";
import { useSiteTheme } from "./theme-provider";
import { useCallback } from "react";

interface Frame {
  tone: StepTone;
  label: string;
  code: string[];
}

const FRAMES: Frame[] = [
  { tone: "write", label: "Build", code: ["$ npm run build", "// esm 41.7 kB - dts clean"] },
  { tone: "neutral", label: "Test", code: ["$ npm test", "// 76/76 passing - jsdom"] },
  { tone: "write", label: "Stage", code: ["$ npm pack --dry-run", "// dist + README + LICENSE"] },
  { tone: "accent", label: "Publish", code: ["$ npm publish --access public", "// @sphynx/stepwise@0.1.0"] },
  { tone: "good", label: "Live", code: ["// published - docs site live", "// runs in light and dark"] },
];

export function HeroPlayer() {
  const { theme } = useSiteTheme();
  const player = useStepPlayer({ total: FRAMES.length, autoPlay: true, baseDelayMs: 1500 });

  const run = useCallback(() => {
    player.seek(0);
    player.setPlaying(true);
  }, [player]);

  const frame = player.index >= 0 ? Math.min(player.index, FRAMES.length - 1) : 0;
  const cur = FRAMES[frame];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-3xl bg-primary/15 blur-3xl -z-10 sw-float"
      />
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-2xl overflow-hidden sw-card-glow">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5 bg-secondary/30">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          <span className="ml-2 text-[11px] font-mono text-muted-foreground">
            release-pipeline - live player
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            playing
          </span>
        </div>
        <div className="p-4 space-y-3">
          <CodeBlock lines={cur.code} theme={theme} className="min-h-[64px]" />
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-foreground/75">{cur.label}</span>
            <span className="flex-1 border-t border-dashed border-border" />
            <span className="text-[11px] font-mono text-muted-foreground">
              useStepPlayer - PlayerBar - CodeBlock
            </span>
          </div>
          <PlayerBar
            player={player}
            toneAt={(i) => FRAMES[i]?.tone ?? "neutral"}
            titleAt={(i) => FRAMES[i]?.label ?? `frame ${i + 1}`}
            onEmpty={run}
            emptyHint="press play"
            theme={theme}
            className="rounded-md border border-border/60 bg-background/40"
          />
        </div>
      </div>
    </div>
  );
}