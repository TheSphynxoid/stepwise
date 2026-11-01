# @sphynxoid/stepwise

**Interactive explainers for React: step-through players, guided tours, scroll-driven lessons and glossary tooltips, all on one cursor.**

**[Live demos](https://stepwise.thesphynx.net)** · [API reference](https://stepwise.thesphynx.net/docs) · [StackBlitz starter](https://stackblitz.com/github/TheSphynxoid/stepwise/tree/master/examples/vite-starter) · [GitHub](https://github.com/TheSphynxoid/stepwise)

<img src="https://raw.githubusercontent.com/TheSphynxoid/stepwise/master/docs/assets/hero.gif" alt="A quicksort trace playing in a stepwise PlayerBar: bars swap as the partition advances; partway through, two bars are clicked and change height, the sort re-runs on the new input and the player stays on the same step" width="516">

Frames in a trace, chapters in a lesson, lessons in a notebook, and tour steps are the same thing at the core: a clamped cursor over an ordered sequence. Timers, tour effects, scroll tracking, and third-party presenters are policies and adapters layered on top.

- **Headless core.** The hooks never render; the styled components are optional and theme-injectable.
- **One dependency by default.** The root barrel needs only React. GSAP and driver.js integrations are opt-in via adapter subpaths.

## Install

```bash
npm install @sphynxoid/stepwise
```

Optional adapters (install only what you use):

```bash
npm install gsap        # @sphynxoid/stepwise/adapters/gsap
npm install driver.js   # @sphynxoid/stepwise/adapters/driver-js
# @sphynxoid/stepwise/adapters/scroll is dependency-free
```

The package is **ESM only** (no `require` export): bundlers, Next.js, Vite and Node ESM are fine; a CommonJS script needs `await import("@sphynxoid/stepwise")`.

**Using an AI assistant?** The package ships [`LLMS.md`](https://github.com/TheSphynxoid/stepwise/blob/master/packages/stepwise/LLMS.md), a compact usage guide with the patterns and pitfalls (also at [stepwise.thesphynx.net/llms-full.txt](https://stepwise.thesphynx.net/llms-full.txt)). Point your assistant at it: the library is newer than most models' training data.

## Styling — pick one

The hooks are headless. The styled components (`PlayerBar`, `TourCard`, `Term`, …) ship Tailwind class strings, and there are three ways to get them styled:

**1. No Tailwind — import the precompiled stylesheet** (once, at your app entry):

```ts
import "@sphynxoid/stepwise/styles.css";
```

It contains exactly the CSS the components use, no global reset (a small preflight is scoped to the components' `[data-stepwise]` roots), and light/dark defaults that follow `prefers-color-scheme` or a `.dark` / `[data-theme="dark"]` switch. Re-color it with CSS variables:

```css
:root {
  --stepwise-primary: #7c3aed;      /* play button, active segment, rings */
  --stepwise-accent: #0ea5e9;       /* "accent" tone, links, wait hints */
}
```

Tokens: `--stepwise-background`, `-foreground`, `-card`, `-popover`, `-primary`, `-primary-foreground`, `-accent`, `-destructive`, `-ring`, `-shade` (overlay/code-block tint).

**2. Tailwind + shadcn/ui — copy the components in with the shadcn CLI:**

```bash
npx shadcn@latest add https://stepwise.thesphynx.net/r/player-bar.json
```

Items: `player-bar`, `code-block`, `tour`, `glossary`, `chapter-nav`, `lesson-pager`, `shortcuts-dialog` — or `stepwise` for all of them. The presentation source lands in `components/stepwise/` (plus `lib/stepwise-theme.ts`), where Tailwind scans it automatically; hooks and types stay imported from this package. Colors come from your shadcn tokens.

**3. Tailwind, using the components from npm** — register the package so Tailwind generates its classes (v4 skips `node_modules`):

```css
@import "tailwindcss";
@source "../node_modules/@sphynxoid/stepwise/dist";
```

Token contract, Tailwind v3 setup and the "everything renders unstyled" checklist: [TAILWIND-SETUP.md](https://github.com/TheSphynxoid/stepwise/blob/master/docs/TAILWIND-SETUP.md).

## Quick start — a narrated player

```tsx
"use client";
import { useTrace, PlayerBar, CodeBlock, type StepwiseStep } from "@sphynxoid/stepwise";

// Your domain payload rides along with the presentation fields.
const frames: StepwiseStep<{ code: string[] }>[] = [
  { tone: "write", label: "Initialize", code: ["let i = 0;"] },
  { tone: "neutral", label: "Loop", code: ["while (i < n) { … }"] },
  { tone: "good", label: "Done", code: ["return arr;"] },
];

export function Demo() {
  const trace = useTrace(frames, { autoPlay: true, syncHash: "frame" });

  return (
    <>
      <CodeBlock lines={trace.step!.code} />
      <PlayerBar player={trace.player} toneAt={trace.toneAt} titleAt={trace.titleAt} />
    </>
  );
}
```

`useTrace` binds a player to a typed trace: `step` is the frame to render (frame 0 before playback starts), and `toneAt` / `titleAt` feed the scrubber. Under it, `useStepPlayer` gives you a timer-driven playhead with play/pause/seek, speed control, and optional `#frame=2` deep links — or hand it an `engine` to drive the playhead from GSAP or scroll instead. Two end-state flavors: `atEnd` (cursor parked on the last frame, seeks included) and `ended` (playback ran to the finish, via the `onEnd` callback option) — clearing on any cursor movement, so a completion summary knows the demo actually finished. `autoPlay` respects `prefers-reduced-motion` (lands on frame 0, paused; opt out with `respectReducedMotion: false`), and `syncHash` writes only its own key, so it coexists with anchors and other players' keys.

## Live simulations

A trace doesn't have to be recorded by hand. Write the algorithm as a generator, give each step a `key` naming its moment, and `useSimulation` reruns it whenever the input changes, keeping the playhead on the same moment (mid-playback too):

```tsx
import { useSimulation, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise";

type Frame = StepwiseStep<{ arr: number[] }>;

const shuffleThenSort: Simulation<number[], Frame> = function* (input, { rng }) {
  const a = rng.shuffle(input);             // seeded: same input + seed → same trace
  yield { key: "shuffled", tone: "neutral", label: "shuffled", arr: a };
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      yield { key: `swap ${i}.${j}`, tone: "write", label: `swap at ${j}`, arr: [...a] };
    }
  }
};

const sim = useSimulation(shuffleThenSort, input, { seed: 7, autoPlay: true, syncHash: "frame" });
// sim.step, sim.player, sim.toneAt, sim.titleAt: like useTrace, plus sim.steps / truncated / error
```

How re-anchoring decides: walk back from the old position to the latest step whose key exists in the new trace, and land there (`reanchor` is exported for custom players). `runSimulation` is the pure, server-safe runner, with a `maxSteps` cap so a runaway generator can't hang the page.

Keep an object input in state or `useMemo`: `useSimulation(sim, { arr, target })` written inline is a new object every render, so the trace is recomputed every render (development builds warn).

### Shareable links: put the input in the URL too

`syncHash` puts the frame in the URL; `syncInput` adds the input, so a copied link replays the exact run. You keep owning the input state; the library restores it on mount and applies the linked frame to the trace computed from it (not to the default input's):

```tsx
const [input, setInput] = useState([5, 2, 8, 1]);
const sim = useSimulation(insertionSort, input, {
  syncHash: "frame",                               // #frame=12
  syncInput: {
    key: "in",                                     // #in=5.2.8.1
    serialize: (a) => a.join("."),
    parse: (s) => {                                // null = ignore a malformed link
      const a = s.split(".").map(Number);
      return a.every(Number.isInteger) ? a : null;
    },
    onRestore: setInput,
  },
});
```

## Following a live timeline

When frames arrive while the reader watches (a log, a stream, an agent's steps, a game's moves), add `follow`: a reader at the edge keeps playing into new frames at the normal pace, and one who scrubbed back to inspect something stays there until they choose to return.

```tsx
const trace = useTrace(events, { autoPlay: true, follow: true }); // events grows over time
// trace.player.live: at the edge?  trace.player.goLive(): back to it
<PlayerBar player={trace.player} toneAt={trace.toneAt} titleAt={trace.titleAt} live />
```

`PlayerBar live` shows "Live" at the edge and "Go live +N" when the reader is behind. Checkpoints still hold, and with reduced motion nothing starts on its own.

## Checkpoints and evaluators

Pause autoplay where the reader should think, then grade their answer:

```tsx
const sim = useSimulation(sort, input, {
  autoPlay: true,
  holdAt: (_, step) => step?.kind === "compare",   // autoplay stops here; player.held is set
});

const answer = useEvaluator(
  (guess: "swap" | "keep" | null) =>
    guess === truth ? pass("Right!") : fail("Compare the two highlighted bars."),
  guess,
  { mode: "manual" }                                // judge on check(); "auto" judges every change
);
// <button onClick={answer.check}>Check</button> {answer.feedback}
// {answer.passed && <button onClick={sim.player.release}>Continue</button>}
```

An `Evaluator` returns a boolean, a `Verdict` (`pass(feedback)`, `fail(feedback)`, `pending()`), or a promise of either; async checks report `pending`, and stale results are dropped. Tour gates accept verdicts too: anything but pass blocks Next, and `tour.feedback` (→ `TourCard feedback`) tells the reader what's missing.

Things worth knowing before you build one:

- **A held checkpoint doesn't resume on its own.** Call `player.release()` (your Continue button), or the reader presses play.
- **The truth is usually the next frame**: `const truth = sim.steps[player.held + 1]?.kind`. Phrase the question so every possible next frame is an answer option (binary search can also *find* the target, so "left, right, or found?").
- **Manual mode clears the verdict when `ctx` changes** (a new guess), but keeps `attempts`, since it's still the same question. When the question changes, reset it: `useEffect(() => { setGuess(null); answer.reset(); }, [player.held])`.

## The three scales

| Scale | Hook | Presentation |
|---|---|---|
| **Player** — auto-played frames in a trace | `useStepPlayer` (+ `PlayerEngine` adapters) | `PlayerBar`, `StepScrubber`, `CodeBlock` |
| **Tour** — steps that mutate app state via `onEnter` | `useGuidedTour` (+ `TourDriver` adapters) | `TourSpotlight`, `TourCard` |
| **Chapters** — scroll-tracked sections | `useChapters`, `flattenChapters` | `ChapterNav`, `LessonPager` |

All three compose the same `useSteps` cursor, so movement, clamping, and boundary flags behave identically everywhere.

Tours are small state machines: a step may declare `when` (skip on arrival when false), `gate` (block `next()` — and expose `blocked` — until the user actually does the thing), and `next` (edge override to another step's `id`, enabling branches and loops). `gotoId(id)` navigates by identity; programmatic navigation never trips gates.

## Show-once tutorials (led discovery)

Pair `useDiscoveries` with `useGuidedTour` to auto-play a tour the first time a user encounters a feature:

```tsx
const { discovered, ready, markDiscovered } = useDiscoveries();
const tour = useGuidedTour(steps);

// when this build carries an undiscovered feature, play its tour once
useEffect(() => {
  if (ready && !tour.active && !discovered.has("search:v1")) tour.start();
}, [ready, tour.active, discovered]);

// mark on completion (or explicit dismiss) — never on mere trigger
useEffect(() => {
  if (launched && !tour.active) markDiscovered("search:v1");
}, [tour.active]);
```

The ledger is a set of opaque ids behind a `DiscoveryStore` seam: `localStorageStore` (default), `cookieStore` (when SSR markup must know), `memoryStore` (tests), or your own store backed by an API for cross-device discovery.

## Supporting pieces

- `useGlobalKeys` — global keyboard bindings with a form-control guard
- `useFocusTrap` — dialog/tour focus containment
- `usePrefersReducedMotion` — motion preference gate
- `useDiscoveries` (+ `localStorageStore` / `cookieStore` / `memoryStore`) — persisted discovery ledger with a swappable storage seam
- `GlossaryProvider` / `Term` / `GlossaryAppendix` — recursive, depth-capped term tooltips with an auto-collecting appendix. Every `Term` and the appendix must sit inside the provider (in MDX, wrap the rendered article); the entry type is `import type { GlossaryEntry }`
- `CodeBlock` — monospace lines with `//` comments dimmed; `lines` is optional, so `<CodeBlock lines={step.code} />` just works
- `ShortcutsDialog` — keyboard shortcut reference
- `readHashParam` / `writeHashParam` — the `#a=1&b=2` fragment format `syncHash` uses, for keeping your own state next to it
- `TONE_CHIP_CLASS` / `TONE_SEGMENT_CLASS` — the default per-tone classes, for your own badges that match the scrubber
- `defaultTheme` / `StepwiseTheme` — the default styling, overridable per component via a `theme` prop (swap in any design system)

## Recipes

Longer how-tos live in [docs/RECIPES.md](https://github.com/TheSphynxoid/stepwise/blob/master/docs/RECIPES.md): an interactive article in **Next.js + MDX** (full example in [`examples/next-mdx`](https://github.com/TheSphynxoid/stepwise/tree/master/examples/next-mdx)), shareable links, grading a checkpoint, and testing a stepwise page.

## Testing

- **Unit-test the trace, not the UI**: `runSimulation(sim, input).steps` is plain data, so assert keys and labels in any test runner, no DOM needed.
- **In browser tests, prefer `data-testid` on your own elements.** A playing player re-renders every tick, and accessible-name locators that wait for stability can stall on it.
- **Test linked URLs with reduced motion on** (e.g. Playwright `emulateMedia({ reducedMotion: "reduce" })`): autoplay then stays paused on the linked frame, so assertions don't race the timer.

## Adapters

Import adapters from their subpaths — never from the root barrel:

```ts
import { createGsapPlayerEngine } from "@sphynxoid/stepwise/adapters/gsap";
import { createDriverJsTourDriver } from "@sphynxoid/stepwise/adapters/driver-js";
import { createScrollPlayerEngine } from "@sphynxoid/stepwise/adapters/scroll";
```

An adapter plugs into a tiny port (`PlayerEngine` / `TourDriver`), so you can write your own for Shepherd, Framer Motion, or anything else without touching the kit.

## React

Supports React 18 and 19. All hooks are SSR-safe (`"use client"` modules, no window access at module evaluation) and every public hook returns referentially stable callbacks.

## License

MIT
