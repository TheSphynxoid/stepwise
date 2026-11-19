"use client";

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import { defaultTheme, type StepwiseTheme } from "../theme";
import type { StepTone, StepwiseStep } from "../types";
import type { StepPlayer } from "../use-step-player";

// What the step parts (Narration, StepCode, ExplainerBar, EndNote) read: a
// step and a player, nothing explainer-specific. An explainer provides it
// for its own parts; a page around a plain useTrace / useSimulation /
// useWalk opens one with <StepParts source={...}> and uses the same parts.

/** Any TracePlayer fits (useTrace, useSimulation, useWalk return one). */
export interface StepPartsSource<S extends StepwiseStep = StepwiseStep> {
  step: S | undefined;
  player: StepPlayer;
  toneAt?: (i: number) => StepTone;
  titleAt?: (i: number) => string;
}

export interface StepPartsApi<S extends StepwiseStep = StepwiseStep> extends StepPartsSource<S> {
  theme: StepwiseTheme;
  /** ExplainerBar's layout when it is given none (a walk explainer sets "step"). */
  controls: "full" | "step";
}

const StepPartsContext = createContext<StepPartsApi | null>(null);

/**
 * Lets the step parts run around any player, outside an explainer.
 *
 *   const trace = useTrace(STEPS);
 *   <StepParts source={trace} theme={theme}>
 *     <MyView step={trace.step} />
 *     <Narration />
 *     <ExplainerBar />
 *   </StepParts>
 */
export function StepParts<S extends StepwiseStep>({
  source,
  theme = defaultTheme,
  controls = "full",
  children,
}: {
  source: StepPartsSource<S>;
  theme?: StepwiseTheme;
  /** The default layout for ExplainerBar inside (see PlayerBar's `controls`). */
  controls?: "full" | "step";
  children?: ReactNode;
}): ReactElement {
  const { step, player, toneAt, titleAt } = source;
  const value = useMemo<StepPartsApi>(
    () => ({ step, player, toneAt, titleAt, theme, controls }),
    [step, player, toneAt, titleAt, theme, controls]
  );
  return <StepPartsContext.Provider value={value}>{children}</StepPartsContext.Provider>;
}

/** The step and player the parts read: from <StepParts>, or the enclosing explainer. */
export function useStepParts<S extends StepwiseStep = StepwiseStep>(): StepPartsApi<S> {
  const api = useContext(StepPartsContext);
  if (!api) {
    throw new Error("Step parts (Narration, StepCode, ExplainerBar, EndNote) must be inside <Explainer> or <StepParts>.");
  }
  return api as unknown as StepPartsApi<S>;
}
