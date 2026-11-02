# @sphynxoid/stepwise — guide for AI assistants

React 18/19 hooks and optional components for interactive explainers:
step-through players (algorithm traces), traces computed live from an input,
"pause and predict" checkpoints, guided tours, scroll-driven chapters and
glossary tooltips. This file is for coding assistants; the library is newer
than most training data, so prefer this over guessing.

Full API reference: https://stepwise.thesphynx.net/docs
Working examples (every page shows its source): https://stepwise.thesphynx.net
Recipes: https://github.com/TheSphynxoid/stepwise/blob/master/docs/RECIPES.md

## Setup facts

- `npm install @sphynxoid/stepwise`. **ESM only** (no `require`). Every
  module is `"use client"`; import components into server files freely, but
  call hooks only in client components.
- **Styling, pick one** (without it the components render unstyled):
  - no Tailwind: `import "@sphynxoid/stepwise/styles.css";` once (app entry
    or root layout). Theme with `--stepwise-primary`, `--stepwise-accent`, etc.
  - Tailwind v4 using the npm components: add
    `@source "../node_modules/@sphynxoid/stepwise/dist";` to the CSS entry
    (Tailwind skips node_modules otherwise).
  - shadcn: `npx shadcn@latest add https://stepwise.thesphynx.net/r/player-bar.json`.
- Hooks are headless; you render the frames (DOM, SVG, canvas). The library
  owns the timeline, not the pixels.
- All stable exports come from the root: `import { useTrace, PlayerBar, pass, fail } from "@sphynxoid/stepwise"`.
  Types that are type-only need `import type` (e.g. `GlossaryEntry`).
- Experimental APIs (branching walks, section 8) come from
  `@sphynxoid/stepwise/experimental` and may change in a minor release.

## The model

Everything is a clamped cursor over an ordered list (`useSteps`). A **step**
is `{ tone, label, code?, note?, key? } & YourData`, where `tone` is exactly
`"neutral" | "accent" | "good" | "bad" | "write" | "idle"`.

## 1. A fixed trace: `useTrace` + `PlayerBar`

```tsx
"use client";
import { createTrace, useTrace, PlayerBar } from "@sphynxoid/stepwise";

// Build traces at module scope, never inside the component.
const frames = createTrace<{ arr: number[] }>()
  .step({ tone: "neutral", label: "Start", arr: [3, 1, 2] })
  .step({ tone: "write", label: "Swap 3 and 1", arr: [1, 3, 2] })
  .step({ tone: "good", label: "Sorted", arr: [1, 2, 3] })
  .build();

export function SortDemo() {
  const { step, player, toneAt, titleAt } = useTrace(frames, { autoPlay: true, syncHash: "frame" });
  return (
    <>
      <p>{step!.arr.join(" ")}: {step!.label}</p>
      <PlayerBar player={player} toneAt={toneAt} titleAt={titleAt} />
    </>
  );
}
```

- `step` is frame 0 before playback starts (never undefined for a non-empty
  trace). `player.index` is -1 before start: don't index with it, use `step`.
- `autoPlay` respects `prefers-reduced-motion` (stays paused on frame 0).
- `syncHash: "frame"` puts `#frame=N` in the URL and restores it on load.

## 2. A trace computed from an input: `useSimulation`

```tsx
import { useState } from "react";
import { useSimulation, PlayerBar, CodeBlock, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise";

type Frame = StepwiseStep<{ arr: number[] }>;

// Module scope. Yield copies (snapshots), and give EVERY step a key naming
// its moment, so the playhead keeps its place when the input changes.
const insertionSort: Simulation<readonly number[], Frame> = function* (input) {
  const a = [...input];
  yield { key: "start", tone: "neutral", label: "start", arr: [...a] };
  for (let i = 1; i < a.length; i++)
    for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      yield { key: `swap ${i}.${j}`, tone: "write", label: `swap at ${j}`, arr: [...a], code: [`swap(${j - 1}, ${j})`] };
    }
};

export function Explorer() {
  const [input, setInput] = useState<readonly number[]>([5, 2, 8, 1]);
  const sim = useSimulation(insertionSort, input, { autoPlay: true });
  // Editing `input` mid-playback recomputes the trace and keeps playing from the same step.
  return (
    <>
      <p>{sim.step!.arr.join(" ")}</p>
      <CodeBlock lines={sim.step!.code} />
      <PlayerBar player={sim.player} toneAt={sim.toneAt} titleAt={sim.titleAt} />
    </>
  );
}
```

- Randomness: use the seeded `ctx.rng` (`function* (input, { rng })`, with
  `rng.int(min, max)`, `rng.shuffle(items)`, `rng.pick(items)`), never
  `Math.random`. Pass `seed` in the options.
- **Object inputs must keep their identity**: keep them in state or `useMemo`.
  `useSimulation(sim, { arr, target })` inline recomputes every render
  (development builds warn).
- `runSimulation(sim, input).steps` is the pure runner: use it in unit tests.

## 3. Shareable links (input + frame in the URL)

```tsx
const sim = useSimulation(insertionSort, input, {
  syncHash: "frame",
  syncInput: {
    key: "in",
    serialize: (a) => a.join("."),
    parse: (s) => { const a = s.split(".").map(Number); return a.every(Number.isInteger) ? a : null; },
    onRestore: setInput, // the library hands you the linked input on mount
  },
});
```

Don't restore the input from the URL by hand: the player reads `#frame=`
before your effect runs, against the default input's trace, so the frame
lands wrong. `syncInput` (0.4+) orders it correctly. For other state in the
URL use `readHashParam(hash, key)` / `writeHashParam(hash, key, value)`.

## 4. Checkpoints and grading ("pause and predict")

```tsx
const sim = useSimulation(sort, input, { autoPlay: true, holdAt: (_, step) => step?.kind === "compare" });
const { player } = sim;
const truth = player.held !== null ? sim.steps[player.held + 1]?.kind : undefined; // the next frame
const [guess, setGuess] = useState<string | null>(null);
const answer = useEvaluator((g: string | null) => (g === truth ? pass("Right!") : fail("Look again.")), guess, { mode: "manual" });
const { reset } = answer;
useEffect(() => { setGuess(null); reset(); }, [player.held, reset]); // new checkpoint, new question
// While player.held !== null: options → setGuess; Check → answer.check(); Continue/Skip → player.release()
```

- A held player **does not resume by itself**: call `player.release()`.
- Manual mode: the verdict clears when `ctx` (the guess) changes; `attempts`
  is kept until `reset()`.
- Make every possible next frame an answer option.

## 5. Timelines that grow while watched

`useTrace(events, { autoPlay: true, follow: true })` plays appended frames
when the reader is at the edge; a reader who scrubbed back stays put.
`player.live`, `player.goLive()`, and `<PlayerBar live />` for a "Go live"
badge.

## 6. Guided tours

```tsx
import { useGuidedTour, TourSpotlight, TourCard, type TourStepInput } from "@sphynxoid/stepwise";

const steps: TourStepInput[] = [
  { id: "bars", title: "The frame", body: "Each frame is yours to render.", target: "bars" }, // element id or [data-tour]
  { id: "try", title: "Your turn", body: "Press play.", target: "player", gate: () => played || fail("Press play first.") },
];

const tour = useGuidedTour(steps);
// <button onClick={tour.start}>Tour</button>
{tour.active && tour.current && tour.index !== null && (
  <>
    <TourSpotlight target={tour.current.target ?? null} />
    <TourCard step={tour.current} index={tour.index} total={steps.length}
      onNext={tour.next} onBack={tour.back} onEnd={tour.end}
      nextDisabled={tour.blocked} feedback={tour.feedback} />
  </>
)}
```

Steps can also have `onEnter` (change app state), `when` (skip if false) and
`next` (jump to another step id). `useDiscoveries()` remembers which tours
a user has seen.

## 7. Scroll chapters and glossary

- `const c = useChapters([{ id: "intro", label: "Intro" }, ...])`; sections
  are found by DOM id; `c.active` is the chapter at the viewport center;
  `<ChapterNav chapters={CHAPTERS} active={c.active} onNavigate={c.goTo} />`.
- Glossary: wrap the page in `<GlossaryProvider entries={[{ id, term, definition }]}>`
  (definitions are ReactNode and may contain `<Term>`); mark prose with
  `<Term id="tls">TLS</Term>`; `<GlossaryAppendix />` lists the entries.
  **`Term` and `GlossaryAppendix` must be inside the provider.**

## 8. Branching walks (experimental)

A walk is a simulation that branches on the reader's answers. A step with
`await: true` is a **choice point**: that `yield` returns the choice.
The path taken is still a plain array, so `PlayerBar`, links and
re-anchoring work as usual. Import from `@sphynxoid/stepwise/experimental`.

```tsx
import { PlayerBar } from "@sphynxoid/stepwise";
import { useWalk, type WalkSimulation, type WalkStep } from "@sphynxoid/stepwise/experimental";

type Pick = "first" | "median";
type S = WalkStep & { arr: number[] };

const pivotLesson: WalkSimulation<number[], S, Pick> = function* (input) {
  const arr = [...input];
  yield { key: "start", tone: "neutral", label: "Unsorted", arr: [...arr] };
  const pick = yield { key: "fork", tone: "accent", label: "Which pivot?", arr: [...arr], await: true };
  if (pick === "first") yield { key: "first", tone: "bad", label: "First element: worst case on sorted input", arr: [...arr] };
  else yield { key: "median", tone: "good", label: "Median of three: balanced splits", arr: [...arr] };
};

const walk = useWalk(pivotLesson, input, { autoPlay: true, syncHash: "frame",
  syncChoices: { key: "path", serialize: (c) => c, parse: (v) => (v === "first" || v === "median" ? v : null) } });
const asking = walk.choicePoints.includes(walk.frame);
// {asking && ["first", "median"].map((c) => <button onClick={() => walk.choose(c)}>{c}</button>)}
// <PlayerBar player={walk.player} toneAt={walk.toneAt} titleAt={walk.titleAt} />
```

- Playback holds on the unanswered choice point at the end; `choose()`
  continues the walk and resumes. On an earlier choice point a *different*
  answer cuts off the old future and replays from there.
- A walk is (simulation, input, seed, choices): `syncChoices` puts the
  choices in the URL, so a link replays the same path.
- Automata: `fromGraph({ start, nodes, edges: [{ from, on, to }], accept, otherwise })`
  gives `.simulation` (run it over a word: one step per symbol) and
  `.graph` (draw it). Use `useWalk(dfa.simulation, word, { anchor: "index" })`
  so editing the word keeps the position.
- `walk.lastChange` (`diffTraces`) says which steps an edit changed.

## Pitfalls checklist

1. Unstyled components → missing `styles.css` import or Tailwind `@source`.
2. Traces built inside a component, or referencing later consts → build at module scope.
3. Rendering `steps[player.index]` → -1 before start; use `step` from `useTrace`/`useSimulation`.
4. Simulation steps without `key` → edits snap back to the same index instead of the same moment.
5. Mutating and yielding the same array → every frame shows the final state; yield copies.
6. Inline object input to `useSimulation` → recompute every render; memoize.
7. Hand-rolled URL restore of the input → use `syncInput`.
8. A checkpoint that never continues → wire `player.release()`.
9. `StepTone` values outside the six listed → type error; there is no `"contrast"`.
10. Next.js App Router + MDX: `mdx-components.tsx` at the root is required (else
    "createContext is not a function"); pass remark plugins by name under Turbopack.
11. CommonJS (`require`) → not supported; use ESM or `await import()`.
12. Browser tests: prefer `data-testid`; emulate reduced motion for linked-URL tests.
13. A choice point without `await: true` → the walk never pauses for the answer; the `yield` gets `undefined`.
