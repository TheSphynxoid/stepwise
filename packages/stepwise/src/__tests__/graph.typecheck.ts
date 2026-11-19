// Type-level tests for fromGraph's typed node ids (checked by `tsc --noEmit`,
// like kit-props.typecheck.tsx: every @ts-expect-error must stay an error).

import { fromGraph } from "../core";

type State = "draft" | "paid" | "refunded";
type Action = "pay" | "refund";

const nodes: Record<State, { label: string }> = { draft: { label: "draft" }, paid: { label: "paid" }, refunded: { label: "refunded" } };
const edges: readonly { from: State; on: Action; to: State }[] = [
  { from: "draft", on: "pay", to: "paid" },
  { from: "paid", on: "refund", to: "refunded" },
];

// No type arguments: Sym from the edges, node ids from `nodes`.
const g = fromGraph({ start: "draft", nodes, edges });
export const next: State | null = g.delta("draft", "pay");
export const from: State = g.graph.edges[0].from;
export const accepted: ReadonlySet<State> = g.graph.accept;

// An inline literal spec infers its ids too.
const lit = fromGraph({ start: "q0", nodes: { q0: {}, q1: {} }, edges: [{ from: "q0", on: "a", to: "q1" }] });
export const q: "q0" | "q1" | null = lit.delta("q0", "a");

export function wrong() {
  // @ts-expect-error: "drafts" is not a node
  g.delta("drafts", "pay");
  // @ts-expect-error: "ship" is not a symbol of this graph
  g.delta("draft", "ship");
  // @ts-expect-error: the start must be a node; it does not add one
  fromGraph({ start: "x", nodes: { q0: {} }, edges: [] });
  // @ts-expect-error: an edge to an unknown node
  fromGraph({ start: "q0", nodes: { q0: {} }, edges: [{ from: "q0", on: "a", to: "q9" }] });
}

// An explicit symbol type keeps working (ids fall back to string).
const loose = fromGraph<Action>({ start: "draft", nodes, edges });
export const anyId: string | null = loose.delta("anything", "pay");
