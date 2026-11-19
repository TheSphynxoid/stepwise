// @sphynxoid/stepwise/core — the pure half of the library: traces,
// simulations, walks, re-anchoring, alignment, verdicts and the schema.
//
// No React at runtime and no "use client": safe to call from a React Server
// Component, a route handler or a build script. This is the ONLY copy of the
// pure code. The client bundles (the root entry, ./experimental) import it at
// runtime instead of carrying their own, so client modules must reach pure
// code through this file, never through the individual modules (a direct
// import would bundle a second copy into the client chunk).
//
//   simulation    — createRng, runSimulation
//   create-trace  — createTrace
//   walk / graph  — runWalk, fromGraph (experimental on the client side)
//   walk-session  — createWalkSession: a walk run that continues forward
//   reanchor      — reanchor, stepKey, sameSteps: the "stay on the same step" rule
//   align-tracks  — alignTracks: comparison-mode alignment table
//   diff-traces   — diffTraces, structuralEqual
//   flatten       — flattenChapters
//   evaluate      — toVerdict, pass, fail, pending
//   prompts       — the prompt answer record: reachEntry, applyAnswer, scoreOf
//   explainer     — defineExplainer, precompute: a definition run to a JSON trace
//   types         — the trace / tour / chapter schema and ports

export type {
  Chapter,
  Evaluator,
  EvaluatorResult,
  PlayerEngine,
  PlayerEngineApi,
  PlayerEngineHandle,
  ShortcutItem,
  StepTone,
  StepwiseStep,
  TourContext,
  TourDriver,
  TourStepInput,
  Verdict,
  VerdictStatus,
} from "./types";
export { createRng, runSimulation } from "./simulation";
export type { Rng, Simulation, SimulationContext, SimulationResult, SimulationRunOptions } from "./simulation";
export { createTrace } from "./create-trace";
export type { TraceBuilder } from "./create-trace";
export { isChoicePoint, runWalk } from "./walk";
export type { WalkResult, WalkRunOptions, WalkSimulation, WalkStep } from "./walk";
export { createWalkSession } from "./walk-session";
export type { WalkSession, WalkSessionOptions } from "./walk-session";
export { fromGraph } from "./graph";
export type { GraphEdge, GraphSimulation, GraphSpec, GraphStep, StepGraph } from "./graph";
export { reanchor, sameSteps, stepKey } from "./reanchor";
export { alignTracks } from "./align-tracks";
export type { AlignedCell, AlignedRow, TrackKeyFn, Tracks } from "./align-tracks";
export { diffTraces, structuralEqual } from "./diff-traces";
export type { DiffTracesOptions, TraceDiff } from "./diff-traces";
export { flattenChapters } from "./flatten";
export type { FlatChapter } from "./flatten";
export { toVerdict, pass, fail, pending } from "./evaluate";
export {
  defineExplainer,
  precompute,
  resolveInput,
  normalizeOptions,
  assertJsonInput,
  EXPLAINER_PROP_NAMES,
} from "./explainer";
export type {
  AnyExplainerDefinition,
  ChoiceOption,
  ExplainerChoose,
  ExplainerDefinition,
  WalkExplainerDefinition,
  ExplainerInput,
  ExplainerPropName,
  FieldOverrides,
  ExplainerPredict,
  PrecomputedTrace,
  PredictOption,
} from "./explainer";
export {
  EMPTY_RECORD,
  reachEntry,
  canAnswer,
  applyAnswer,
  skipEntry,
  truncateAfter,
  retriesLeft,
  settledAnswer,
  scoreOf,
} from "./prompts";
export type {
  EntryStatus,
  Prompt,
  PromptContext,
  PromptEntry,
  PromptOption,
  PromptRecord,
  PromptScore,
  PromptSpec,
} from "./prompts";
