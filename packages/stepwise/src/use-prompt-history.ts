"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addPath, branchesOf } from "./core";
import type { BranchNode, WalkStep } from "./core";
import type { PromptsRun } from "./use-prompts";
import { choicesOf, sameList } from "./use-prompts-parts";

export interface PromptHistory<A> {
  /** The answer lists walked so far, as a tree (the root's list is empty). */
  tree: BranchNode<A>;
  /** Each kept future: a leaf's full answer list. */
  branches: readonly (readonly (A | undefined)[])[];
  /** How many times a settled generator answer was changed. */
  backtracks: number;
  /** Replay a kept branch (a list from `branches`). Ignored while the run's input is locked. */
  restore: (answers: readonly (A | undefined)[]) => void;
}

/**
 * Keep the futures an answer cut off. Watches a run's generator answers
 * (overlay answers don't branch the run) and keeps every list walked in a
 * tree, counting each change of a settled answer. `overwrite` (default off)
 * drops a branch when another replaces it. Starting over (restart, a restored
 * branch) is not a backtrack.
 */
export function usePromptHistory<S extends WalkStep, A>(
  run: PromptsRun<S, A>,
  opts: { overwrite?: boolean } = {}
): PromptHistory<A> {
  const overwrite = opts.overwrite === true;
  const [state, setState] = useState<{ tree: BranchNode<A>; backtracks: number }>({
    tree: { answers: [], children: [] },
    backtracks: 0,
  });
  const prev = useRef<(A | undefined)[]>([]);
  const overwriteRef = useRef(overwrite);
  overwriteRef.current = overwrite;

  useEffect(() => {
    const list = choicesOf(run.record);
    const before = prev.current;
    if (sameList(list, before)) return;
    prev.current = list;
    // A backtrack: an answer both lists have settled now reads differently.
    const changed = list.some((a, i) => i < before.length && !Object.is(a, before[i]));
    setState((s) => {
      const tree = list.length > 0 ? addPath(s.tree, list, overwriteRef.current) : s.tree;
      return tree === s.tree && !changed ? s : { tree, backtracks: s.backtracks + (changed ? 1 : 0) };
    });
  }, [run.record]);

  const { restoreAnswers } = run;
  const restore = useCallback((answers: readonly (A | undefined)[]) => restoreAnswers(answers), [restoreAnswers]);
  const branches = useMemo(() => branchesOf(state.tree), [state.tree]);
  return { tree: state.tree, branches, backtracks: state.backtracks, restore };
}
