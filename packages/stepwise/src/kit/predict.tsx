"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";
import { useExplainer } from "./explainer";

// Predict mode's parts. The state lives in the provider (it has to: the
// checkpoints are an option of the simulation it runs); these only draw it.
// Both render nothing without a predict definition, so a layout can include
// them unconditionally.

/**
 * The question at a checkpoint: one radio per option, Check, then Continue
 * (after a pass) or Skip. Renders nothing unless playback is held. Children
 * are the question; the default is "What happens next?".
 */
export function Predict({ children, className }: { children?: ReactNode; className?: string }): ReactElement | null {
  const { predict, theme } = useExplainer();
  if (!predict?.held) return null;
  const { options, guess, setGuess, check, status, feedback, release } = predict;
  const button = (variant: "ghost" | "outline" | "primary") =>
    cn(theme.buttonBase, theme.buttonVariants[variant], "h-7 px-2.5 text-xs");
  return (
    <div data-stepwise="" className={cn(theme.surface, "flex flex-col gap-2 rounded-sm p-3", className)}>
      {/* A div, not a p: MDX wraps multi-line children in their own <p>. */}
      <div className="text-sm text-foreground/85">{children ?? "What happens next?"}</div>
      <div role="radiogroup" aria-label="Your prediction" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={guess === o.value}
            onClick={() => setGuess(o.value)}
            className={button(guess === o.value ? "primary" : "outline")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={check} className={button("primary")}>
          Check
        </button>
        {status === "pass" ? (
          <button type="button" onClick={release} className={button("outline")}>
            Continue
          </button>
        ) : (
          <button type="button" onClick={release} className={button("ghost")}>
            Skip
          </button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-foreground/85">
        {feedback}
      </p>
    </div>
  );
}

/** Turns predict mode on and off. Renders nothing without a predict definition. */
export function PredictToggle({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}): ReactElement | null {
  const { predict, theme } = useExplainer();
  if (!predict) return null;
  const { enabled, setEnabled } = predict;
  return (
    <button
      data-stepwise=""
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setEnabled(!enabled)}
      className={cn(
        theme.buttonBase,
        theme.buttonVariants[enabled ? "primary" : "outline"],
        "h-7 self-start px-2.5 text-xs",
        className
      )}
    >
      {children ?? "Predict mode"}
    </button>
  );
}
