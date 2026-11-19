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

- `npm install @sphynxoid/stepwise`. **ESM only** (no `require`). The root
  entry, `./experimental` and `./kit` are `"use client"` modules; import
  components into server files freely, but call hooks only in client
  components.
- **On a server or in a build script, import pure functions from
  `@sphynxoid/stepwise/core`** (`runSimulation`, `createTrace`, `precompute`,
  `pass`, ...). The root entry is a client module, so a React Server Component
  that imports `runSimulation` from it gets a client reference, not a function
  it can call. `./core` has no `"use client"` and no React at runtime.
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
- Experimental APIs come from their own entries and may change in a minor
  release: branching walks (section 8) from `@sphynxoid/stepwise/experimental`,
  the authoring kit (section 9) from `@sphynxoid/stepwise/core`,
  `@sphynxoid/stepwise/kit` and `@sphynxoid/stepwise/kit/mdx`.

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
  On a server, import it from `@sphynxoid/stepwise/core`.
- `initialTrace` (0.6+) takes a trace computed ahead of time (`precompute`,
  section 9): while the input (by content) and the seed match it, the hook
  plays it without running the simulation. It matches on input and seed
  only, not on the simulation's identity or `maxSteps`. An input change
  recomputes as usual.

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
  gives `.simulation` (run it over a word: one step per symbol),
  `.graph` (draw it) and `.delta(from, on)`. Pass no type arguments: the
  symbols are inferred from the edges and the node ids from `nodes`, so an
  unknown node is a type error (`fromGraph<Sym>(...)` leaves ids as `string`). Use `useWalk(dfa.simulation, word, { anchor: "index" })`
  so editing the word keeps the position.
- `walk.lastChange` (`diffTraces`) says which steps an edit changed.

## 9. Authoring kit (experimental)

An explainer from a definition, a view and one tag, usable from TSX and MDX.
Three small files beside the simulation, each on its own side of the
server/client line: the definition (`<name>.explainer.ts`), the client view
(`<name>-player.tsx`) and the wrapper the page imports (`<name>.tsx`). Keep
`.server.` out of the names: Remix and React Router treat `*.server.*` files
as server-only modules.

```ts
// sorting.explainer.ts: the definition. A plain module (no "use client"),
// so a server can run it and the client can re-run it on edits.
import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";

export type SortInput = { arr: number[] };
export type Frame = StepwiseStep<{ kind: "start" | "compare" | "swap" | "keep" | "done"; arr: number[] }>;

const bubble: Simulation<SortInput, Frame> = function* ({ arr }) {
  const a = [...arr];
  yield { key: "start", kind: "start", tone: "neutral", label: "start", arr: [...a] };
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++) {
      yield { key: `c${i}.${j}`, kind: "compare", tone: "accent", label: `compare a[${j}] and a[${j + 1}]`, arr: [...a] };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        yield { key: `s${i}.${j}`, kind: "swap", tone: "write", label: `swap a[${j}] and a[${j + 1}]`, arr: [...a] };
      } else {
        yield { key: `k${i}.${j}`, kind: "keep", tone: "neutral", label: "already in order", arr: [...a] };
      }
    }
  yield { key: "done", kind: "done", tone: "good", label: "sorted", arr: [...a] };
};

export const sorting = defineExplainer({
  name: "sorting",
  simulation: bubble,
  input: {
    default: { arr: [5, 2, 8, 1] },
    serialize: ({ arr }) => arr.join("."), // optional: puts the input in links
    parse: (s) => {
      const arr = s.split(".").map(Number);
      return arr.length >= 2 && arr.every(Number.isInteger) ? { arr } : null;
    },
  },
  predict: { // optional: pause and ask
    at: (step) => step.kind === "compare", // also gets (frame, next): stop where `next` changes something
    options: ["swap", "keep"], // bare strings get a label: "Swap", "Keep"
    truth: (next) => next?.kind, // the frame after the held one
    hint: "Is the left bar taller than the right one?",
  },
});
```

```tsx
// sorting-player.tsx: the client binding. The view takes no props.
"use client";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { sorting, type Frame, type SortInput } from "./sorting.explainer";

export function Bars() {
  const { step } = useExplainer<SortInput, Frame>();
  if (!step) return null;
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 4, height: 80 }}>
      {step.arr.map((v, i) => <div key={i} style={{ width: 16, height: v * 8, background: "currentColor" }} />)}
    </div>
  );
}

export const SortingClient = createExplainer({ definition: sorting, view: Bars });
```

```tsx
// sorting.tsx: the wrapper the page imports. No "use client".
import { precomputed } from "@sphynxoid/stepwise/kit/mdx";
import { sorting } from "./sorting.explainer";
import { SortingClient } from "./sorting-player";

export const Sorting = precomputed(sorting, SortingClient);
```

Then, in a server component or an MDX file:

```mdx
import { Sorting } from "@/components/sorting";

<Sorting id="intro" />

<Sorting id="quiz" arr={[3, 1, 2]} predict>
  <Stage />
  <Narration />
  <PredictToggle />
  <Predict>Swap these two, or keep them?</Predict>
  <ExplainerBar />
  <EndNote>Sorted. Try your own numbers.</EndNote>
</Sorting>
```

MDX can't call functions, so `createExplainer` and `precomputed` live in the
`.ts(x)` files and MDX only renders tags. The parts (`Stage`, `Narration`,
...) come from the MDX component map: spread `stepwiseComponents` into
`mdx-components.tsx` (Next.js App Router):

```tsx
import type { MDXComponents } from "mdx/types";
import { stepwiseComponents } from "@sphynxoid/stepwise/kit/mdx";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...stepwiseComponents, ...components };
}
```

`stepwiseComponents` is `Term`, `GlossaryAppendix`, `Stage`, `Narration`,
`StepCode`, `Predict`, `PredictToggle`, `ExplainerBar` and `EndNote`. Your
explainers are not in it: import them in the MDX file or add them to the map.
In TSX, import the parts from `@sphynxoid/stepwise/kit`.

**What `precomputed` buys, exactly.** In a server-rendering host, a client
component is server-rendered anyway, so the first frame is in the HTML with
or without `precomputed`. What it adds everywhere: a simulation that throws,
hits `maxSteps` or yields non-JSON data fails the build instead of the page.
Whether hydration skips the run depends on the host. In an RSC host (the
Next.js App Router) the wrapper runs only on the server: the client starts
from the passed trace and does not re-run the simulation on hydration (it
re-runs on the first input edit). In a non-RSC SSR host (Docusaurus, the
Next.js Pages Router, Remix) the wrapper itself runs again in the browser, so
the simulation runs once there too. For a run the reader never edits, a
recorded-only explainer ships no simulation code to the client, in any host:

```tsx
// sorting-replay.tsx: no definition, so no simulation in this bundle
"use client";
import { createExplainer } from "@sphynxoid/stepwise/kit";
import type { Frame, SortInput } from "./sorting.explainer";
import { Bars } from "./bars"; // the view from sorting-player.tsx, in a file that doesn't import the definition

export const SortingReplay = createExplainer<SortInput, Frame>({ view: Bars });
```

```tsx
// page.tsx (server)
import { precompute } from "@sphynxoid/stepwise/core";
import { sorting } from "./sorting.explainer";
import { SortingReplay } from "./sorting-replay";

const trace = precompute(sorting); // or precompute(sorting, { arr: [4, 3, 2, 1] })

export default function Page() {
  return <SortingReplay trace={trace} />;
}
```

Explainer props (all optional):

- `id`: namespaces the hash keys (`intro.frame`, `intro.in`). Give every
  explainer on a page its own; two linked explainers without distinct ids
  write the same keys, and development builds warn once.
- `link` (default true): keep the frame in the URL hash, and the input too
  when the definition has `serialize` and `parse`. `link={false}` opts out.
- `autoPlay` (default **false**), `keys` (default true), `theme`,
  `className`, `children` (replaces the default layout: `Stage`, `Narration`,
  `Choices`, `Predict`, `StepCode`, `ExplainerBar`, `EndNote`).
- `predict`: start in predict mode. The reader owns it after mount
  (`PredictToggle`).
- Input: `input={...}` replaces the whole input; for a plain-object default,
  a prop named after one of its own keys overrides that field
  (`arr={[3, 1, 2]}` above). Input props are read once, at mount; after that
  the reader's edits own the input. `undefined` means "use the default", so
  it can't be passed as a real input.
- Field props are typed from the default input (`arr` is `number[]` above,
  optional), on the `createExplainer` component and on the `precomputed`
  wrapper alike; an unknown or misspelled prop (`autoplay`) is a type error.
  A field named like a reserved prop (`id`, `input`, `predict`, `keys`,
  `link`, `autoPlay`, `theme`, `className`, `children`, `trace`,
  `definition`, `view`; the list is `EXPLAINER_PROP_NAMES` in `./core`) is
  never read from a prop: `<X id="a" />` is the hash namespace even when the
  input has an `id` field. Override such a field with `input={...}`.

Behaviour worth knowing:

- `precompute` and `precomputed` reject a non-JSON input as well as non-JSON
  steps (NaN, Infinity, a Map, a Date, a class instance, a function, a cycle,
  an `undefined` inside an array), with an error naming the definition and
  the path:
  `[stepwise] precompute("sorting"): input.arr[1] is not JSON-serializable (undefined)`.
  Cyclic values report kind `cycle`. An
  `undefined` object field is fine (JSON drops it).
- Keyboard: ArrowRight, ArrowLeft and Space go to the explainer the reader
  last clicked or focused. Until the reader clicks or focuses one, none takes
  the keys (Space scrolls the page), and the same after the active one
  unmounts. An explainer with `keys={false}` takes no part: clicking it
  leaves the keys where they were.
- Before playback starts, frame 0 is already on screen, so the first Next
  (or ArrowRight) shows frame 1.
- Predict mode holds **autoplay** only, at frames where `at` is true; manual
  steps and seeks are never blocked. The answer is graded against the frame
  after the held one (`truth(next, held)`), so a checkpoint on a frame with no
  successor is skipped: playback doesn't hold there. The `hint` is appended to `feedback` after two failed
  attempts (there is no separate hint field). The guess, the verdict and the
  attempts reset at each new held frame, and when the trace changes while
  held.
- `Stage` takes no props; `Narration`, `StepCode`, `ExplainerBar` take a
  `className`; `EndNote`, `Predict` and `PredictToggle` also take children
  (the note, the question, the switch's label; defaults "End of the run.
  Play to replay.", "What happens next?", "Predict mode").
- Custom parts read the provider: `useExplainer<Input, Step>()` returns
  `{ step, input, setInput, editable, error, truncated, sim, predict, walk, id, theme }`.
  `step` is frame 0 before playback; `sim` is the player with `steps`: the
  `useSimulation` result for a live explainer, the `useTrace` result plus
  `steps` for a recorded one (`sim.player` for your own controls either way);
  `setInput` is a no-op with a development warning on a recorded-only
  explainer.
- `error` is what the simulation threw (the trace keeps the steps before it)
  and `truncated` is true when `maxSteps` cut the run; both are `null` /
  `false` for a recorded explainer. Development builds also log a throwing
  simulation once: `[stepwise] sorting: the simulation threw: <message>`.
- Pass `theme` as a module constant (or memoize it): an object literal
  created per render re-renders every part.
- The kit's components need styling like the rest (`styles.css` or the
  Tailwind `@source` line).

**Walk explainers** (0.6+). A definition can hold a `walk` instead of a
`simulation`: the run stops at every `await: true` step until the reader
picks a choice. The kit links the choices (`#<id>.path=a.b`), and
`precompute` / `precomputed` work unchanged (the server ships the walk up to
its first choice point).

```ts
// maze.explainer.ts (no "use client")
import { defineExplainer, type WalkSimulation, type WalkStep } from "@sphynxoid/stepwise/core";

type Turn = "left" | "right";
type Room = WalkStep & { key: string; tone: "neutral" | "good"; label: string };

const maze: WalkSimulation<null, Room, Turn> = function* () {
  const first = yield { key: "hall", tone: "neutral", label: "A fork. Which way?", await: true };
  yield { key: `room.${first}`, tone: "good", label: `You went ${first}.` };
};

export const mazeExplainer = defineExplainer({
  name: "maze",
  walk: maze,
  choose: { options: ["left", { value: "right", label: "Right" }] }, // checked against Turn
});
```

- A walk explainer's `ExplainerBar` has no Play button (`controls="step"`:
  ← scrubber →), and Space is left to the page; `<ExplainerBar controls="full" />`
  brings Play back. A plain `PlayerBar` takes the same `controls` prop.
- `Choices` renders the options (buttons, disabled off a choice point, the
  answer given there pressed); the default layout includes it. Children are
  a visible prompt, `label` the group's accessible name.
- `useExplainer().walk` is `{ choices, choose, choiceAt, asking, awaiting, options }`
  (`null` for a simulation). A different answer at an earlier choice point
  cuts off the old future and replays from there.
- `choose.options` can be a function of the step; `choose.parse` checks a
  linked choice (default: one of the options when they are a list).
- No `predict` on a walk (a type error): the choices are the question.

**Step parts outside an explainer** (0.6+). `Narration`, `StepCode`,
`ExplainerBar` and `EndNote` only need a step and a player, so they also
work around a plain `useTrace` / `useSimulation` / `useWalk`:

```tsx
"use client";
import { useTrace } from "@sphynxoid/stepwise";
import { ExplainerBar, Narration, StepParts } from "@sphynxoid/stepwise/kit";

const STEPS = [
  { tone: "neutral" as const, label: "First" },
  { tone: "good" as const, label: "Second" },
];

export function Walkthrough() {
  const trace = useTrace(STEPS);
  return (
    <StepParts source={trace}>
      <Narration />
      <ExplainerBar />
    </StepParts>
  );
}
```

A custom part that only needs the step should read `useStepParts()`, not
`useExplainer()`: it then works in both places. `Stage`, `Predict` and
`Choices` still need an explainer.

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
14. `runSimulation` / `createTrace` / `precompute` imported from the root entry in a server component or build script → import them from `@sphynxoid/stepwise/core`.
15. An input field named `id` (or another reserved prop name) passed as a prop → it sets the prop, not the field; use `input={...}`. The kit's `autoPlay` defaults to false.
16. Two explainers on a page without distinct `id`s → they share `#frame=` / `#in=`; give each an `id`.
17. An explainer with nothing to edit → leave `input` out of `defineExplainer` (the input is `null`); don't invent a placeholder field.
18. A seed the reader should change or link → make it an input field (`{ seed: 7 }`) and seed `createRng` from it; `definition.seed` is fixed per definition.
19. A kit-style page around a plain player that rebuilds the narration line and the bar by hand → wrap it in `<StepParts source={trace}>` and use the parts.
20. A walk on `useWalk` that wants the kit's links, keys and precomputing → `defineExplainer({ walk, choose: { options } })` and `<Choices />` in the view.
