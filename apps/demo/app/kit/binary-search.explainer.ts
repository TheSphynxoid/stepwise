import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";

// The whole explainer as data: what to simulate, the default input, how the
// input goes into a link, and where to stop and ask. A plain module (no
// "use client"), so the server page can run it to the first frame at build
// time and the client can re-run it when the reader changes the target.

export type SearchInput = { arr: number[]; target: number };
export type SearchKind = "start" | "compare" | "left" | "right" | "found" | "missing";

export type SearchStep = StepwiseStep<{
  kind: SearchKind;
  /** The inclusive [lo, hi] window and the probed index, as positions in `arr`. */
  arr: number[];
  lo: number;
  hi: number;
  mid: number;
  /** Comparisons so far. */
  cmp: number;
}>;

// Every step carries a `key` naming its moment (the round), so an edit that
// recomputes the trace keeps the playhead on the same round.
const search: Simulation<SearchInput, SearchStep> = function* ({ arr, target }) {
  let lo = 0;
  let hi = arr.length - 1;
  let cmp = 0;
  const frame = (step: Omit<SearchStep, "arr" | "lo" | "hi" | "cmp">): SearchStep => ({ ...step, arr: [...arr], lo, hi, cmp });
  yield frame({
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `start: lo=0, hi=${hi}, the range covers everything`,
    code: ["let lo = 0, hi = a.length - 1"],
    mid: -1,
  });
  while (lo <= hi) {
    const round = cmp;
    const mid = Math.floor((lo + hi) / 2);
    cmp++;
    yield frame({
      key: `c${round}`,
      kind: "compare",
      tone: "accent",
      label: `compare a[${mid}]=${arr[mid]} with target ${target}`,
      code: [`mid = (lo + hi) >> 1   // lo=${lo}, hi=${hi}`],
      mid,
    });
    if (arr[mid] === target) {
      yield frame({
        key: `f${round}`,
        kind: "found",
        tone: "good",
        label: `found ${target} at index ${mid} after ${cmp} comparisons`,
        code: ["if (a[mid] === target) return mid"],
        mid,
      });
      return;
    }
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
    const right = arr[mid] < target;
    yield frame({
      key: `${right ? "r" : "l"}${round}`,
      kind: right ? "right" : "left",
      tone: "write",
      label: right
        ? `a[${mid}] < ${target}: keep the right half, lo=${lo}`
        : `a[${mid}] > ${target}: keep the left half, hi=${hi}`,
      code: [right ? `lo = mid + 1   // ${arr[mid]} < ${target}` : `hi = mid - 1   // ${arr[mid]} > ${target}`],
      mid,
    });
  }
  yield frame({
    key: "missing",
    kind: "missing",
    tone: "bad",
    label: `lo > hi: ${target} is not in the array (${cmp} comparisons)`,
    code: ["return -1"],
    mid: -1,
  });
};

export const MIN_VALUE = 1;
export const MAX_VALUE = 99;
const inRange = (v: number) => Number.isInteger(v) && v >= MIN_VALUE && v <= MAX_VALUE;

export const binarySearch = defineExplainer({
  name: "binary-search",
  simulation: search,
  input: {
    default: { arr: [3, 9, 14, 25, 34, 47, 61], target: 34 },
    // `#b.in=3.9.14.25.34.47.61~61`: the exact input, so a link replays the same run.
    serialize: ({ arr, target }) => `${arr.join(".")}~${target}`,
    // Links come from strangers: anything the page could not have produced is ignored.
    parse: (raw) => {
      const [rawArr, rawTarget] = raw.split("~");
      const arr = (rawArr ?? "").split(".").map(Number);
      const target = Number(rawTarget);
      if (arr.length < 2 || arr.length > 12 || !arr.every(inRange) || !inRange(target)) return null;
      return { arr: [...arr].sort((x, y) => x - y), target };
    },
  },
  // Hold at every probe; the next frame says where the search went.
  predict: {
    at: (step) => step.kind === "compare",
    options: ["left", "right", "found"],
    truth: (next) => next?.kind,
    feedback: (guess, truth, held) => {
      const probe = held.arr[held.mid];
      if (guess === truth) {
        if (truth === "found") return "Right: the probe is the target, so the search stops.";
        return `Right: ${probe} is ${truth === "left" ? "bigger" : "smaller"} than the target, so the other half is dropped.`;
      }
      if (truth === "found") return "Not quite: the probe is exactly the target.";
      return `Not quite: ${probe} is ${truth === "left" ? "bigger" : "smaller"} than the target.`;
    },
    hint: "Compare the highlighted probe with the target.",
  },
});
