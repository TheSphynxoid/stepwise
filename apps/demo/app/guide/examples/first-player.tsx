"use client";

import { createTrace, useTrace, PlayerBar } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

// Built once, at module scope. Every step has a tone and a label; the rest
// (here `arr`) is your own data, typed, riding along on each step.
const frames = createTrace<{ arr: number[] }>()
  .step({ tone: "neutral", label: "Start: three numbers, out of order", arr: [3, 1, 2] })
  .step({ tone: "write", label: "Swap 3 and 1", arr: [1, 3, 2] })
  .step({ tone: "write", label: "Swap 3 and 2", arr: [1, 2, 3] })
  .step({ tone: "good", label: "Sorted", arr: [1, 2, 3] })
  .build();

export function FirstPlayer() {
  const { theme } = useSiteTheme(); // demo-only
  // `step` is the frame on screen (frame 0 before you press play).
  const { step, player, toneAt, titleAt } = useTrace(frames);
  return (
    <figure>
      <div className="flex h-24 items-end gap-2">
        {step!.arr.map((v) => (
          <div key={v} className="w-10 rounded-sm bg-primary/70 transition-all duration-300" style={{ height: `${v * 32}%` }} />
        ))}
      </div>
      <p className="my-3 text-sm">{step!.label}</p>
      <PlayerBar
        player={player}
        toneAt={toneAt}
        titleAt={titleAt}
        theme={theme} // demo-only
      />
    </figure>
  );
}
