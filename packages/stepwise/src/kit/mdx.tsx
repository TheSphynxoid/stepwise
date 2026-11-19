// @sphynxoid/stepwise/kit/mdx — what an MDX host imports from a file that is
// not a client module: mdx-components.tsx, a server page, a layout. It runs
// anywhere (a server, a build script, the browser), hence the neutral name.
//
//   precomputed        — wraps a createExplainer component so the trace is
//                        computed where the page renders and shipped as JSON
//   stepwiseComponents — the flat parts as one map, to spread into
//                        mdx-components.tsx or a provider's `components`
//
// A plain module on purpose: no "use client". A server file cannot call into
// a client module or spread an object it exports (it only gets references),
// so both of these have to live here. The client components are imported by
// the package's own name, and the build keeps that name external, so this
// file points at the client bundles instead of carrying a copy of them.

import { createElement, type ComponentType, type ReactElement } from "react";
import { GlossaryAppendix, Term } from "@sphynxoid/stepwise";
import {
  Choices,
  EndNote,
  ExplainerBar,
  Narration,
  Predict,
  PredictToggle,
  Prompt,
  Stage,
  StepCode,
} from "@sphynxoid/stepwise/kit";
import type { ExplainerInstanceProps } from "@sphynxoid/stepwise/kit";
import { assertJsonInput, precompute, resolveInput } from "../core";
import type { AnyExplainerDefinition, PrecomputedTrace, StepwiseStep } from "../core";

// A page renders the same explainer with the same props on every request (and
// a static build renders it once per page), so traces are kept per definition.
// Small and bounded: a page that varies props per request must not grow it.
const MAX_TRACES = 8;
const traces = new WeakMap<object, Map<string, PrecomputedTrace<unknown, StepwiseStep>>>();

function traceFor<Input, S extends StepwiseStep>(
  definition: AnyExplainerDefinition<Input, S>,
  input: Input
): PrecomputedTrace<Input, S> {
  let byInput = traces.get(definition);
  if (!byInput) {
    byInput = new Map();
    traces.set(definition, byInput);
  }
  // The key is the input's JSON, so a non-JSON input (NaN, a Map) could share
  // another input's entry: reject it before any lookup.
  assertJsonInput(definition, input);
  const key = JSON.stringify([input, definition.seed]);
  const hit = byInput.get(key);
  if (hit) return hit as PrecomputedTrace<Input, S>;
  // precompute throws for a broken explainer: nothing is cached, the render fails.
  const trace = precompute(definition, input);
  byInput.set(key, trace as PrecomputedTrace<unknown, StepwiseStep>);
  // Maps iterate in insertion order: the first key is the oldest.
  if (byInput.size > MAX_TRACES) byInput.delete(byInput.keys().next().value as string);
  return trace;
}

/**
 * Renders `Client` with a trace computed where this runs. No hooks, so it
 * works as a server component; the input comes from the props exactly as the
 * client component would resolve it, and every prop is forwarded.
 *
 *   export const Sorting = precomputed(sorting, SortingClient);
 */
export function precomputed<Input, S extends StepwiseStep>(
  definition: AnyExplainerDefinition<Input, S>,
  Client: ComponentType<ExplainerInstanceProps<Input, S>>
): (props: Omit<ExplainerInstanceProps<Input, S>, "trace">) => ReactElement {
  function Precomputed(props: Omit<ExplainerInstanceProps<Input, S>, "trace">): ReactElement {
    // The client's own rule (reserved prop names are never fields), so the
    // trace handed over is the one the client would compute.
    const input = resolveInput(definition, props as unknown as { input?: Input } & Record<string, unknown>);
    const trace = traceFor(definition, input);
    return createElement(Client, { ...props, trace } as ExplainerInstanceProps<Input, S>);
  }
  Precomputed.displayName = `Precomputed(${Client.displayName || Client.name || "Explainer"})`;
  return Precomputed;
}

/** Spread into mdx-components.tsx or a provider's `components`. */
export const stepwiseComponents = {
  Term,
  GlossaryAppendix,
  Stage,
  Narration,
  StepCode,
  Predict,
  PredictToggle,
  Prompt,
  ExplainerBar,
  EndNote,
  Choices,
};
