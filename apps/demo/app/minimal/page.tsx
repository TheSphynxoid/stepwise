"use client";

import { PlayerBar, StepScrubber, useStepPlayer, usePrefersReducedMotion } from "@sphynx/stepwise";

const PHASES = [
  { label: "Connect", code: ["tcp.connect(host, port)"] },
  { label: "Handshake", code: ["tls.handshake()"] },
  { label: "Request", code: ["send(request)"] },
  { label: "Response", code: ["receive(response)"] },
  { label: "Close", code: ["tcp.close()"] },
];

export default function MinimalDemo() {
  const reduced = usePrefersReducedMotion();
  const player = useStepPlayer({ total: PHASES.length });

  const active = PHASES[Math.max(0, Math.min(player.index, PHASES.length - 1))];

  return (
    <main className="min-h-screen bg-white text-gray-900 pt-24 pb-16">
      <div className="max-w-md mx-auto px-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-blue-600 mb-2">Demo — Minimal Player</p>
        <h1 className="text-xl font-bold mb-4">TCP connection lifecycle</h1>

        <div className="border border-gray-200 rounded-md bg-gray-50 p-4 mb-4">
          <PlayerBar
            player={player}
            toneAt={(i) => (i <= player.index ? "good" : "neutral")}
            emptyHint="press Play"
            className="p-0"
          />
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-4">
          <p className="text-sm font-semibold mb-1">{active.label}</p>
          <pre className="text-[11px] font-mono text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto">
            {active.code.join("\n")}
          </pre>
        </div>

        <p className="text-[10px] font-mono text-gray-400 mt-4">
          Light theme — the default theme is injectable. No chrome, no domain logic.
        </p>
      </div>
    </main>
  );
}
