"use client";

import { useState } from "react";
import { useSimulation, PlayerBar } from "@sphynxoid/stepwise";
import { insertionSort } from "./simulation";
import { useSiteTheme } from "../../theme-provider"; // demo-only

const DEFAULT = [4, 9, 3, 7, 1];

export function LinkedSort() {
  const { theme } = useSiteTheme(); // demo-only
  const [input, setInput] = useState<readonly number[]>(DEFAULT);
  const [copied, setCopied] = useState(false);
  const sim = useSimulation(insertionSort, input, {
    // Both live in the URL fragment: #links.frame=6&links.in=4.9.3.7.1
    // (one page can hold several players, so each gets its own keys).
    syncHash: "links.frame",
    syncInput: {
      key: "links.in",
      serialize: (a) => a.join("."),
      parse: (s) => {
        const a = s.split(".").map(Number);
        return a.length > 1 && a.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) ? a : null;
      },
      onRestore: setInput, // a link's input is handed back to you on load
    },
  });
  const step = sim.step!;
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  };
  return (
    <figure>
      <div className="flex h-20 items-end gap-2">
        {step.arr.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInput(input.map((x, j) => (j === i ? (x % 9) + 1 : x)))}
            aria-label={`Bar ${i + 1}: ${v}. Click to change it.`}
            className={`w-9 rounded-sm transition-all duration-300 ${i === step.at ? "bg-accent" : "bg-primary/70"}`}
            style={{ height: `${v * 11}%` }}
          />
        ))}
      </div>
      <p className="my-3 text-sm">{step.label}</p>
      <PlayerBar
        player={sim.player}
        toneAt={sim.toneAt}
        titleAt={sim.titleAt}
        theme={theme} // demo-only
      />
      <button type="button" onClick={copy} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/50">
        {copied ? "Copied: open it in a new tab" : "Copy a link to this exact frame"}
      </button>
    </figure>
  );
}
