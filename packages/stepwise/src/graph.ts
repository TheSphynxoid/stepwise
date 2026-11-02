import type { SimulationContext } from "./simulation";
import type { StepwiseStep } from "./types";

// Declared graphs: an automaton as data (nodes, labeled edges, accept
// states), so a page can both run it and draw it. Running it is an ordinary
// simulation whose input is the word: one step per symbol read. Steps are
// keyed by position (step i is "after i symbols"), so an edited word keeps
// the playhead on the same position, which is what a walk means.

export interface GraphEdge<Sym extends string = string> {
  from: string;
  on: Sym;
  to: string;
}

export interface GraphSpec<Sym extends string = string, N = unknown> {
  start: string;
  /** Node id → data (`label` is used in step labels; the rest is yours). */
  nodes: Record<string, N & { label?: string }>;
  edges: readonly GraphEdge<Sym>[];
  /** Accepting nodes. */
  accept?: readonly string[];
  /**
   * Where a missing edge leads (a DFA's dead state). Without it, a missing
   * edge ends the run with an error.
   */
  otherwise?: string;
}

export interface GraphStep<Sym extends string = string> extends StepwiseStep {
  key: string;
  /** The node this step is on. */
  node: string;
  /** The node it came from, and the symbol read; null on the start step. */
  from: string | null;
  on: Sym | null;
  /** How many symbols have been read. */
  read: number;
  /** The node is an accepting one. */
  accepted: boolean;
}

/** A generator over a word; usable as a Simulation and as a WalkSimulation. */
export type GraphSimulation<Sym extends string = string> = (
  word: Iterable<string>,
  ctx?: SimulationContext
) => Generator<GraphStep<Sym>, void, unknown>;

export interface StepGraph<Sym extends string = string, N = unknown> {
  /** The declared graph, for drawing it. */
  graph: {
    start: string;
    nodes: Readonly<Record<string, N & { label?: string }>>;
    edges: readonly GraphEdge<Sym>[];
    accept: ReadonlySet<string>;
    otherwise: string | null;
  };
  /** The transition function: where `on` leads from `from` (null: no edge, no `otherwise`). */
  delta: (from: string, on: Sym) => string | null;
  /**
   * Run the graph over a word (a string or any iterable of symbols): one step
   * per symbol read. Use with useSimulation or useWalk.
   */
  simulation: GraphSimulation<Sym>;
  /** The step for being on `node` after `read` symbols, for custom walks over the same graph. */
  stepAt: (read: number, node: string, from?: string | null, on?: Sym | null) => GraphStep<Sym>;
}

/** Declare an automaton. Throws on an inconsistent graph (unknown nodes, duplicate edges). */
export function fromGraph<Sym extends string = string, N = unknown>(spec: GraphSpec<Sym, N>): StepGraph<Sym, N> {
  const known = (id: string) => Object.prototype.hasOwnProperty.call(spec.nodes, id);
  const fail = (msg: string): never => {
    throw new Error(`stepwise fromGraph: ${msg}`);
  };
  if (!known(spec.start)) fail(`start node "${spec.start}" is not in nodes`);
  if (spec.otherwise !== undefined && !known(spec.otherwise)) fail(`otherwise node "${spec.otherwise}" is not in nodes`);
  const accept = new Set(spec.accept ?? []);
  for (const a of accept) if (!known(a)) fail(`accept node "${a}" is not in nodes`);
  const table = new Map<string, string>();
  for (const e of spec.edges) {
    if (!known(e.from)) fail(`edge from unknown node "${e.from}"`);
    if (!known(e.to)) fail(`edge to unknown node "${e.to}"`);
    const k = `${e.from}\u0000${e.on}`;
    if (table.has(k)) fail(`two edges from "${e.from}" on "${e.on}"`);
    table.set(k, e.to);
  }
  const otherwise = spec.otherwise ?? null;
  const label = (id: string) => spec.nodes[id]?.label ?? id;

  const delta = (from: string, on: Sym) => table.get(`${from}\u0000${on}`) ?? otherwise;

  const stepAt = (read: number, node: string, from: string | null = null, on: Sym | null = null): GraphStep<Sym> => {
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

  const simulation: GraphSimulation<Sym> = function* (word) {
    let node = spec.start;
    let read = 0;
    yield stepAt(read, node);
    for (const s of word) {
      const sym = s as Sym;
      const to = delta(node, sym);
      if (to === null) fail(`no edge from "${node}" on "${sym}"`);
      read++;
      yield stepAt(read, to as string, node, sym);
      node = to as string;
    }
  };

  return {
    graph: { start: spec.start, nodes: spec.nodes, edges: spec.edges, accept, otherwise },
    delta,
    simulation,
    stepAt,
  };
}
