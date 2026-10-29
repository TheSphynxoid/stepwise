"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useStepPlayer,
  PlayerBar,
  defaultTheme,
  type StepTone,
  type StepwiseTheme,
} from "@sphynx/stepwise";
import { useCallback, useEffect } from "react";

interface Frame {
  tone: StepTone;
  label: string;
  detail: string;
  state: ("LISTEN" | "SYN" | "SYN+ACK" | "ACK" | "ESTABLISHED" | "FIN" | "ACK(FIN)" | "CLOSED")[];
}

const FRAMES: Frame[] = [
  { tone: "neutral", label: "Server opens a socket", detail: "The server binds a port and listens. No traffic yet.", state: ["LISTEN"] },
  { tone: "write", label: "Client sends SYN", detail: "The client sends a SYN with a random sequence number - an offer to connect.", state: ["LISTEN", "SYN"] },
  { tone: "write", label: "Server replies SYN+ACK", detail: "The server acknowledges and returns its own SYN, half of the handshake.", state: ["SYN", "SYN+ACK"] },
  { tone: "good", label: "Client sends ACK", detail: "The client acknowledges - the connection is established. Data can flow.", state: ["ESTABLISHED"] },
  { tone: "neutral", label: "Connection holds", detail: "Both sides exchange data. The connection is fully bidirectional.", state: ["ESTABLISHED"] },
  { tone: "bad", label: "Client sends FIN", detail: "The client is done sending and wants to close. It enters FIN_WAIT.", state: ["ESTABLISHED", "FIN"] },
  { tone: "bad", label: "Server acks the FIN", detail: "The server acknowledges - the client-to-server direction is closed.", state: ["ACK(FIN)", "FIN"] },
  { tone: "good", label: "Connection closed", detail: "Both sides have closed. The socket is released.", state: ["CLOSED"] },
];

const STATE_COLORS: Record<string, string> = {
  LISTEN: "text-zinc-500",
  SYN: "text-amber-600",
  "SYN+ACK": "text-amber-500",
  ACK: "text-blue-600",
  ESTABLISHED: "text-green-600",
  FIN: "text-rose-500",
  "ACK(FIN)": "text-rose-400",
  CLOSED: "text-zinc-400",
};

const LIGHT_THEME: StepwiseTheme = {
  toneSegment: {
    neutral: "bg-slate-300",
    accent: "bg-emerald-500/70",
    good: "bg-blue-600",
    bad: "bg-red-500/70",
    write: "bg-slate-500/50",
    idle: "bg-slate-200",
  },
  toneChip: {
    neutral: "text-slate-500 border-slate-300",
    accent: "text-emerald-700 border-emerald-300",
    good: "text-blue-700 border-blue-300",
    bad: "text-red-600 border-red-300",
    write: "text-slate-600 border-slate-400",
    idle: "text-slate-400 border-slate-200",
  },
  buttonBase: defaultTheme.buttonBase,
  buttonVariants: {
    ghost: "border border-transparent text-slate-600 hover:bg-slate-950/5 hover:text-slate-900",
    outline:
      "border border-blue-600/40 bg-white/70 text-slate-800 hover:border-blue-600/70 hover:text-blue-700",
    primary: "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
  },
  surface: "border border-slate-200 bg-white/90 backdrop-blur-md",
  overlay: "bg-slate-950/40 backdrop-blur-sm",
  codeBlock:
    "rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[11.5px] leading-5 overflow-x-auto",
  codeMuted: "text-slate-400",
  kbd: "font-mono text-[10px] px-1.5 py-0.5 border border-slate-300 bg-slate-50 rounded text-slate-700",
  spotlight: "rounded-md ring-2 ring-blue-600/70 transition-all duration-300",
  muted: "text-slate-400",
};

export default function MinimalDemo() {
  const player = useStepPlayer({ total: FRAMES.length, autoPlay: true });

  const run = useCallback(() => {
    player.seek(0);
    player.setPlaying(true);
  }, [player]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") { e.preventDefault(); player.toggle(run); }
      else if (e.key === "ArrowRight") { e.preventDefault(); player.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); player.prev(); }
      else if (e.key === "Enter") { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, run]);

  const frame = player.index >= 0 ? Math.min(player.index, FRAMES.length - 1) : 0;
  const cur = FRAMES[frame];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-zinc-500 hover:text-zinc-900 transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-blue-600 mb-2">
          Demo - Minimal Player
        </p>
        <h1 className="text-2xl font-bold mb-4">TCP three-way handshake</h1>
        <p className="text-[13px] text-zinc-600 leading-relaxed mb-8">
          The smallest usable stepwise demo: a player bar driving a synthetic trace
          through the TCP lifecycle. No chapters, no tour, no glossary - just the
          sequence and its scrubber. This is the light-theme variant, proving the
          theme is injected rather than baked in: every library color comes from
          the LIGHT_THEME object below.
        </p>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 mb-4 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            {cur.state.map((s, i) => (
              <span
                key={i}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors duration-200 ${STATE_COLORS[s] ?? "text-zinc-500"}`}
                style={{ borderColor: "currentColor" }}
              >
                {s}
              </span>
            ))}
          </div>
          <p className="text-[12px] text-zinc-700 leading-relaxed">{cur.detail}</p>
        </div>

        <PlayerBar
          player={player}
          toneAt={(i) => FRAMES[i]?.tone ?? "neutral"}
          titleAt={(i) => FRAMES[i]?.label ?? `frame ${i + 1}`}
          onEmpty={run}
          emptyHint="press play"
          theme={LIGHT_THEME}
          className="border border-zinc-200 rounded-xl bg-white p-2 mb-4 shadow-sm"
          labels={{
            previous: "Previous frame",
            play: "Play handshake",
            pause: "Pause",
            replay: "Replay handshake",
            next: "Next frame",
          }}
        />

        <p className="text-[11px] font-mono text-zinc-400 text-center">
          {cur.label} - space/arrows to control
        </p>
      </div>
    </main>
  );
}