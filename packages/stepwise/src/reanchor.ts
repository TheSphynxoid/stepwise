/**
 * Where should the playhead go when the trace changes underneath it?
 *
 * Walk back from the old position to the most recent step whose key still
 * exists in the new trace, and land on that step there. So editing an input
 * keeps you on "the same moment" of the algorithm when it still happens, and
 * otherwise on the last moment both runs share — never somewhere unrelated.
 * With no shared key at all, the playhead returns to frame 0.
 *
 * Pure: `useTrace` calls it during render, and it's exported for custom
 * players. Keys come from `keyOf`, by default each step's `key` field; a
 * step without a key never matches.
 */
export function reanchor<A, B>(
  oldSteps: readonly A[],
  oldIndex: number,
  newSteps: readonly B[],
  keyOf: (step: A | B, index: number) => string | undefined
): number {
  if (newSteps.length === 0) return -1;
  if (oldIndex < 0 || oldSteps.length === 0) return 0;
  const positions = new Map<string, number>();
  newSteps.forEach((s, i) => {
    const k = keyOf(s, i);
    if (k !== undefined && !positions.has(k)) positions.set(k, i);
  });
  for (let i = Math.min(oldIndex, oldSteps.length - 1); i >= 0; i--) {
    const k = keyOf(oldSteps[i], i);
    if (k === undefined) continue;
    const j = positions.get(k);
    if (j !== undefined) return j;
  }
  return 0;
}

/** Default key accessor: the step's own `key` field. */
export const stepKey = (step: unknown): string | undefined =>
  step !== null && typeof step === "object" && typeof (step as { key?: unknown }).key === "string"
    ? (step as { key: string }).key
    : undefined;
