// stepwise — a small kit for interactive, narrated step visualizations.
//
// One primitive, applied at every scale: a clamped cursor over an ordered
// sequence (useSteps). Frames in a trace, chapters in a lesson, lessons in a
// notebook, and tour steps are the same thing at this layer; timers, tour
// effects, and scroll-tracking are policies the machines layer on top.
//
// Layers:
//   types.ts          — step/tone/tour/shortcut schema (the trace contract)
//                       + engine/driver ports for external integrations
//   use-steps         — THE core: clamped cursor, movement, boundary policy
//   use-step-player   — player policy: timer, speed, seek, deep-link hash
//   use-guided-tour   — tour policy: onEnter effects, driver show/hide
//   use-chapters      — chapter policy: scroll-tracked cursor, smooth goTo
//   use-global-keys   — global keyboard bindings with form-control guard
//   use-focus-trap    — dialog/tour focus containment
//   use-prefers-reduced-motion — motion preference gate
//   theme.ts          — injectable default styling for the styled components
//   components        — PlayerBar, StepScrubber, CodeBlock, ChapterNav,
//                       LessonPager, TourSpotlight, TourCard, ShortcutsDialog
//   adapters/         — optional integrations via the ports, imported from
//                       dedicated subpaths (NOT the root barrel — the barrel
//                       stays dependency-free so optional peers never become
//                       required imports):
//     @sphynx/stepwise/adapters/gsap       PlayerEngine driven by a GSAP tween
//     @sphynx/stepwise/adapters/driver-js  TourDriver backed by driver.js
//     @sphynx/stepwise/adapters/scroll     PlayerEngine driven by scroll progress
//
//   use-discoveries   — persisted discovery ledger + storage seam: pair with
//                       useGuidedTour for show-once tutorials and led
//                       discovery (auto-start the first undiscovered tour).
//
// Consumers own the domain: produce an array of steps (the trace) from their
// engine, then present it with the player; tours receive callbacks that drive
// the consumer's own state. The hooks are headless — the styled components
// ship with a default theme, injectable via `theme` and `labels` props.
//
//   const engine = useMemo(() => createGsapPlayerEngine({ total }), [total]);
//   const player = useStepPlayer({ total, engine, syncHash: "frame" });
//   const tour = useGuidedTour(steps, { driver: createDriverJsTourDriver() });

export type {
  Chapter,
  PlayerEngine,
  PlayerEngineApi,
  PlayerEngineHandle,
  ShortcutItem,
  StepTone,
  StepwiseStep,
  TourContext,
  TourDriver,
  TourStepInput,
} from "./types";
export { useSteps } from "./use-steps";
export type { StepsCore, UseStepsOptions } from "./use-steps";
export { useStepPlayer } from "./use-step-player";
export type { StepPlayer, StepPlayerOptions } from "./use-step-player";
export { useGuidedTour } from "./use-guided-tour";
export type { GuidedTour, GuidedTourOptions } from "./use-guided-tour";
export { useChapters, flattenChapters } from "./use-chapters";
export type { ChaptersApi } from "./use-chapters";
export type { FlatChapter } from "./flatten";
export { useGlobalKeys } from "./use-global-keys";
export type { GlobalKeysOptions, KeyMap } from "./use-global-keys";
export { useDiscoveries, localStorageStore, cookieStore, memoryStore } from "./use-discoveries";
export type { DiscoveryStore, Discoveries, DiscoveriesOptions } from "./use-discoveries";
export { useFocusTrap } from "./use-focus-trap";
export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
export { GlossaryProvider, Term, GlossaryAppendix } from "./glossary";
export type { GlossaryEntry } from "./glossary";
export { defaultTheme } from "./theme";
export type { StepwiseTheme } from "./theme";
export {
  ChapterNav,
  CodeBlock,
  LessonPager,
  PlayerBar,
  ShortcutsDialog,
  StepScrubber,
  TONE_CHIP_CLASS,
  TONE_SEGMENT_CLASS,
  TourCard,
  TourSpotlight,
} from "./components";
