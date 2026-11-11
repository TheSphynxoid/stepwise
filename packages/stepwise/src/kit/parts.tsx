"use client";

import { createElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../cn";
import { CodeBlock, PlayerBar } from "../components";
import { useExplainer, useExplainerView } from "./explainer";

// The explainer's parts: each reads the provider and renders one thing.
// Stage takes no props, the others a className (and EndNote's prose), so
// they read the same in TSX and MDX. Every root sets data-stepwise for the
// precompiled stylesheet.

/** Renders the explainer's view. */
export function Stage(): ReactElement {
  const view = useExplainerView();
  return <div data-stepwise="">{createElement(view)}</div>;
}

/** The current step's label, announced to screen readers as it changes. */
export function Narration({ className }: { className?: string }): ReactElement {
  const { step } = useExplainer();
  return (
    <p data-stepwise="" aria-live="polite" className={cn("min-h-5 text-sm text-foreground/85", className)}>
      {step?.label ?? ""}
    </p>
  );
}

/** The current step's `code`, or nothing when the step has none. */
export function StepCode({ className }: { className?: string }): ReactElement | null {
  const { step, theme } = useExplainer();
  if (!step?.code) return null;
  return <CodeBlock lines={step.code} theme={theme} className={className} />;
}

/** PlayerBar for the explainer's player; play on an empty bar starts it. */
export function ExplainerBar({ className }: { className?: string }): ReactElement {
  const { sim, theme } = useExplainer();
  return (
    <PlayerBar
      player={sim.player}
      toneAt={sim.toneAt}
      titleAt={sim.titleAt}
      onEmpty={sim.player.start}
      theme={theme}
      className={className}
    />
  );
}

/** Shown once playback has run to the end on its own. */
export function EndNote({ children, className }: { children?: ReactNode; className?: string }): ReactElement | null {
  const { sim, theme } = useExplainer();
  if (!sim.player.ended) return null;
  // A div, not a p: MDX wraps multi-line children in their own <p>.
  return (
    <div data-stepwise="" role="status" className={cn("text-xs font-mono", theme.muted, className)}>
      {children ?? "End of the run. Play to replay."}
    </div>
  );
}
