"use client";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../cn";
import { canAnswer } from "../core";
import type { StepwiseStep } from "../types";
import type { PromptsRun } from "../use-prompts";
import { useExplainer, usePromptsToggle } from "./explainer";

// The prompt parts. The state lives in the provider (the run is an option of
// the simulation it plays); these only draw it. Both render nothing without
// prompts in the definition, so a layout can include them unconditionally.

/** `explain` is the author's: drawn when it is something React can draw. */
const drawable = (x: unknown): x is ReactNode =>
  typeof x === "string" || typeof x === "number" || isValidElement(x);

/**
 * EXPERIMENTAL. The question on the playhead. By default: the question
 * (children, default "What happens next?"), one radio per option, Check for a
 * judged prompt (an unjudged one is answered by the pick), the feedback, the
 * tries left, then the reveal (the right answer, `explain`) and Continue once
 * it settles. `render` replaces all of it and receives the run. Renders
 * nothing off a prompt, and while playback moves on past a settled one.
 */
export function Prompt({
  children,
  render,
  className,
}: {
  children?: ReactNode;
  render?: (run: PromptsRun<StepwiseStep, string>) => ReactNode;
  className?: string;
}): ReactElement | null {
  const { prompts: run, predict, theme } = useExplainer();
  if (!run?.active || !predict) return null;
  const { entry } = run.active;
  if (entry.settled && run.player.playing) return null;
  if (render) return <>{render(run)}</>;
  const { options, guess, setGuess, check, feedback } = predict;
  const open = canAnswer(entry) && run.status !== "pending";
  const picked = entry.judged ? guess : (entry.attempts[entry.attempts.length - 1] ?? null);
  const button = (variant: "ghost" | "outline" | "primary") =>
    cn(theme.buttonBase, theme.buttonVariants[variant], "h-7 px-2.5 text-xs disabled:opacity-40");
  const revealed = run.revealed;
  const answerLabel =
    revealed?.answer === undefined ? undefined : (options.find((o) => o.value === revealed.answer)?.label ?? revealed.answer);
  const triesLeft = entry.judged && !entry.settled && Number.isFinite(run.retriesLeft) ? run.retriesLeft : 0;
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
            aria-checked={picked === o.value}
            disabled={!open}
            onClick={() => (entry.judged ? setGuess(o.value) : run.respond(o.value))}
            className={button(picked === o.value ? "primary" : "outline")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {entry.judged && !entry.settled && (
          <button type="button" onClick={check} disabled={!open} className={button("primary")}>
            Check
          </button>
        )}
        {entry.settled && (
          <button type="button" onClick={run.proceed} className={button("outline")}>
            Continue
          </button>
        )}
        {triesLeft > 0 && (
          <span className={cn("text-xs", theme.muted)}>
            {triesLeft === 1 ? "1 try left" : `${triesLeft} tries left`}
          </span>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-foreground/85">
        {feedback}
      </p>
      {revealed && (answerLabel !== undefined || drawable(revealed.explain)) && (
        <div data-reveal="" className="text-xs text-foreground/85">
          {answerLabel !== undefined && <div>Answer: {answerLabel}</div>}
          {drawable(revealed.explain) && <div>{revealed.explain}</div>}
        </div>
      )}
    </div>
  );
}

/** The question at a checkpoint: `Prompt`, kept one release under predict mode's name. */
export const Predict = Prompt;

/**
 * Turns overlay prompts (predict mode) on and off. Renders nothing when there
 * is nothing to toggle (no overlay prompts, or `promptsEnabled` set); disabled
 * once an answer counts, until restart (turning prompts off is an escape too).
 */
export function PredictToggle({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}): ReactElement | null {
  const { prompts, theme } = useExplainer();
  const toggle = usePromptsToggle();
  if (!prompts || !toggle) return null;
  const { enabled, setEnabled } = prompts;
  return (
    <button
      data-stepwise=""
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={!prompts.canToggle}
      onClick={() => setEnabled(!enabled)}
      className={cn(
        theme.buttonBase,
        theme.buttonVariants[enabled ? "primary" : "outline"],
        "h-7 self-start px-2.5 text-xs disabled:opacity-40",
        className
      )}
    >
      {children ?? "Predict mode"}
    </button>
  );
}
