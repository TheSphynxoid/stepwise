"use client";

import { useEffect, useState } from "react";
import {
  createRng,
  fail,
  pass,
  useEvaluator,
  useGlobalKeys,
  useSimulation,
  CodeBlock,
  PlayerBar,
  TONE_CHIP_CLASS,
} from "@sphynxoid/stepwise";
import { binarySearch, type Frame, type SearchKind, type SearchInput } from "@/lib/binary-search";

const DEFAULT_INPUT: SearchInput = { arr: [3, 9, 14, 25, 34, 47, 61], target: 34 };
const ARRAY_LEN = 7;

type Guess = "left" | "right" | "found" | null;

/** `#in=3.9.14.25.34.47.61|34`: the exact input, so a shared link replays the same run. */
const serializeInput = (input: SearchInput) => `${input.arr.join(".")}|${input.target}`;

/** Links come from strangers: anything outside the editor's limits is ignored. */
function parseInput(raw: string): SearchInput | null {
  const [rawArr, rawTarget] = raw.split("|");
  const arr = (rawArr ?? "").split(".").map(Number);
  const target = Number(rawTarget);
  const inRange = (v: number) => Number.isInteger(v) && v >= 1 && v <= 99;
  if (arr.length < 2 || arr.length > 12 || !arr.every(inRange) || !inRange(target)) return null;
  return { arr: [...arr].sort((x, y) => x - y), target };
}

export default function BinarySearchPlayer() {
  const [input, setInput] = useState<SearchInput>(DEFAULT_INPUT);
  const [seed, setSeed] = useState(1);
  const [reruns, setReruns] = useState(0);
  const [predict, setPredict] = useState(false);
  const [guess, setGuess] = useState<Guess>(null);
  const [targetText, setTargetText] = useState(String(DEFAULT_INPUT.target));

  // Checkpoints: predict mode pauses autoplay at every comparison. holdAt sees
  // the step from the current trace, also after an edit recomputes it.
  // syncInput keeps the input in the URL next to the frame: a linked input is
  // restored on mount (into both the state and the text box's draft), and the
  // linked frame lands on that input's trace.
  const sim = useSimulation(binarySearch, input, {
    autoPlay: true,
    baseDelayMs: 700,
    syncHash: "frame",
    syncInput: {
      key: "in",
      serialize: serializeInput,
      parse: parseInput,
      onRestore: (linked) => {
        setInput(linked);
        setTargetText(String(linked.target));
      },
    },
    holdAt: (_, s) => predict && s?.kind === "compare",
  });
  const { player, step } = sim;
  const cur = step as Frame;
  const truth: SearchKind | undefined =
    player.held !== null ? sim.steps[player.held + 1]?.kind : undefined;

  const edit = (next: SearchInput) => {
    setInput(next);
    setReruns((n) => n + 1);
    setTargetText(String(next.target));
  };

  // Seeded, so "seed 4" is the same array for everyone.
  const regenerate = () => {
    const rng = createRng(seed);
    const values = Array.from({ length: ARRAY_LEN }, () => rng.int(1, 99)).sort((x, y) => x - y);
    edit({ arr: values, target: input.target });
    setSeed((s) => s + 1);
  };

  const commitTarget = (raw: number | string) => {
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) return;
    const t = Math.max(1, Math.min(99, Math.round(value)));
    if (t === input.target) return setTargetText(String(t));
    edit({ ...input, target: t });
  };

  // Predict mode: at a checkpoint, guess whether the search goes left, right,
  // or stops. The truth is simply the next frame of the trace.
  const answer = useEvaluator(
    (g: Guess) => {
      if (g === null) return fail("Pick an answer first.");
      if (truth === undefined) return fail("The player isn't sitting on a comparison.");
      if (g === truth) {
        if (truth === "found") return pass("Right — this probe is the target, so the search stops right here.");
        return pass(
          truth === "left"
            ? "Right — the probe is bigger than the target, so everything to its right is dismissed."
            : "Right — the probe is smaller than the target, so everything to its left is dismissed."
        );
      }
      if (truth === "found") return fail("Not quite: this probe is exactly the target, so it doesn't have to move.");
      return fail(
        truth === "left"
          ? "Not quite: the probe is bigger than the target, so it falls to the left half."
          : "Not quite: the probe is smaller than the target, so it falls to the right half."
      );
    },
    guess,
    { mode: "manual" }
  );

  const { reset: resetAnswer } = answer;
  useEffect(() => {
    setGuess(null);
    resetAnswer();
  }, [player.held, resetAnswer]);

  // Turning predict off while parked on a checkpoint cancels the question.
  useEffect(() => {
    if (!predict && player.held !== null) player.release();
  }, [predict, player.held, player.release]);

  useGlobalKeys({
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    " ": () => player.toggle(player.start),
    r: regenerate,
  });

  const held = player.held !== null;

  return (
    <section className="bs-player" aria-label="Binary search player">
      <div className="bs-panel">
        <div className="bs-head">
          <span className={`bs-chip ${TONE_CHIP_CLASS[cur.tone]}`}>{cur.kind}</span>
          <span className="bs-meta" data-testid="sim-key">
            key {cur.key} · {sim.steps.length} steps{reruns > 0 ? ` · re-ran ${reruns}×` : ""}
          </span>
        </div>

        <p className="bs-narration" data-testid="sim-label" aria-live="polite">
          {cur.label}
        </p>

        <div className="bs-track" role="img" aria-label={`Array ${cur.arr.join(", ")}: ${cur.label}`}>
          {cur.arr.map((v, i) => {
            const outside = i < cur.lo || i > cur.hi;
            const probe = i === cur.mid && !outside;
            const cls = [
              "bs-box",
              outside ? "bs-outside" : "bs-inrange",
              probe ? "bs-probe" : "",
              cur.kind === "found" && probe ? "bs-found" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={i} className={cls}>
                <span className="bs-value">{v}</span>
                <span className="bs-index">{i}</span>
              </div>
            );
          })}
        </div>
        <div className="bs-bounds">
          <span>lo = {cur.lo}</span>
          <span>mid = {cur.mid}</span>
          <span>hi = {cur.hi}</span>
        </div>

        <div className="bs-controls">
          <label className="bs-target">
            <span className="bs-target-label">Target</span>
            <input
              type="number"
              min={1}
              max={99}
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              onBlur={() => commitTarget(targetText)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTarget(targetText);
              }}
              aria-label="Target number to search for"
            />
          </label>
          <button type="button" className="bs-btn" onClick={regenerate}>
            New array (seed {seed})
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={predict}
            className={predict ? "bs-btn is-active" : "bs-btn"}
            onClick={() => setPredict((p) => !p)}
          >
            Predict mode {predict ? "on" : "off"}
          </button>
        </div>
      </div>

      {held && (
        <div className="bs-checkpoint" data-testid="checkpoint">
          <p className="bs-checkpoint-title">Checkpoint</p>
          <p className="bs-checkpoint-ask">
            Will the search go <strong>left</strong>, <strong>right</strong>, or is the target{" "}
            <strong>found here</strong>?
          </p>
          <div className="bs-choices" role="radiogroup" aria-label="Your prediction">
            {(["left", "right", "found"] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={guess === g}
                data-testid={`guess-${g}`}
                onClick={() => setGuess(g)}
                className={guess === g ? "bs-btn is-active" : "bs-btn"}
              >
                {g === "left" ? "Left" : g === "right" ? "Right" : "Found here"}
              </button>
            ))}
            <button type="button" className="bs-btn is-primary" data-testid="answer-check" onClick={() => void answer.check()}>
              Check
            </button>
            {answer.passed ? (
              <button type="button" className="bs-btn" data-testid="answer-continue" onClick={player.release}>
                Continue
              </button>
            ) : (
              <button type="button" className="bs-blur" data-testid="answer-skip" onClick={player.release}>
                Skip
              </button>
            )}
          </div>
          <p className="bs-feedback" aria-live="polite">
            {answer.feedback}
            {answer.status === "fail" && answer.attempts >= 2 && " (Hint: compare the highlighted probe with the target.)"}
          </p>
        </div>
      )}

      <figure className="bs-figure">
        <CodeBlock lines={cur.code} />
        <figcaption className="bs-src">
          Pseudocode for the current step — trace computed by a generator, played by useSimulation
        </figcaption>
      </figure>

      <div className="bs-bar">
        <PlayerBar player={player} toneAt={sim.toneAt} titleAt={sim.titleAt} onEmpty={player.start} />
      </div>
      {player.ended && (
        <p className="bs-note" data-testid="sim-ended">
          {cur.kind === "found"
            ? `Found ${input.target} after ${cur.cmp} comparisons — log₂(${cur.arr.length}) is about ${Math.log2(cur.arr.length).toFixed(1)}.`
            : "Done. Edit the target or the array and it replays instantly."}
        </p>
      )}
    </section>
  );
}
