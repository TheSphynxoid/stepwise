// @sphynxoid/stepwise/experimental — APIs that may still change in a minor
// release. When one settles it moves to the main entry (and stays exported
// here as an alias for a while).
//
// Transitions: a trace becomes a graph. A walk is a simulation whose choice
// points (`await: true` steps) branch on the reader's answers; the path
// taken is still a plain array, so the scrubber, links and re-anchoring work
// unchanged. A walk is fully described by (simulation, input, seed, choices).
//
//   walk          — WalkSimulation / runWalk: replay a walk, purely
//   use-walk      — useWalk: useSimulation + choose(), anchor, lastChange,
//                   syncChoices (choices in the URL next to the input)
//   graph         — fromGraph: a declared automaton (nodes, edges, accept),
//                   runnable over a word and drawable
//   diff-traces   — diffTraces: what an edit changed between two runs
//
// The pure names (runWalk, fromGraph, diffTraces) are also in ./core, which
// is where this entry takes them from: one copy, callable on a server.

export { runWalk } from "./core";
export type { WalkResult, WalkRunOptions, WalkSimulation, WalkStep } from "./core";
export { useWalk } from "./use-walk";
export type { SyncChoicesOptions, WalkOptions, WalkPlayer } from "./use-walk";
export { fromGraph } from "./core";
export type { GraphEdge, GraphSimulation, GraphSpec, GraphStep, StepGraph } from "./core";
export { diffTraces, structuralEqual } from "./core";
export type { DiffTracesOptions, TraceDiff } from "./core";
