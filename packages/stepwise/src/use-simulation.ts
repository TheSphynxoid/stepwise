"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { runSimulation } from "./simulation";
import type { Simulation, SimulationResult, SimulationRunOptions } from "./simulation";
import { useTrace } from "./use-trace";
import type { TraceOptions, TracePlayer } from "./use-trace";
import { readHashParam, writeHashParam } from "./use-step-player";
import type { StepwiseStep } from "./types";

/**
 * Keep the simulation's input in the URL hash next to the frame, so a copied
 * link replays the exact run. You still own the input state: `onRestore`
 * hands you the linked input on mount (pass your state setter).
 */
export interface SyncInputOptions<Input> {
  /** Hash key for the input (`#in=…`). Must differ from `syncHash`. */
  key: string;
  /** Input → hash value. Keep it URL-safe (`[5,2,8]` → `"5.2.8"`). */
  serialize: (input: Input) => string;
  /** Hash value → input, or null to ignore a malformed or hostile value. */
  parse: (value: string) => Input | null;
  /** Receives the linked input once on mount. Usually your `setInput`. */
  onRestore: (input: Input) => void;
}

export interface SimulationOptions<S extends StepwiseStep, Input = unknown>
  extends TraceOptions<S>,
    SimulationRunOptions {
  /**
   * Deep-link the input too (see `SyncInputOptions`). On mount the linked
   * input is restored first, and a linked `syncHash` frame is applied to
   * the trace computed from it, not to the default input's trace.
   */
  syncInput?: SyncInputOptions<Input>;
}

export interface SimulationPlayer<S extends StepwiseStep> extends TracePlayer<S> {
  /** The computed trace. */
  steps: readonly S[];
  /** True when `maxSteps` cut the run short. */
  truncated: boolean;
  /** What the simulation threw, if anything (the trace holds the steps before it). */
  error: unknown;
  /** The numeric seed used for this run. */
  seed: number;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

/**
 * A live trace: run `simulation` on `input` and play the result. Change the
 * input (or the seed) and the trace is recomputed; keyed steps keep the
 * playhead on the same logical moment, and a playing player keeps playing.
 *
 *   const [input, setInput] = useState([5, 2, 8, 1]);
 *   const sim = useSimulation(bubbleSort, input, { autoPlay: true, syncHash: "frame" });
 *   <Bars arr={sim.step!.arr} />
 *   <PlayerBar player={sim.player} toneAt={sim.toneAt} titleAt={sim.titleAt} />
 *
 * The trace is recomputed when `simulation`, `input`, `seed` or `maxSteps`
 * change identity: define the simulation at module scope, and keep object
 * inputs in state (or memoize them) rather than rebuilding them per render.
 */
export function useSimulation<Input, S extends StepwiseStep>(
  simulation: Simulation<Input, S>,
  input: Input,
  opts?: SimulationOptions<S, Input>
): SimulationPlayer<S> {
  const { seed, maxSteps, syncInput, ...traceOpts } = opts ?? {};
  const result: SimulationResult<S> = useMemo(
    () => runSimulation(simulation, input, { seed, maxSteps }),
    [simulation, input, seed, maxSteps]
  );
  const trace = useTrace(result.steps, traceOpts);

  useRebuiltInputWarning(input);

  // ── syncInput ──────────────────────────────────────────────────────────
  // Restore on mount: the player has already read `#frame=` against the
  // default input's trace (where that frame may not even exist), so the
  // linked frame is re-applied once the restored input's trace is in.
  const syncRef = useRef(syncInput);
  syncRef.current = syncInput;
  const frameKey = traceOpts.syncHash;
  const linked = useRef<{ input: Input; frame: number | null } | null>(null);
  const written = useRef(input);
  // The hash as the page was opened, captured during the first render: by
  // the time effects run, the player may already have written its own frame
  // (when the linked frame doesn't exist in the default input's trace).
  // A ref, so reading it on the client can't cause a hydration mismatch.
  const openedHash = useRef<string | null>(null);
  if (openedHash.current === null && typeof window !== "undefined") openedHash.current = window.location.hash;
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync || typeof window === "undefined") return;
    const hash = openedHash.current ?? window.location.hash;
    const raw = readHashParam(hash, sync.key);
    const parsed = raw === null ? null : sync.parse(decodeURIComponent(raw));
    if (parsed === null) return;
    const f = frameKey ? readHashParam(hash, frameKey) : null;
    linked.current = { input: parsed, frame: f !== null && /^\d+$/.test(f) ? Number(f) : null };
    written.current = parsed;
    sync.onRestore(parsed);
    // Mount only: later hash edits by hand don't re-import the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Declared after useTrace, so it runs after the re-anchoring layout effect
  // of the same commit and has the last word on the cursor.
  const { jump } = trace.player;
  useIsomorphicLayoutEffect(() => {
    const l = linked.current;
    if (!l || l.input !== input) return;
    linked.current = null;
    if (l.frame !== null) jump(l.frame);
  }, [input, jump]);

  // Write edits back. Comparing against the last input written or restored
  // (not "skip the first run") keeps StrictMode's double effects from
  // writing the default over a linked value.
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync || typeof window === "undefined" || input === written.current) return;
    written.current = input;
    const next = writeHashParam(window.location.hash, sync.key, encodeURIComponent(sync.serialize(input)));
    if (next !== window.location.hash) window.history.replaceState(null, "", next);
  }, [input]);

  return useMemo(
    () => ({ ...trace, steps: result.steps, truncated: result.truncated, error: result.error, seed: result.seed }),
    [trace, result]
  );
}

/**
 * Dev-only: an input rebuilt on every render (`useSimulation(sim, { arr, target })`
 * inline) recomputes the trace each render without any error. Warn once when
 * the identity keeps changing while the content doesn't.
 */
function useRebuiltInputWarning(input: unknown) {
  const prev = useRef<{ input: unknown; json: string | undefined; streak: number; warned: boolean }>({
    input,
    json: undefined,
    streak: 0,
    warned: false,
  });
  if (!isDev) return;
  const p = prev.current;
  if (p.warned || input === p.input || typeof input !== "object" || input === null) {
    p.input = input;
    return;
  }
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    json = undefined;
  }
  p.streak = json !== undefined && json === p.json ? p.streak + 1 : 0;
  p.input = input;
  p.json = json;
  if (p.streak >= 3) {
    p.warned = true;
    console.warn(
      "[stepwise] useSimulation: `input` is a new object on every render with the same content, so the trace " +
        "is recomputed each render. Keep it in state or wrap it in useMemo."
    );
  }
}
