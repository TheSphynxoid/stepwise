"use client";

import { createElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../cn";
import { CodeBlock, PlayerBar } from "../components";
import { useExplainer, useExplainerView } from "./explainer";
import { Prompt } from "./predict";
import { useStepParts } from "./step-parts";

// The explainer's parts: each reads a provider and renders one thing.
// Stage takes no props, the others a className (and EndNote's prose), so
// they read the same in TSX and MDX. Stage needs an explainer; the step parts
// (Narration, StepCode, ExplainerBar, EndNote) only a step and a player, so
// they also run inside <StepParts> around a plain player. Every root sets
// data-stepwise for the precompiled stylesheet.

/** Renders the explainer's view. */
export function Stage(): ReactElement {
  const view = useExplainerView();
  return <div data-stepwise="">{createElement(view)}</div>;
}

/** The current step's label, announced to screen readers as it changes. */
export function Narration({ className }: { className?: string }): ReactElement {
  const { step } = useStepParts();
  return (
    <p data-stepwise="" aria-live="polite" className={cn("min-h-5 text-sm text-foreground/85", className)}>
      {step?.label ?? ""}
    </p>
  );
}

/** The current step's `code`, or nothing when the step has none. */
export function StepCode({ className }: { className?: string }): ReactElement | null {
  const { step, theme } = useStepParts();
  if (!step?.code) return null;
  return <CodeBlock lines={step.code} theme={theme} className={className} />;
}

/**
 * PlayerBar for the explainer's player; play on an empty bar starts it.
 * `controls="step"` drops Play and puts the arrows on either side of the
 * scrubber: the default for a walk, where Play would only run to the next
 * choice.
 */
export function ExplainerBar({ className, controls }: { className?: string; controls?: "full" | "step" }): ReactElement {
  const { player, toneAt, titleAt, theme, controls: fallback } = useStepParts();
  return (
    <PlayerBar
      controls={controls ?? fallback}
      player={player}
      toneAt={toneAt}
      titleAt={titleAt}
      onEmpty={player.start}
      theme={theme}
      className={className}
    />
  );
}

/** Shown once playback has run to the end on its own. */
export function EndNote({ children, className }: { children?: ReactNode; className?: string }): ReactElement | null {
  const { player, theme } = useStepParts();
  if (!player.ended) return null;
  // A div, not a p: MDX wraps multi-line children in their own <p>.
  return (
    <div data-stepwise="" role="status" className={cn("text-xs font-mono", theme.muted, className)}>
      {children ?? "End of the run. Play to replay."}
    </div>
  );
}

/**
 * A walk's options at a choice point: one button per option, the answer
 * given there pressed. Off a choice point the buttons stay (disabled), so
 * the layout doesn't jump; renders nothing for a simulation. Children are a
 * visible prompt ("Try"); `label` names the group for screen readers.
 * On an explainer that runs on prompts (a definition with `prompts`) it is
 * `Prompt`, with the children (else `label`) as the question.
 */
export function Choices({
  children,
  label = "Choose",
  className,
}: {
  children?: ReactNode;
  label?: string;
  className?: string;
}): ReactElement | null {
  const { walk, sim, theme, prompts } = useExplainer();
  if (prompts) return <Prompt className={className}>{children ?? label}</Prompt>;
  if (!walk || walk.options.length === 0) return null;
  const answered = walk.asking ? walk.choiceAt(sim.frame) : undefined;
  return (
    <div data-stepwise="" role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children !== undefined && <span className="mr-1 text-xs">{children}</span>}
      {walk.options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={!walk.asking}
          aria-pressed={answered === o.value}
          onClick={() => walk.choose(o.value)}
          className={cn(
            theme.buttonBase,
            theme.buttonVariants[answered === o.value ? "primary" : "outline"],
            "h-7 px-2.5 text-xs disabled:opacity-40"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
