// Type-level tests for the explainer components' props. Not a vitest file
// (vitest does not typecheck): it is checked by `npx tsc --noEmit -p .` in
// packages/stepwise, where every `@ts-expect-error` below must still be an
// error, or tsc fails with "Unused '@ts-expect-error' directive".

import type { ReactElement } from "react";
import { defineExplainer } from "../core";
import type { Simulation } from "../core";
import { createExplainer } from "../kit";
import type { ExplainerApi } from "../kit";
import type { PrecomputedTrace } from "../index";
import { precomputed } from "../kit/mdx";

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

export function ok(): ReactElement {
  return (
    <>
      <Client id="a" target={5} arr={[1, 2, 3]} predict autoPlay keys={false} link={false} className="x" />
      <Client input={{ arr: [1], target: 1, id: 2 }} />
      <Server id="b" target={5} />
      <Server />
      <Counter input={4} />
    </>
  );
}

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
