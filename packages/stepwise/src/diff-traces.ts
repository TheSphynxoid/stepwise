// What did an edit change? Compare the trace before and after a re-run, so a
// page can mark the changed steps ("your edit changed steps 12-20") instead
// of just saying that something did.

export interface TraceDiff {
  /**
   * First index where the two traces differ position by position (a step
   * that changed, or the end of the shorter one); -1 when they're equal.
   * Every step before it is the same in both runs.
   */
  divergedAt: number;
  /** Indices (into the new trace) of steps that are new or differ from their counterpart. */
  changed: ReadonlySet<number>;
}

export interface DiffTracesOptions<S> {
  /**
   * Pairs each new step with its counterpart in the old trace: the old step
   * with the same key. Without it, steps are paired by index.
   */
  keyOf?: (step: S, index: number) => string | undefined;
  /** Step equality. Default: structural (plain objects, arrays, primitives). */
  equals?: (a: S, b: S) => boolean;
}

/** Structural equality for plain data; anything else compares by identity. */
export function structuralEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => structuralEqual(v, bb[i]));
  }
  const pa = Object.getPrototypeOf(a);
  if ((pa !== Object.prototype && pa !== null) || Object.getPrototypeOf(b) !== pa) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && structuralEqual((a as never)[k], (b as never)[k])
  );
}

/** Compare two runs of a trace. Pure. */
export function diffTraces<S>(
  oldSteps: readonly S[],
  newSteps: readonly S[],
  opts?: DiffTracesOptions<S>
): TraceDiff {
  const equals = opts?.equals ?? structuralEqual;
  const keyOf = opts?.keyOf;

  let divergedAt = -1;
  const shared = Math.min(oldSteps.length, newSteps.length);
  for (let i = 0; i < shared; i++) {
    if (!equals(oldSteps[i], newSteps[i])) {
      divergedAt = i;
      break;
    }
  }
  if (divergedAt === -1 && oldSteps.length !== newSteps.length) divergedAt = shared;

  const changed = new Set<number>();
  if (keyOf) {
    const byKey = new Map<string, S>();
    oldSteps.forEach((s, i) => {
      const k = keyOf(s, i);
      if (k !== undefined && !byKey.has(k)) byKey.set(k, s);
    });
    newSteps.forEach((s, i) => {
      const k = keyOf(s, i);
      const old = k === undefined ? undefined : byKey.get(k);
      if (old === undefined || !equals(old, s)) changed.add(i);
    });
  } else {
    newSteps.forEach((s, i) => {
      if (i >= oldSteps.length || !equals(oldSteps[i], s)) changed.add(i);
    });
  }
  return { divergedAt, changed };
}
