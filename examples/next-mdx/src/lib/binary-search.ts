import type { Simulation, StepwiseStep } from "@sphynxoid/stepwise";

export type SearchInput = {
  readonly arr: readonly number[];
  readonly target: number;
};

export type SearchKind = "start" | "compare" | "left" | "right" | "found" | "done";

export type Frame = StepwiseStep<{
  kind: SearchKind;
  /** A snapshot of the array this step was computed against (copies!). */
  arr: number[];
  /** The inclusive [lo, hi] search window and the probed index, as positions in `arr`. */
  lo: number;
  hi: number;
  mid: number;
  /** Comparisons made so far, for the "found after N comparisons" note. */
  cmp: number;
}>;

/**
 * Binary search written as a generator: the published trace is exactly the
 * frames this yields, so narration stays in sync with the data. Every step
 * carries a `key` naming its moment in the algorithm (the round number), which
 * is what keeps the playhead anchored when an edit recomputes the trace.
 */
export const binarySearch: Simulation<SearchInput, Frame> = function* (input) {
  const a = [...input.arr];
  let lo = 0;
  let hi = a.length - 1;
  let cmp = 0;
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `start: lo=0, hi=${hi} — the range still covers everything`,
    code: ["let lo = 0", "let hi = a.length - 1"],
    arr: [...a],
    lo,
    hi,
    mid: 0,
    cmp,
  };
  while (lo <= hi) {
    const r = cmp;
    const mid = Math.floor((lo + hi) / 2);
    yield {
      key: `c${r}`,
      kind: "compare",
      tone: "accent",
      label: `compare a[${mid}]=${a[mid]} with target ${input.target}`,
      code: [`mid = Math.floor((lo + hi)/2)  // lo=${lo}, hi=${hi}, a[${mid}]=${a[mid]}`],
      arr: [...a],
      lo,
      hi,
      mid,
      cmp: cmp + 1,
    };
    cmp++;
    if (a[mid] === input.target) {
      yield {
        key: `f${r}`,
        kind: "found",
        tone: "good",
        label: `found: a[${mid}] = ${a[mid]} — done after ${cmp} comparisons`,
        code: [`if (a[mid] === target) return mid   // mid=${mid}`],
        arr: [...a],
        lo,
        hi,
        mid,
        cmp,
      };
      return;
    }
    if (a[mid] < input.target) {
      lo = mid + 1;
      yield {
        key: `r${r}`,
        kind: "right",
        tone: "write",
        label: `a[${mid}] < target → search the right half: lo=${lo}, hi=${hi}`,
        code: [`lo = mid + 1  // a[${mid}] < ${input.target}`],
        arr: [...a],
        lo,
        hi,
        mid,
        cmp,
      };
    } else {
      hi = mid - 1;
      yield {
        key: `l${r}`,
        kind: "left",
        tone: "write",
        label: `a[${mid}] > target → search the left half: lo=${lo}, hi=${hi}`,
        code: [`hi = mid - 1  // a[${mid}] > ${input.target}`],
        arr: [...a],
        lo,
        hi,
        mid,
        cmp,
      };
    }
  }
  yield {
    key: "done",
    kind: "done",
    tone: "neutral",
    label: `lo > hi — the target is not in this array (${cmp} comparisons)`,
    code: ["// lo > hi: empty range"],
    arr: [...a],
    lo,
    hi,
    mid: 0,
    cmp,
  };
};
