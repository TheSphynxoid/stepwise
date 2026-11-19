import { defineExplainer, fromGraph, type WalkSimulation, type WalkStep } from "@sphynxoid/stepwise/core";
import { LIFECYCLE_SHIPPED, LIFECYCLE_SPEC, LIFE_ACTIONS, LIFE_STATES, type LifeAction, type LifeState } from "./driftwood";

// Chapter 5: state transitions. The booking lifecycle is declared twice as
// a graph (spec and shipped); `fromGraph` gives each a transition function
// and the spec a drawable graph. The walk lets the reader play the tester:
// at every state, choose an action. Each choice is a choice point, so the
// path is (choices) and replays exactly from a link.

const nodes = Object.fromEntries(LIFE_STATES.map((s) => [s, { label: s }])) as Record<LifeState, { label: string }>;

// No type arguments: actions are inferred from the edges, states from `nodes`.
export const specGraph = fromGraph({ start: "draft", nodes, edges: LIFECYCLE_SPEC });
export const shippedGraph = fromGraph({ start: "draft", nodes, edges: LIFECYCLE_SHIPPED });

/** Tries the reader may make before the walk ends. */
export const MAX_ACTIONS = 12;
export const TERMINAL: readonly LifeState[] = ["cancelled", "refunded"];

export type Attempt = { from: LifeState; on: LifeAction; spec: LifeState | null; shipped: LifeState | null };
export type LifeStep = WalkStep & {
  key: string;
  state: LifeState;
  /** What the last action did: moved, was refused by both, or exposed a bug. */
  result: "start" | "moved" | "refused" | "bug" | "end";
  /** Every attempt so far, in order. */
  log: Attempt[];
  explain: string;
};

const EXPLAIN = {
  start:
    "State transition testing: list the states, and for each one try every action, including the ones that shouldn't work. Valid transitions check the happy paths; invalid ones are where the bugs hide.",
  moved: "A valid transition: the spec allows it, and the shipped build did it. One more edge of the diagram covered.",
  refused: "An invalid transition, correctly refused. Testing what must NOT happen is half of state testing; keep trying the others from here.",
  bug: "The shipped build took a transition the spec doesn't have: refunding a booking that was never paid. Money out, none in. This is the classic state bug, and only a negative test finds it.",
  end: "A final state: nothing more can happen to this booking. Scrub back to an earlier choice and pick something else; the walk replays from there.",
};

export const lifecycleWalk: WalkSimulation<null, LifeStep, LifeAction> = function* () {
  let state: LifeState = "draft";
  const log: Attempt[] = [];
  let action: LifeAction | undefined = yield {
    key: "start",
    tone: "neutral",
    label: "A new booking, in draft. Pick an action to try.",
    state,
    result: "start",
    log: [],
    explain: EXPLAIN.start,
    await: true,
  };
  for (let n = 1; n <= MAX_ACTIONS && action; n++) {
    const spec = specGraph.delta(state, action);
    const shipped = shippedGraph.delta(state, action);
    log.push({ from: state, on: action, spec, shipped });
    if (spec === null && shipped !== null) {
      yield {
        key: `found.${n}`,
        tone: "bad",
        label: `Bug: "${action}" from ${state} went to ${shipped}. The spec has no such transition.`,
        state: shipped,
        result: "bug",
        log: [...log],
        explain: EXPLAIN.bug,
      };
      return;
    }
    const moved = spec !== null;
    if (moved) state = spec;
    const end = TERMINAL.includes(state) || n === MAX_ACTIONS;
    action = yield {
      key: `${n}.${state}.${moved ? "moved" : "refused"}`,
      tone: moved ? "good" : "accent",
      label: moved ? `${log[log.length - 1].from} → ${state} via "${log[log.length - 1].on}". Allowed.` : `"${log[log.length - 1].on}" in ${state}: refused, as it should be.`,
      state,
      result: end ? "end" : moved ? "moved" : "refused",
      log: [...log],
      explain: end ? EXPLAIN.end : moved ? EXPLAIN.moved : EXPLAIN.refused,
      await: !end,
    };
  }
};

/**
 * The chapter's explainer: the walk, and the five actions as its choices
 * (labelled as typed, lowercase, like the code). Linked as #life.path=…
 * with `id="life"`; a linked action that isn't one of these is rejected.
 */
export const lifecycle = defineExplainer({
  name: "lifecycle",
  walk: lifecycleWalk,
  choose: { options: LIFE_ACTIONS.map((a) => ({ value: a, label: a })) },
});
