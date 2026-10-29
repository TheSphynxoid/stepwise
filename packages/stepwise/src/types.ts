import type { ReactNode } from "react";

// Presentation schema shared by every stepwise visualizer. Domain engines
// produce steps conforming to these types; the player and tour machinery
// stay generic over them.

export type StepTone = "neutral" | "accent" | "good" | "bad" | "write" | "idle";

export interface StepwiseStep {
  tone: StepTone;
  label: string;
  code?: string[];
  note?: string;
}

export interface TourStepInput {
  id?: string;
  title: string;
  body: ReactNode;
  target?: string;
  onEnter?: () => void;
  waitHint?: string;
  /**
   * Conditional step: when it returns false, the cursor never lands here —
   * arrival walks past it in the direction of travel. Evaluated on arrival
   * only (event-driven), not on every render.
   */
  when?: () => boolean;
  /**
   * Guard: while it returns false, `next()` is a no-op and the tour reports
   * `blocked` — "do this before continuing". Only restricts `next`;
   * goto/gotoId remain free (programmatic navigation).
   */
  gate?: () => boolean;
  /**
   * Edge override: advance to the step with this id instead of index+1.
   * Return null (or omit) for linear order. Enables branching and loops;
   * an edge from the last step keeps the tour alive instead of exiting.
   */
  next?: () => string | null;
}

export interface ShortcutItem {
  keys: string;
  action: string;
}

export interface Chapter {
  /** DOM id of the chapter's section element, or a stable id used by the app for routing. */
  id: string;
  label: string;
  hint?: string;
  /** Nested sub-chapters — rendered recursively, any depth. */
  children?: Chapter[];
  /**
   * Render the ordinal number chip in ChapterNav. Default true — set false
   * for appended, unnumbered chapters (glossaries, colophons, …).
   */
  numbered?: boolean;
}

// ── Player engines ───────────────────────────────────────────────────────────
// A PlayerEngine is an alternate frame source (GSAP timeline, scroll progress,
// …). The built-in engine is a timer; adapters live in ./adapters.

export interface PlayerEngineApi {
  /** Live frame count — read per tick; changes when a new timeline loads. */
  readonly total: number;
  /** Engine → player: the playhead advanced to `frame` (0 ≤ frame < total). */
  onFrame(frame: number): void;
  /** Engine → player: playback reached the end on its own; the player pauses. */
  onEnd(): void;
}

export interface PlayerEngineHandle {
  play(): void;
  pause(): void;
  seek(frame: number): void;
  setRate(rate: number): void;
  disconnect(): void;
}

export interface PlayerEngine {
  connect(api: PlayerEngineApi): PlayerEngineHandle;
}

// ── Tour drivers ─────────────────────────────────────────────────────────────
// A TourDriver is an alternate step presenter (driver.js, Shepherd, …). The
// built-in driver renders TourSpotlight + TourCard declaratively in the app;
// custom drivers are imperative and receive the step plus transition controls.
// State coupling is unchanged: the hook still fires onEnter per step.

export interface TourContext {
  index: number;
  total: number;
  next(): void;
  back(): void;
  end(): void;
}

export interface TourDriver {
  show(step: TourStepInput, ctx: TourContext): void;
  hide(): void;
}
