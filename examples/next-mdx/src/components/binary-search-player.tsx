"use client";

import { useEffect, useState } from "react";
import { TONE_CHIP_CLASS } from "@sphynxoid/stepwise";
import { createRng } from "@sphynxoid/stepwise/core";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import type { Frame, SearchInput } from "@/lib/binary-search";
import { binarySearch, MAX_VALUE, MIN_VALUE } from "@/lib/binary-search.explainer";

const ARRAY_LEN = 7;

// The only hand-written UI: draw one frame and edit the input. The player,
// the links, the keyboard and predict mode come from the kit; this reads the
// current step and the input from useExplainer().
function SearchView() {
  const { step, input, setInput, sim } = useExplainer<SearchInput, Frame>();
  const [seed, setSeed] = useState(1);
  const [reruns, setReruns] = useState(0);
  // The box holds a draft, so a half-typed number is never forced back; every
  // draft that is a valid target is applied at once (typing and the spinner
  // arrows alike), with no Enter and no blur needed.
  const [draft, setDraft] = useState(String(input.target));
  useEffect(() => {
    // The target changed from outside the box (a restored link): show it.
    setDraft((d) => (Number(d) === input.target ? d : String(input.target)));
  }, [input.target]);
  if (!step) return null;

  const edit = (next: SearchInput) => {
    setInput(next);
    setReruns((n) => n + 1);
  };

  // Seeded, so "seed 4" is the same array for everyone.
  const regenerate = () => {
    const rng = createRng(seed);
    const values = Array.from({ length: ARRAY_LEN }, () => rng.int(MIN_VALUE, MAX_VALUE)).sort((x, y) => x - y);
    edit({ arr: values, target: input.target });
    setSeed((s) => s + 1);
  };

  const editTarget = (raw: string) => {
    setDraft(raw);
    const target = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(target) || target < MIN_VALUE || target > MAX_VALUE) return;
    if (target !== input.target) edit({ ...input, target });
  };

  return (
    <div className="bs-panel">
      <div className="bs-head">
        <span className={`bs-chip ${TONE_CHIP_CLASS[step.tone]}`}>{step.kind}</span>
        <span className="bs-meta">
          key {step.key} · {sim.steps.length} steps{reruns > 0 ? ` · re-ran ${reruns}×` : ""}
        </span>
      </div>

      <p className="bs-narration" aria-live="polite">
        {step.label}
      </p>

      <div className="bs-track" role="img" aria-label={`Array ${step.arr.join(", ")}: ${step.label}`}>
        {step.arr.map((v, i) => {
          const outside = i < step.lo || i > step.hi;
          const probe = i === step.mid && !outside;
          const cls = [
            "bs-box",
            outside ? "bs-outside" : "bs-inrange",
            probe ? "bs-probe" : "",
            step.kind === "found" && probe ? "bs-found" : "",
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
        <span>lo = {step.lo}</span>
        <span>mid = {step.mid}</span>
        <span>hi = {step.hi}</span>
      </div>

      <div className="bs-controls">
        <label className="bs-target">
          <span className="bs-target-label">Target</span>
          <input
            type="number"
            min={MIN_VALUE}
            max={MAX_VALUE}
            value={draft}
            onChange={(e) => editTarget(e.currentTarget.value)}
            onBlur={() => setDraft(String(input.target))}
            aria-label="Target number to search for"
          />
        </label>
        <button type="button" className="bs-btn" onClick={regenerate}>
          New array (seed {seed})
        </button>
      </div>
    </div>
  );
}

export const BinarySearchClient = createExplainer({ definition: binarySearch, view: SearchView });
