# @sphynx/stepwise

A kit for interactive, narrated, step-driven visualizations — one primitive (`useSteps`) at every scale.

Frames in a trace, chapters in a lesson, lessons in a notebook, and tour steps are the same thing at the core: a clamped cursor over an ordered sequence. Timers, tour effects, scroll tracking, and third-party presenters are policies and adapters layered on top.

- **Headless core.** The hooks never render; the styled components are optional and theme-injectable.
- **One dependency by default.** The root barrel needs only React. GSAP and driver.js integrations are opt-in via adapter subpaths.

## Install

```bash
npm install @sphynx/stepwise
```

Optional adapters (install only what you use):

```bash
npm install gsap        # @sphynx/stepwise/adapters/gsap
npm install driver.js   # @sphynx/stepwise/adapters/driver-js
# @sphynx/stepwise/adapters/scroll is dependency-free
```

## Required: Tailwind CSS setup

The styled components ship **className strings**. Tailwind v4's automatic
content detection skips `node_modules`, so **no library class gets generated**
unless you register the source. Without this, every library element renders
completely unstyled.

```css
@import "tailwindcss";
@source "../node_modules/@sphynx/stepwise/src";
```

Components are also fully usable without Tailwind if you bring your own
presentation — the hooks are headless.

## Quick start — a narrated player

```tsx
"use client";
import { useStepPlayer, PlayerBar, CodeBlock, type StepTone } from "@sphynx/stepwise";

const frames: { tone: StepTone; label: string; code: string[] }[] = [
  { tone: "write", label: "Initialize", code: ["let i = 0;"] },
  { tone: "neutral", label: "Loop", code: ["while (i < n) { … }"] },
  { tone: "good", label: "Done", code: ["return arr;"] },
];

export function Demo() {
  const player = useStepPlayer({ total: frames.length, autoPlay: true, syncHash: "frame" });
  const frame = frames[Math.max(0, player.index)] ?? frames[0];

  return (
    <>
      <CodeBlock lines={frame.code} />
      <PlayerBar player={player} toneAt={(i) => frames[i]?.tone ?? "neutral"} titleAt={(i) => frames[i]?.label ?? ""} />
    </>
  );
}
```

`useStepPlayer` gives you a timer-driven playhead with play/pause/seek, speed control, and optional `#frame=2` deep links — or hand it an `engine` to drive the playhead from GSAP or scroll instead. Two end-state flavors: `atEnd` (cursor parked on the last frame, seeks included) and `ended` (playback ran to the finish, via the `onEnd` callback option) — clearing on any cursor movement, so a completion summary knows the demo actually finished.

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
- `GlossaryProvider` / `Term` / `GlossaryAppendix` — recursive, depth-capped term tooltips with an auto-collecting appendix
- `ShortcutsDialog` — keyboard shortcut reference
- `defaultTheme` / `StepwiseTheme` — the default styling, overridable per component via a `theme` prop (swap in any design system)

## Adapters

Import adapters from their subpaths — never from the root barrel:

```ts
import { createGsapPlayerEngine } from "@sphynx/stepwise/adapters/gsap";
import { createDriverJsTourDriver } from "@sphynx/stepwise/adapters/driver-js";
import { createScrollPlayerEngine } from "@sphynx/stepwise/adapters/scroll";
```

An adapter plugs into a tiny port (`PlayerEngine` / `TourDriver`), so you can write your own for Shepherd, Framer Motion, or anything else without touching the kit.

## React

Supports React 18 and 19. All hooks are SSR-safe (`"use client"` modules, no window access at module evaluation) and every public hook returns referentially stable callbacks.

## License

MIT
