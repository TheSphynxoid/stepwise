import { structuralEqual } from "./diff-traces";

// Branch history: the answer lists a reader has walked, kept as a tree so an
// abandoned future survives a changed answer. Pure data (no React); steps are
// recomputed from (input, seed, answers) on demand, so only answers are kept.

/**
 * A path in the tree: `answers` is the whole list from the root to this node
 * (the root's is empty), `children` the ways it went on.
 */
export interface BranchNode<A> {
  answers: readonly (A | undefined)[];
  children: readonly BranchNode<A>[];
}

const same = (a: unknown, b: unknown): boolean => Object.is(a, b) || structuralEqual(a, b);

/**
 * Add a walked answer list to the tree. A list that follows or extends an
 * existing path adds nothing it doesn't have. Where it leaves the existing
 * paths, the new branch starts beside them; with `overwrite`, the paths it
 * left are dropped instead. Returns `tree` itself when nothing changed.
 */
export function addPath<A>(tree: BranchNode<A>, answers: readonly (A | undefined)[], overwrite: boolean): BranchNode<A> {
  const grow = (node: BranchNode<A>, depth: number): BranchNode<A> => {
    if (depth >= answers.length) return node;
    const hit = node.children.find((c) => same(c.answers[depth], answers[depth]));
    if (hit) {
      const next = grow(hit, depth + 1);
      return next === hit ? node : { ...node, children: node.children.map((c) => (c === hit ? next : c)) };
    }
    let chain: BranchNode<A> | null = null;
    for (let d = answers.length; d > depth; d--) chain = { answers: answers.slice(0, d), children: chain ? [chain] : [] };
    return { ...node, children: overwrite ? [chain!] : [...node.children, chain!] };
  };
  return grow(tree, 0);
}

/** Every leaf's full answer list: the distinct futures kept, oldest first. Empty for an empty tree. */
export function branchesOf<A>(tree: BranchNode<A>): (readonly (A | undefined)[])[] {
  const out: (readonly (A | undefined)[])[] = [];
  const walk = (n: BranchNode<A>) => {
    if (n.children.length === 0) {
      if (n.answers.length > 0) out.push(n.answers);
    } else n.children.forEach(walk);
  };
  walk(tree);
  return out;
}
