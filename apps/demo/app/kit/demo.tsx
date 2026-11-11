"use client";

import type { ComponentProps } from "react";
import { TONE_CHIP_CLASS } from "@sphynxoid/stepwise";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { binarySearch, MAX_VALUE, MIN_VALUE, type SearchInput, type SearchStep } from "./binary-search.explainer";

// The only hand-written UI of the explainer: draw one frame. The shell (the
// player, the hash links, the keyboard, predict mode, the layout) comes from
// the kit; this reads the current step and the input from useExplainer().

function SearchView() {
  const { step, input, setInput } = useExplainer<SearchInput, SearchStep>();
  if (!step) return null;
  const commit = (raw: string) => {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) return;
    const target = Math.max(MIN_VALUE, Math.min(MAX_VALUE, value));
    if (target !== input.target) setInput((prev) => ({ ...prev, target }));
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[step.tone]}`}>
          {step.kind}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          key {step.key} · {step.cmp} comparisons
        </span>
      </div>

      <div className="flex gap-1.5" role="img" aria-label={`Array ${step.arr.join(", ")}: ${step.label}`}>
        {step.arr.map((v, i) => {
          const outside = i < step.lo || i > step.hi;
          const probe = i === step.mid;
          return (
            <div
              key={i}
              className={`flex-1 min-w-0 flex flex-col items-center rounded-md border py-2 font-mono transition-all duration-300 ${
                probe
                  ? step.kind === "found"
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-primary bg-primary/15 text-primary"
                  : outside
                    ? "border-border/40 text-foreground/25"
                    : "border-border bg-background/40"
              }`}
            >
              <span className="text-[14px] font-semibold">{v}</span>
              <span className="text-[9px] text-muted-foreground">{i}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px] font-mono text-foreground/60">
        {/* Keyed by the target, so a restored link or a reset redraws the draft. */}
        <label className="inline-flex items-center gap-2">
          Target
          <input
            key={input.target}
            type="number"
            min={MIN_VALUE}
            max={MAX_VALUE}
            defaultValue={input.target}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(e.currentTarget.value);
            }}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-foreground"
          />
        </label>
        <span className="ml-auto">
          lo {step.lo} · hi {step.hi}
        </span>
      </div>
    </div>
  );
}

const BinarySearchExplainer = createExplainer({ definition: binarySearch, view: SearchView });

/**
 * The client binding the server page precomputes for. A thin wrapper only
 * because the site theme lives in a client context: the page passes plain
 * data, and the theme follows the light/dark toggle from here.
 */
export function BinarySearchClient(props: ComponentProps<typeof BinarySearchExplainer>) {
  const { theme } = useSiteTheme();
  return <BinarySearchExplainer {...props} theme={theme} />;
}
