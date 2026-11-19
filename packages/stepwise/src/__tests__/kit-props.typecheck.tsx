// Type-level tests for the explainer components' props. Not a vitest file
// (vitest does not typecheck): it is checked by `npx tsc --noEmit -p .` in
// packages/stepwise, where every `@ts-expect-error` below must still be an
// error, or tsc fails with "Unused '@ts-expect-error' directive".

import type { ReactElement } from "react";
import { defineExplainer } from "../core";
import type { ChoiceOption, ExplainerChoose, Simulation, WalkSimulation, WalkStep } from "../core";
import { createExplainer } from "../kit";
import type { ExplainerApi } from "../kit";
import type { PrecomputedTrace } from "../index";
import { precomputed } from "../kit/mdx";
import { defaultTheme } from "../theme";

type Step = { key: string; tone: "neutral"; label: string; n: number };
type Input = { arr: number[]; target: number; id: number };

const sim: Simulation<Input, Step> = function* ({ target }) {
  yield { key: "a", tone: "neutral", label: "a", n: target };
};
const def = defineExplainer({ simulation: sim, input: { default: { arr: [1, 2], target: 2, id: 7 } } });
const View = () => null;

const Client = createExplainer({ definition: def, view: View });
const Server = precomputed(def, Client);

const counter = defineExplainer({ simulation: sim as unknown as Simulation<number, Step>, input: { default: 3 } });
const Counter = createExplainer({ definition: counter, view: View });

// A recorded walkthrough with no input: no `input` section, the input is null.
const walkthrough = defineExplainer({
  simulation: function* () {
    yield { key: "a", tone: "neutral" as const, label: "a", n: 0 };
  },
});
const nullInput: null = walkthrough.input.default;
const Walkthrough = createExplainer({ definition: walkthrough, view: View });
const WalkthroughServer = precomputed(walkthrough, Walkthrough);
// A simulation that reads a real input still has to declare one.
// @ts-expect-error: input is required when the simulation takes one
defineExplainer({ simulation: sim });

// An input typed with an index signature has no field props either, and
// reserved props keep their own types.
const dict = defineExplainer({ simulation: sim as unknown as Simulation<Record<string, never>, Step>, input: { default: {} } });
const Dict = createExplainer({ definition: dict, view: View });
const DictServer = precomputed(dict, Dict);

export function ok(): ReactElement {
  return (
    <>
      <Client id="a" target={5} arr={[1, 2, 3]} predict autoPlay keys={false} link={false} className="x" />
      <Client input={{ arr: [1], target: 1, id: 2 }} />
      <Server id="b" target={5} />
      <Server />
      <Counter input={4} />
      <Walkthrough id="w" link={false} />
      <WalkthroughServer id="w" predict={false} />
      <Dict id="d" autoPlay theme={defaultTheme} />
      <DictServer id="d" theme={defaultTheme} />
    </>
  );
}

export const nullDefault = nullInput;

export function wrong(): ReactElement {
  return (
    <>
      {/* @ts-expect-error: id is the hash namespace, a string */}
      <Client id={5} />
      {/* @ts-expect-error: id is the hash namespace, a string (server wrapper) */}
      <Server id={5} />
      {/* @ts-expect-error: predict is a boolean */}
      <Server predict="no" />
      {/* @ts-expect-error: theme is a StepwiseTheme */}
      <Server theme={1} />
      {/* @ts-expect-error: misspelled autoPlay */}
      <Client autoplay />
      {/* @ts-expect-error: misspelled autoPlay (server wrapper) */}
      <Server autoplay />
      {/* @ts-expect-error: target is a number */}
      <Server target="5" />
      {/* @ts-expect-error: arr is number[] */}
      <Client arr={["a"]} />
      {/* @ts-expect-error: not a field of the input */}
      <Server depth={3} />
      {/* @ts-expect-error: a primitive input has no field props */}
      <Counter n={3} />
      {/* @ts-expect-error: an input-less explainer has no field props */}
      <Walkthrough report="checkout" />
      {/* @ts-expect-error: theme keeps its type on an index-signature input */}
      <Dict theme={1} />
      {/* @ts-expect-error: the wrapper supplies trace itself */}
      <Server trace={{ input: { arr: [], target: 0, id: 0 }, seed: 0, steps: [] }} />
    </>
  );
}

// The root entry names the shape of useSimulation's `initialTrace`.
export const rootTrace: PrecomputedTrace<number, Step> = { input: 1, seed: 0, steps: [] };

// The api reports a failed or capped run.
export function report(api: ExplainerApi<Input, Step>): string {
  const truncated: boolean = api.truncated;
  const error: unknown = api.error;
  return `${truncated} ${String(error)}`;
}

// ─── Walk explainers ─────────────────────────────────────────────────────────

type Move = "left" | "right";
type WStep = WalkStep & { key: string; tone: "neutral"; label: string };
const maze: WalkSimulation<{ depth: number }, WStep, Move> = function* ({ depth }) {
  const m = yield { key: "fork", tone: "neutral", label: `depth ${depth}`, await: true };
  yield { key: `went.${m}`, tone: "neutral", label: String(m) };
};
const walkDef = defineExplainer({ walk: maze, input: { default: { depth: 2 } }, choose: { options: ["left", "right"] } });
const Maze = createExplainer({ definition: walkDef, view: View });
const MazeServer = precomputed(walkDef, Maze);
// The choice type is the walk's: it comes through on the definition.
export const moves: (step: WStep) => readonly ChoiceOption<Move>[] = () => ["left", { value: "right", label: "Right" }];
export const walkChoose: ExplainerChoose<WStep, Move> = walkDef.choose;

export const walkRender = (
  <>
    <Maze depth={4} />
    <MazeServer depth={4} id="m" />
  </>
);

// @ts-expect-error: an option the walk can't take
defineExplainer({ walk: maze, input: { default: { depth: 2 } }, choose: { options: ["up"] } });
// @ts-expect-error: a walk has no predict (the choices are the question)
defineExplainer({ walk: maze, input: { default: { depth: 2 } }, choose: { options: ["left"] }, predict: { at: () => true, options: [], truth: () => undefined } });
// @ts-expect-error: a simulation and a walk together
defineExplainer({ simulation: sim, walk: maze, input: { default: { arr: [], target: 0, id: 0 } }, choose: { options: ["left"] } });
// @ts-expect-error: a walk needs its choices
defineExplainer({ walk: maze, input: { default: { depth: 2 } } });
