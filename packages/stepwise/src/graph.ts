import type { SimulationContext } from "./simulation";
import type { StepwiseStep } from "./types";

// Declared graphs: an automaton as data (nodes, labeled edges, accept
// states), so a page can both run it and draw it. Running it is an ordinary
// simulation whose input is the word: one step per symbol read. Steps are
// keyed by position (step i is "after i symbols"), so an edited word keeps
// the playhead on the same position, which is what a walk means.

// Node ids are typed too: `Id` is inferred from the keys of `nodes` (the one
// place every node is listed), and the start, edges, accept and otherwise
// are checked against it rather than widening it, so a typo is a type error.
// `Sym` is inferred from the edges. Pass no type arguments to get both: an
// explicit `fromGraph<Sym>` leaves `Id` at its default, `string`.

/** Blocks inference from a position (TypeScript's NoInfer, spelled for TS < 5.4). */
type NoInferHere<T> = [T][T extends unknown ? 0 : never];

export interface GraphEdge<Sym extends string = string, Id extends string = string> {
  from: Id;
  on: Sym;
  to: Id;
}

export interface GraphSpec<Sym extends string = string, N = unknown, Id extends string = string> {
  start: NoInferHere<Id>;
  /** Node id → data (`label` is used in step labels; the rest is yours). */
  nodes: Record<Id, N & { label?: string }>;
  edges: readonly GraphEdge<Sym, NoInferHere<Id>>[];
  /** Accepting nodes. */
  accept?: readonly NoInferHere<Id>[];
  /**
   * Where a missing edge leads (a DFA's dead state). Without it, a missing
   * edge ends the run with an error.
   */
  otherwise?: NoInferHere<Id>;
}

export interface GraphStep<Sym extends string = string, Id extends string = string> extends StepwiseStep {
  key: string;
  /** The node this step is on. */
  node: Id;
  /** The node it came from, and the symbol read; null on the start step. */
  from: Id | null;
  on: Sym | null;
  /** How many symbols have been read. */
  read: number;
  /** The node is an accepting one. */
  accepted: boolean;
}

/** A generator over a word; usable as a Simulation and as a WalkSimulation. */
export type GraphSimulation<Sym extends string = string, Id extends string = string> = (
  word: Iterable<string>,
  ctx?: SimulationContext
) => Generator<GraphStep<Sym, Id>, void, unknown>;

export interface StepGraph<Sym extends string = string, N = unknown, Id extends string = string> {
  /** The declared graph, for drawing it. */
  graph: {
    start: Id;
    nodes: Readonly<Record<Id, N & { label?: string }>>;
    edges: readonly GraphEdge<Sym, Id>[];
    accept: ReadonlySet<Id>;
    otherwise: Id | null;
  };
  /** The transition function: where `on` leads from `from` (null: no edge, no `otherwise`). */
  delta: (from: Id, on: Sym) => Id | null;
  /**
   * Run the graph over a word (a string or any iterable of symbols): one step
   * per symbol read. Use with useSimulation or useWalk.
   */
  simulation: GraphSimulation<Sym, Id>;
  /** The step for being on `node` after `read` symbols, for custom walks over the same graph. */
  stepAt: (read: number, node: Id, from?: Id | null, on?: Sym | null) => GraphStep<Sym, Id>;
}

/** Declare an automaton. Throws on an inconsistent graph (unknown nodes, duplicate edges). */
export function fromGraph<Sym extends string = string, N = unknown, Id extends string = string>(
  spec: GraphSpec<Sym, N, Id>
): StepGraph<Sym, N, Id> {
  const known = (id: string) => Object.prototype.hasOwnProperty.call(spec.nodes, id);
  const fail = (msg: string): never => {
    throw new Error(`stepwise fromGraph: ${msg}`);
  };
  if (!known(spec.start)) fail(`start node "${spec.start}" is not in nodes`);
  if (spec.otherwise !== undefined && !known(spec.otherwise)) fail(`otherwise node "${spec.otherwise}" is not in nodes`);
  // The spec's positions are typed with NoInferHere<Id>; at runtime they are Ids.
  const start = spec.start as Id;
  const edges = spec.edges as readonly GraphEdge<Sym, Id>[];
  const accept = new Set<Id>((spec.accept ?? []) as readonly Id[]);
  for (const a of accept) if (!known(a)) fail(`accept node "${a}" is not in nodes`);
  const table = new Map<string, Id>();
  for (const e of edges) {
    if (!known(e.from)) fail(`edge from unknown node "${e.from}"`);
    if (!known(e.to)) fail(`edge to unknown node "${e.to}"`);
    const k = `${e.from}\u0000${e.on}`;
    if (table.has(k)) fail(`two edges from "${e.from}" on "${e.on}"`);
    table.set(k, e.to);
  }
  const otherwise = (spec.otherwise ?? null) as Id | null;
  const label = (id: Id) => spec.nodes[id]?.label ?? id;

  const delta = (from: Id, on: Sym): Id | null => table.get(`${from}\u0000${on}`) ?? otherwise;

  const stepAt = (read: number, node: Id, from: Id | null = null, on: Sym | null = null): GraphStep<Sym, Id> => {
    const accepted = accept.has(node);
    return {
      key: String(read),
      node,
      from,
      on,
      read,
      accepted,
      tone: accepted ? "good" : node === otherwise ? "bad" : read === 0 ? "neutral" : "accent",
      label: on === null ? `start: ${label(node)}` : `'${on}': ${label(from ?? node)} → ${label(node)}`,
    };
  };

  const simulation: GraphSimulation<Sym, Id> = function* (word) {
    let node = start;
    let read = 0;
    yield stepAt(read, node);
    for (const s of word) {
      const sym = s as Sym;
      const to = delta(node, sym);
      if (to === null) return fail(`no edge from "${node}" on "${sym}"`);
      read++;
      yield stepAt(read, to, node, sym);
      node = to;
    }
  };

  return {
    graph: { start, nodes: spec.nodes, edges, accept, otherwise },
    delta,
    simulation,
    stepAt,
  };
}
