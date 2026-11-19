// sorting-player.tsx: the client side. The view takes no props: it reads
// the explainer it sits in with useExplainer().
"use client";

import { type ComponentProps } from "react"; // demo-only
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { sorting, type Frame, type SortInput } from "./sorting.explainer";
import { useSiteTheme } from "../../../theme-provider"; // demo-only

function Bars() {
  const { step, input, setInput } = useExplainer<SortInput, Frame>();
  if (!step) return null;
  // Clicking a bar edits the input; the explainer re-runs and keeps its place.
  const bump = (i: number) => setInput({ arr: input.arr.map((v, j) => (j === i ? (v % 9) + 1 : v)) });
  return (
    <div className="flex h-24 items-end gap-2">
      {step.arr.map((v, i) => (
        <button
          key={i}
          type="button"
          onClick={() => bump(i)}
          aria-label={`Bar ${i + 1}: ${v}. Click to change it.`}
          className={`w-9 rounded-sm transition-all duration-300 ${step.pair?.includes(i) ? "bg-accent" : "bg-primary/70"}`}
          style={{ height: `${v * 11}%` }}
        />
      ))}
    </div>
  );
}

export const SortingClient = createExplainer({ definition: sorting, view: Bars });

// demo-only:start
// The site's light/dark theme lives in a client context, so this wrapper
// passes it in. Your app would pass `theme` once, or rely on styles.css.
export function ThemedSortingClient(props: ComponentProps<typeof SortingClient>) {
  const { theme } = useSiteTheme();
  return <SortingClient {...props} theme={theme} />;
}
// demo-only:end
