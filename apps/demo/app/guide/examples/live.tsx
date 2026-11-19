"use client";

import { useState } from "react";
import { useTrace, PlayerBar, type StepTone } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

type Event = { key: string; tone: StepTone; label: string };

const KINDS: { tone: StepTone; label: string }[] = [
  { tone: "neutral", label: "request received" },
  { tone: "write", label: "row written" },
  { tone: "good", label: "response sent" },
  { tone: "bad", label: "retry after timeout" },
];

let n = 0;
const nextEvent = (): Event => {
  const kind = KINDS[n % KINDS.length];
  n++;
  return { key: `e${n}`, tone: kind.tone, label: `#${n} ${kind.label}` };
};

export function LiveFeed() {
  const { theme } = useSiteTheme(); // demo-only
  const [events, setEvents] = useState<Event[]>(() => [nextEvent(), nextEvent()]);
  // follow: while you're at the newest event, new ones play in as they come.
  // Scrub back to read an older one and the feed leaves you there.
  const { step, player, toneAt, titleAt } = useTrace(events, { autoPlay: true, follow: true });
  return (
    <figure>
      <p className="mb-3 font-mono text-sm">{step?.label ?? "waiting for events"}</p>
      <PlayerBar
        live
        player={player}
        toneAt={toneAt}
        titleAt={titleAt}
        theme={theme} // demo-only
      />
      <button
        type="button"
        onClick={() => setEvents((e) => [...e, nextEvent(), nextEvent(), nextEvent()])}
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/50"
      >
        Three new events arrive
      </button>
    </figure>
  );
}
