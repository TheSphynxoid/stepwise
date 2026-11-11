"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { TONE_CHIP_CLASS } from "@sphynxoid/stepwise";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { binarySearch, MAX_VALUE, MIN_VALUE, type SearchInput, type SearchStep } from "./binary-search.explainer";

// The only hand-written UI of the explainer: draw one frame. The shell (the
// player, the hash links, the keyboard, predict mode, the layout) comes from
// the kit; this reads the current step and the input from useExplainer().

function SearchView() {
  const { step, input, setInput } = useExplainer<SearchInput, SearchStep>();
  // The box holds a draft, so a half-typed number is never forced back; every
  // draft that is a valid target is applied at once (typing and the spinner
  // arrows alike), with no Enter and no blur needed.
  const [draft, setDraft] = useState(String(input.target));
  useEffect(() => {
    // The target changed from outside the box (a restored link): show it.
    setDraft((d) => (Number(d) === input.target ? d : String(input.target)));
  }, [input.target]);
  if (!step) return null;
  const edit = (raw: string) => {
    setDraft(raw);
    const target = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(target) || target < MIN_VALUE || target > MAX_VALUE) return;
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
        <label className="inline-flex items-center gap-2">
          Target
          <input
            type="number"
            min={MIN_VALUE}
            max={MAX_VALUE}
            value={draft}
            onChange={(e) => edit(e.currentTarget.value)}
            onBlur={() => setDraft(String(input.target))}
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
