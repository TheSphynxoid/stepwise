# Architecture

How stepwise is built, and — more importantly — **why** each piece is shaped
the way it is. Every "why" below traces back to a concrete bug or requirement
from real use (the portfolio notebooks and the demo site).

## The idea

Everything interactive here reduces to **a clamped cursor over an ordered
sequence**. A player's frames, a lesson's chapters, a notebook's lessons, a
tour's steps: same cursor, different policies around it. So the library has
exactly one core primitive (`useSteps`) and everything else composes it:

```
                 ┌──────────────────────────────────────────┐
                 │  core: useSteps(count | items)           │
                 │  cursor, next/prev/go, boundary flags    │
                 │  stable callbacks · re-clamps on count   │
                 └───────┬──────────────┬──────────────┬────┘
                         │              │              │
        ┌────────────────┘              │              └───────────────┐
        ▼                               ▼                              ▼
 use-step-player                 use-guided-tour                use-chapters
 timer · speed · seek            onEnter effects                scroll → cursor
 #hash deep-link                 driver show/hide               center containment
 engine port ──────────────┐     tour port ───────────┐        smooth goTo
                           ▼                            ▼
                    adapters/gsap.ts            adapters/driver-js.ts
                    adapters/scroll.ts          (third-party presenters)
```

Presentation (`components.tsx`, `glossary.tsx`) is a thin styled layer over
the hooks; a host can replace any of it via the `theme` / `labels` props.

## The model

A loose formal model of the simulation and walk layers. Each line is kept
because it explains a rule the code already has to follow.

1. **Input.** `I = (x₁, …, xₙ)`: opaque values with a chosen equality (and
   optionally an order). It may arrive along the run as `I(k)`: edits,
   streamed events, the reader's choices. Two inputs are equal when their
   components are, value by value.
   → *Equality inside one input is not identity*: two equal values are still
   different components, so step keys come from positions, never values.
2. **A run.** `sw = (f, I, σ)`, where `σ` is the seed and the step cap, and
   states are a scan: `s₀ = σ`, `s_{k+1} = f(I(k), s_k)`. The trace keeps
   every state.
   → The state may change, but every trace entry must be an unchangeable
   snapshot: yield copies (`[...arr]`), or every frame shows the final state.
3. **Identity.** Two runs are the same iff `(f, I, σ)` are equal. Re-runs,
   links and caching all use this.
   → Rerun iff the input changed; the code compares by reference, which is
   why the rebuilt-input warning exists. A link is a run's identity
   serialized: `#in=…` (plus the choices, for a walk) and a frame.
4. **The player.** `δ(s, action) → s′` over actions `{ tick, next, prev,
   seek k, release, … }`: a guard (the evaluator; `holdAt` blocks `tick`)
   followed by a move. Steps are identified by key; re-anchoring maps a key
   from the old trace to the new one.
5. **Transitions.** An evaluator's verdict (or any choice) picks the edge,
   so the possible steps form a graph and a run is a path through it. The
   scrubber shows the path, which keeps it linear; every node carries its
   full state, so any position is restorable without undo logic. Going
   back and choosing differently truncates the old future; graph nodes are
   identified by key (paths may merge and loop), steps on the path by
   position.

## Module map

| Module | Responsibility | Notes |
|---|---|---|
| `types.ts` | The trace contract: `StepTone`, `StepwiseStep`, `TourStepInput`, `Chapter`, `ShortcutItem`; ports `PlayerEngine` / `PlayerEngineHandle` / `TourDriver` | Definitions may embed `ReactNode` (glossary chains, tour bodies) |
| `use-steps.ts` | THE core. Clamped cursor; `go/next/prev/first`; `atStart/atEnd/canNext/canPrev`; `onChange` | All callbacks referentially stable via refs; count may change dynamically (new timeline, mounted window) and the cursor re-clamps |
| `use-step-player.ts` | Player policy: base delay, speed multiplier, play/pause/seek/replay, `syncHash` deep-link, engine port, reduced-motion autoPlay gate | `frame` is the raw counter (**-1 = not started**); `index` clamps into `[0, total-1]`, -1 when nothing to show. Controls read live state through refs, so they never change identity. `syncHash` edits only its own `key=value` part of the `&`-separated fragment |
| `use-trace.ts` | A player bound to a typed `StepwiseStep<Data>[]`: `step`, `frame`, stable `toneAt`/`titleAt`; keyed re-anchoring when `steps` changes | Encodes invariant "-1 renders frame 0" once, so pages don't repeat the fallback. See "re-anchoring" below |
| `reanchor.ts` | The pure re-anchoring rule (+ default `stepKey`) | Exported for custom players |
| `core.ts` | The `./core` entry: re-exports every pure module and the schema | No `"use client"`, no React at runtime. The only way client modules reach pure code (see "The core/client boundary") |
| `simulation.ts` | `createRng` (seeded mulberry32), `runSimulation` (pure, capped), the `Simulation` type | No React; safe at module scope. On a server, reached through `./core` |
| `use-simulation.ts` | `useSimulation`: memoized `runSimulation` → `useTrace`; `initialTrace` | Recomputes on `simulation` / `input` / `seed` / `maxSteps` identity. With `initialTrace`, an input equal by content (JSON) and a matching seed return the precomputed steps instead of running. The match is on input and seed only, not on the simulation's identity or `maxSteps` |
| `explainer.ts` | **Experimental.** `defineExplainer`, `precompute` (run to a JSON-checked trace), `resolveInput`, `normalizeOptions`, `assertJsonInput` | Pure; part of `./core` |
| `kit/*` | **Experimental.** `./kit`: `Explainer` / `createExplainer` / `useExplainer`, the parts, `StepParts`, walk explainers and `Choices`, predict mode, the keyboard registry. `./kit/mdx`: `precomputed`, `stepwiseComponents` | See "The authoring kit" below |
| `use-run-links.ts` | Internal: a run's identity in the URL hash (input, choices) restored before the linked frame; shared by `useSimulation` and `useWalk` | See "linked inputs" below |
| `walk.ts` / `use-walk.ts` | **Experimental.** `runWalk` (pure replay of input + choices), `useWalk` (`choose`, `anchor`, `lastChange`, `syncChoices`) | See "branching walks" below |
| `graph.ts` | **Experimental.** `fromGraph`: a declared automaton, run over a word and drawable | Steps keyed by position |
| `diff-traces.ts` | **Experimental.** `diffTraces` / `structuralEqual`: what an edit changed between two runs | Pure |
| `evaluate.ts` / `use-evaluator.ts` | `Verdict`, `Evaluator`, `pass`/`fail`/`pending`/`toVerdict`; `useEvaluator` (auto/manual, async with abort) | Tour gates accept verdicts; `TourCard feedback` renders them |
| `create-trace.ts` | `createTrace<Data>()` → `.step()` / `.length` / `.last()` / `.build()` | Pure data; `build()` snapshots. Replaces the module-scope IIFE pattern (invariant 6) |
| `align-tracks.ts` / `use-synced-tracks.ts` | Comparison mode: `alignTracks` (pure, in its own module so `./core` can carry it) + `useSyncedTracks` (one player over the aligned table, per-track `TrackView`) | Alignment memoized by shallow track-array identity, so `{ a, b }` literals are fine; `toneAt`/`titleAt` summarize the tracks that moved |
| `use-guided-tour.ts` | Tour policy: start/end/goto, `onEnter` per step, optional driver | `onEnter` reads latest steps via ref — closures stay fresh without re-triggering effects; `next` past the end exits |
| `use-chapters.ts` | Scroll-driven cursor + smooth `goTo` | See "scroll tracking" below |
| `use-lesson-stream.ts` | Windowed notebook reader: mounted window, approach loading, prepend compensation, center-tracked active lesson; `useFadeIn` | See "lesson stream" below; composes `useSteps` like `useChapters` |
| `flatten.ts` | Depth-first flattening of the `Chapter` tree → `FlatChapter[]` with `depth`, `rootIndex`, `parentIndex` | `rootIndex` powers the scrubber's grouped spans; parent/child indices power recursive nav |
| `use-global-keys.ts` | Window-level key map with a form-control guard and `enabled` gate | Arrow keys in an `<input>` don't hijack the player |
| `use-focus-trap.ts` | Tab containment for the tour card, focus on activate, restore on release | `offsetParent` filter skips hidden focusables |
| `use-prefers-reduced-motion.ts` | `prefers-reduced-motion` gate, SSR-safe | Stream fades and smooth scrolls consult it |
| `theme.ts` | `StepwiseTheme`: records of Tailwind class strings per tone | Default references semantic CSS vars (`--color-*`, `bg-popover`) — the host injects values; the light-theme `/minimal` demo proves injection |
| `components.tsx` | `StepButton`, `CodeBlock`, `StepScrubber`, `PlayerBar`, `ChapterNav`, `LessonPager`, `TourSpotlight`, `TourCard`, `ShortcutsDialog` | All styling flows through `cn()` + `theme` |
| `glossary.tsx` | `GlossaryProvider` / `Term` / `GlossaryAppendix` | See "glossary system" below |
| `adapters/*.ts` | `createGsapPlayerEngine`, `createDriverJsTourDriver`, `createScrollPlayerEngine` | Optional peers; external in tsup; devDeps only for DTS |

## Ports (inversion of control)

**`PlayerEngine`** — who drives the frames? Usually the built-in timer, but a
GSAP tween or a scroll position can own pacing instead. The engine connects
with a handle (`{ get total, onFrame, onPlayStateChange }`) and returns a
narrow api (`play/pause/seek/rate`). `useStepPlayer` reconnects only when the
engine *identity* changes — engines must be `useMemo`'d by consumers.

**`TourDriver`** — who *presents* the tour? By default the app renders
`TourSpotlight` + `TourCard`. Pass a driver (driver.js) and the hook drives it
imperatively per step (`show/hide/update`), with the contract that **the app
must not render the built-in presentation**. This keeps step *state* in one
place while allowing any presenter.

## Algorithms worth knowing exactly

### Scroll tracking (`use-chapters.ts`)

Active chapter = **the section containing the viewport center**:

```ts
const mid = window.innerHeight / 2;
// active: rect.top <= mid && rect.bottom >= mid
```

Fallbacks, in order: deepest section whose top is above center → first
section. `goTo` uses `scrollIntoView({ block: "start" })`; sections carry CSS
`scroll-mt-*` to clear sticky headers.

**Why center-containment:** the earlier implementation advanced a chapter the
moment its *top* crossed an offset line near the viewport top — users read
that as "it advances when scrolled past, not when the chapter is at the
center". Center-containment matches reading intuition and is what the
production notebook uses.

### Track alignment (`align-tracks.ts`, `use-synced-tracks.ts`)

Comparison mode runs one input through several engines and plays the traces
under **one** cursor. `alignTracks` turns `{ name: steps[] }` into a table of
rows, each holding `{ index, held }` per track:

- **Hold** (no `key`): row *i* is step *i* of every track; a shorter track
  holds its last frame (`held: true`). Length = the longest track. This is
  what the portfolio's swiss-table did by padding with an idle step — `held`
  replaces the fake step, so payload types stay honest.
- **Sync keys** (`key(step, i, track)`): a step whose key also occurs in
  another track is a sync point. Every row, each live track advances one
  step unless its next step is a sync point some other track has not reached
  yet — then it holds. The n-th occurrence of a key pairs with the n-th
  elsewhere. If every live track is blocked (keys in conflicting order), the
  row advances them all — degrade to lockstep, never deadlock.

The hook memoizes the table by shallow identity of the track arrays (plus
key presence), reads `key` through a ref, and resolves `TrackView`s for the
current frame. Like `useTrace`, frame 0 renders before playback starts.

### Lesson stream (`use-lesson-stream.ts`)

Extracted from the portfolio's notebook reader, minus the content. The hook
owns a **window** `[first, last]` of mounted lessons (seed ± `radius`) and a
`useSteps` cursor for the active lesson; the consumer renders
`mounted.map(i => <Block ref={refFor(i)} />)`.

- One rAF-throttled scroll loop: active = mounted block containing the
  viewport center (fallback: first mounted block — *not* "deepest top above
  center", which misattributes after a route change leaves a stale scroll
  position); the window grows downward when the last block's bottom is within
  `approachBelow` of the fold, upward when the first block's top passes
  `-approachAbove`.
- **Prepend anchor:** an upward, scroll-driven expansion inserts content above
  the reader. A layout effect (before paint, before any rAF) `scrollBy`s the
  prepended height so the view does not jump. Navigation expansions are
  *not* compensated — their `scrollIntoView` is absolute and compensating
  displaced the landing. A cause ref distinguishes the two.
- **Seed landing:** one layout effect scrolls the seed into view before first
  paint (no race with a router's scroll restoration).
- **Navigation scroll** happens in an effect after the expanded window
  commits, then one rAF — not a guessed number of frames.
- The window only grows; `useFadeIn(i === seed)` fades streamed blocks in
  while the SSR'd seed stays visible.

### Scrubber grouping (`StepScrubber groupOf`)

With `groupOf(i)` supplied, consecutive segments sharing a group render inside
one wrapper whose `flex-grow` equals its unit count. A chapter with
sub-chapters therefore **spans the width of its whole subtree** and only the
active inner segment fills — the chapter visibly reads as "halfway" while its
children play. Requires group-contiguous indices, which `flattenChapters`
guarantees (depth-first order, `rootIndex` per entry).

### Glossary tooltip positioning (`glossary.tsx`)

1. Card renders **whenever `open`** (portal to `document.body`), hidden via
   `visibility` until positioned. Never gate rendering on the position being
   computed — the first measurement needs the card in the DOM.
2. A `useLayoutEffect` (before paint, no flash) measures the trigger rect and
   the card's **real** `offsetWidth/offsetHeight`, then: place below
   (`r.bottom + 8`); if `top + ch > innerHeight - 8` flip above
   (`r.top - 8 - ch`); if that's negative pin to `8`; clamp `left` inside the
   viewport. Recompute on scroll/resize, rAF-throttled.
3. Close semantics: hover intent (60ms open delay, 120ms close grace), Escape
   anywhere in the subtree, outside `pointerdown`. Depth is capped at 4 —
   mutual references (`HTTP ⇄ DNS`) terminate cleanly. Inside a
   `GlossaryAppendix`, `Term` becomes an anchor link instead of a nested
   tooltip (no infinite stacks, and the appendix is printable).

**Why "below, then flip":** the first implementation placed the card to the
*right* and clamped `top` to `innerHeight - 60` — near the viewport bottom the
card's top pinned there and its body spilled off-screen entirely, which read
as "the tooltip appears at the bottom of the page".

### Tour spotlight (`TourSpotlight`)

Portals to `<body>` after mount, like `TourCard`: rendered in place, a
filtered or transformed ancestor (a sticky header with `backdrop-blur`)
becomes the containing block of `position: fixed` and the card lands
off-screen. Polls with `requestAnimationFrame` until the target appears (targets may be
conditionally rendered), and looks it up again whenever the tracked node is
detached (a re-keyed subtree, an HTMX or Turbo swap); resolves **`getElementById(target)` first, then
`[data-tour="target"]`** (the portfolio uses the attribute; generic consumers
use ids), auto-scrolls the target to viewport center once, then tracks its
rect frame-by-frame (rounded key comparison to avoid redundant setState). The
dim is a single ring div with an inline `boxShadow: 0 0 0 9999px` spread
inside a `fixed inset-0 pointer-events-none` wrapper — one element, no
four-side overlay bookkeeping. Note the inline boxShadow overrides the
`ring-*` class (Tailwind rings are box-shadows too); the visible cutout edge
comes from the dim's negative space.

### Player state machine (`use-step-player.ts`)

`frame: -1` = not started (distinguishes "nothing loaded" from "frame 0");
`autoPlay` seeds `started/playing`; `index` clamps; `atEnd` powers the
Replay label; `toggle(onEmpty)` fires `onEmpty` when there is no timeline —
this is how "press play to build the trace" flows work. `syncHash: "frame"`
writes `#frame=N` on change and honors the initial hash once on mount
(deep-linking without history spam — `replaceState`).

Hash timing, both learned the hard way (0.3):

- The read and the write effects run in the same commit, before `go(f)`
  re-renders. The write right after a read is skipped unless the cursor
  already shows the read frame (`pendingRead`), otherwise the stale index
  lands in the URL for one commit and sibling effects restoring their own
  linked state read `frame=0`.
- The hash is read on mount, on `hashchange`, and once when the first
  non-empty timeline arrives, never on every `total` change. After a
  recompute the URL's frame describes the old trace, and if another hash
  part was just rewritten, the hash no longer equals `lastWrittenHash` and
  would look like a fresh external link.

Checkpoints (`holdAt`): the timer loop checks the frame it just reached;
if it's a checkpoint not yet released this playthrough, it sets `held` and
pauses instead of scheduling the next tick. `release()` and play-from-here
add the frame to the released set; `start()`/`reset()` clear it. Manual
moves never consult `holdAt`. Engines own their own timing, so `holdAt`
is ignored with a custom `engine`.

Following the live edge (`follow`): `live` is derived, not stored —
playing toward the edge, parked on the last frame, or (before start) waiting
to autoplay, and never while held. An effect on `total` judges liveness
against the *old* timeline (cursor on the old last frame, or playing) and
resumes playback, which re-arms a timer that paused at the old end. Nothing
else changes: a reader behind the edge is simply not resumed, `goLive()` is
a seek to the last frame, and checkpoints keep their hold because a held
player is never resumed by growth. `useTrace` takes a fast path for
appends: if the step on screen has the same key at the same index in the new
trace, nothing moves and `reanchor` isn't run.

### Re-anchoring (`use-trace.ts`, `reanchor.ts`)

When `steps` is replaced (a recomputed simulation), the playhead should
stay on the same *moment*, not the same index. The rule: walk back from
the old index to the most recent step whose key exists in the new trace
and land there; no shared key → frame 0. Walking *back* means an edit that
removes the current moment lands on the last moment both runs share,
never on something later the reader hasn't seen yet.

Mechanics: the anchored index is computed during render from `shownRef`
(what the last commit displayed), so the first frame drawn against the new
trace is already right (no flash). A layout effect then moves the player
with `jump()` (cursor only, play state untouched) and, when the anchored
index differs from the player's, forces one more render: if a sibling
effect moves the cursor back in the same commit (a page restoring a linked
frame), the player's state nets out unchanged, React bails out of the
re-render, and without the forced update the screen would stay on the
anchored frame while the player sits elsewhere. When the anchor didn't move
the cursor, the screen already shows the player's frame and nothing is
forced. Unkeyed traces skip all of this and keep index clamping.

A new array is not always a new trace. Pages that derive the timeline in
render (`BUILDS.slice(0, n)`) pass a fresh array every render; one with the
same length and, at every index, the same step object or the same key is
treated as unchanged. Re-anchoring it from `shownRef` would undo whatever
moved the player in that render (a timer tick, `goLive`), and the forced
commit would render a new array again: React's "Maximum update depth
exceeded" (#185).

### Linked inputs (`use-simulation.ts`, `syncInput`)

A shared link carries the input (`#in=`) and the frame (`#frame=`). The
order matters: the player reads `#frame=` on mount against the *default*
input's trace, where that frame may not exist (then it's ignored, and the
player's writer may even put `frame=0` in the URL). So:

1. During the first render the hook captures the hash as the page was
   opened (a ref, so no hydration mismatch), before any effect can write.
2. A mount effect parses `in` from that snapshot; if valid it remembers
   `{ input, frame }` and calls `onRestore(input)` (the caller's setter).
3. When the caller's state comes back as that exact input (identity), a
   layout effect declared after `useTrace` runs after the re-anchoring
   layout effect of the same commit and `jump`s to the linked frame.
4. Edits are written back by an effect that compares against the last
   input written or restored, not "skip the first run": under StrictMode
   the double mount would otherwise write the default over the link.
5. A link pasted into the same tab arrives as `hashchange`. The player
   re-reads its frame on that event against the current trace, so the run's
   parts are re-read too: each part whose value differs from the current one
   (compared by its serialized form) is restored, and steps 3 and 4 apply as
   on mount. A frame-only change restores nothing and stays the player's.

Values are `encodeURIComponent`-ed, so `serialize` may use any characters.
The logic lives in `use-run-links.ts` as a list of linked parts; a walk adds
its choices as a second part, and the frame is applied once every restored
part has come back.

### Branching walks (`walk.ts`, `use-walk.ts`, experimental)

A walk simulation is a generator whose `yield` returns the reader's
choice at choice points (steps with `await: true`). Rules, each with a
reason:

- **Always replay, never resume.** `runWalk(sim, input, { seed, choices })`
  reruns from the start on every change. A generator can't be copied, and
  StrictMode runs `useMemo` twice in development, so resuming a shared
  generator would skip steps. Replay is pure and cheap at explainer sizes.
- **Stop at the first unanswered choice point** (`awaiting`). The hook
  makes it a checkpoint via `holdAt`; the player checks checkpoints
  *before* the end of the timeline, so a hold on the last frame works.
- **`choose(c)` answers the choice point under the playhead.** A different
  answer on an earlier one truncates the choices after it (the old future is
  gone); the same answer keeps them. After the new path renders, a layout
  effect declared after `useTrace` jumps past the choice point (key
  re-anchoring alone would leave the playhead on it), and a held player is
  released.
- **Input edits replay the same choices**, then anchor by key (default) or
  by index (`anchor: "index"`, for walks where step i means "after i
  inputs", like `fromGraph`). Choices the new path doesn't reach stay in
  `choices` until a new answer truncates them.
- **`lastChange`** is `diffTraces(previous, current)`, paired the same way
  the playhead anchors.

## The core/client boundary

The root entry is a client module: tsup re-adds `"use client"` as a banner on
every client bundle (esbuild strips per-file directives). In a React Server
Component, an import from a client module is a *reference*, not the function,
so `runSimulation` from the root can't be called on a server or at build
time. The pure half therefore has its own entry, `./core` (`src/core.ts`),
with no directive and no runtime React import.

The constraint that shaped the build: **each pure function exists in exactly
one file of `dist`.** Two copies (one in the client bundle, one in core)
would work until something compared identities or held module state, and
would double the bytes. The mechanism is a **hinge**:

```
src/core.ts ─── plain tsup config (no banner) ───► dist/core.js ─┐
src/kit/mdx.tsx ── same config ──► dist/kit/mdx.js ─────────┼─► dist/chunk-*.js
                                                                  │   (the pure code, once)
src/index.ts, experimental.ts, kit/index.ts                       │
  ── client config ("use client" banner + coreHinge plugin) ──►   │
     dist/index.js, experimental.js, kit.js, chunk-*.js ── import "./core.js" at runtime
```

- **Client sources import pure code only through `./core` (or `../core`).**
  The `coreHinge` esbuild plugin in `tsup.config.ts` resolves exactly that
  specifier to an external `./core.js`, so the client bundles and their
  shared chunk import the one copy at runtime. An import of `./simulation`
  from a client module would bundle a second copy; `core-boundary.test.ts`
  bans it for every `"use client"` source, and its dist case checks that one
  file contains `function runSimulation(` and that it has no banner.
- Every client entry and chunk sits at the `dist/` root, so `./core.js` is
  the right relative path for all of them. The adapters emit to
  `dist/adapters/` and would get a wrong path, but they only `import type`,
  so they never reach core at runtime.
- `./kit/mdx` is built by the plain config next to core, so esbuild's
  splitting puts the pure code in one chunk both import. It imports the
  client components by the package's own name (`@sphynxoid/stepwise`,
  `@sphynxoid/stepwise/kit`), which that config keeps external: resolved, it
  would bundle client code into a file with no `"use client"`. (In this
  repo, `tsconfig` paths and vitest aliases point those names at `src`.)
- **Types are copied, not hinged.** tsup's declaration build ignores esbuild
  plugins, so the client `.d.ts` files inline their own copies of the
  schema and pure types instead of referencing `core.d.ts`. A
  `StepwiseStep` from the root and one from `./core` are compatible only
  structurally. That is why `core-boundary.test.ts` also bans `class` and
  `unique symbol` in core's files: either would make the two declaration
  copies nominally incompatible.
- Both configs write into `dist/` in one `tsup` run, so neither may use
  `clean: true`; the `clean` script wipes `dist` before tsup.

## The authoring kit (`kit/*`, experimental)

An author writes a **definition** (pure, `defineExplainer`) and a **view**
(a component with no props); the kit supplies the rest.

- **One provider, flat parts.** `Explainer` runs the definition through
  `useSimulation` (a walk definition through `useWalk`; without a definition
  it plays a recorded `trace` through `useTrace`) and puts an `ExplainerApi`
  in context: `step`, `input`, `setInput`, `editable`, `error`, `truncated`,
  `sim`, `predict`, `walk`, `id`, `theme`. A throwing simulation is logged once in development (it would
  otherwise only show as a short trace). The parts
  (`Stage`, `Narration`, `StepCode`, `ExplainerBar`, `EndNote`, `Predict`,
  `PredictToggle`) read it and take only serializable props (`Stage` none;
  the others a `className`; `EndNote`, `Predict` and `PredictToggle` prose
  children, wrapped in a `div` because MDX turns multi-line children into
  `<p>`), so they compose the same from TSX and MDX. The view lives in a
  second context: it is the author's component, not state, and `Stage`
  renders it. Live, walk and recorded are three components because hooks
  can't be conditional.
- **Step parts read less.** `Narration`, `StepCode`, `ExplainerBar` and
  `EndNote` need only a step and a player, so they read a second, smaller
  context (`StepParts`: `step`, `player`, `toneAt`, `titleAt`, `theme`)
  that the explainer opens for its parts and a page can open around any
  `TracePlayer` (`useTrace`, `useSimulation`, `useWalk`). `Stage`, `Predict`
  and `Choices` read the explainer.
- **Walks.** A definition with `walk` instead of `simulation` (exclusive at
  the type level) runs through `useWalk`, with the choices linked as a third
  run part (`<id>.path`, restored with the input before the frame, same-tab
  links too) and `choose.options` normalized per step for `Choices`. A walk
  is pure in (input, seed, choices), so `precompute` replays it with
  `runWalk` and `useWalk`'s `initialTrace` stands in for the run while all
  three match; choice points are re-derived from the steps' `await` flags.
  No predict on a walk: its holds would compete with the choice points.
- **Input from props, once.** `resolveInput` gives `input` precedence, then
  same-named fields of a plain-object default, skipping the reserved prop
  names (`EXPLAINER_PROP_NAMES`). The one rule serves both sides: the
  server wrapper resolves exactly the input the client will, so the
  precomputed trace matches. `FieldOverrides<Input>` types the same fields
  as props (`ExplainerInstanceProps`), so there is no index signature and a
  misspelled prop is a type error. It runs in a `useState` initializer: a
  page that re-renders with an equal but new literal must neither recompute
  nor wipe the reader's edits.
- **Predict mode lives in the provider**, because its checkpoints are a
  `holdAt` option of the simulation it runs. The truth is the frame after the
  held one, so `holdAt` skips a checkpoint with no successor (there is
  nothing to grade, and holding there would park the reader for good); the
  guess and the evaluator reset on every new held frame and
  when the trace changes while held (an input edit re-anchors onto the same
  index, but the next frame may differ).
- **The keyboard is shared.** One window-level key map per explainer, gated
  by a module-level registry (`kit/registry.ts`): the explainer the reader
  last pointed at or focused owns ArrowRight / ArrowLeft / Space. Before any
  interaction, and after the active one unmounts, none does: an explainer
  the reader hasn't touched must not swallow Space, which scrolls the page.
  An explainer with `keys={false}` is in the registry but out of routing:
  touching it doesn't claim the keys, so it can't silence the others. The same registry notices two
  linked explainers with the same hash namespace (keys or not) and warns
  once.
- **`precomputed` is a plain function component** (no hooks) in
  `./kit/mdx`: it resolves the input like the client, runs `precompute`
  (cached per definition, 8 inputs, keyed by the input's JSON, which is why
  non-JSON inputs are rejected before the lookup) and forwards every prop
  plus `trace`. On the client, `useSimulation`'s `initialTrace` plays that
  trace while the input matches by content. In an RSC host (the Next.js App
  Router) the wrapper runs only on the server, so hydration does no
  simulation work. In a non-RSC SSR host (Docusaurus, the Next.js Pages
  Router, Remix) the wrapper is an ordinary component that runs again in the
  browser, so the simulation runs once there too; the build-time failure and
  the recorded-only bundle saving hold in both. The first frame is in the
  server HTML either way, since client components are server-rendered too.

## The Tailwind contract

The library ships class *names*, not CSS. The host's Tailwind build must scan
`packages/stepwise/src` or nothing is styled. See `docs/TAILWIND-SETUP.md` —
this is the single most common (and most confusing) failure mode, and the
symptom (page works, library elements naked) does not point at the cause.

## SSR notes

- Every client module is `"use client"`; hooks no-op or defer `window`
  access behind effects/mounted flags. `./core` and `./kit/mdx` are the
  exceptions, by design (see "The core/client boundary").
- `useLessonStream` seeds its window around the entry lesson, so SSR renders
  that window; its layout effects use an isomorphic wrapper (no server
  warning). Routing stays consumer-side: URL/title sync goes through
  `onActiveChange`.

## Conventions

- **Tones** (`StepTone`): `neutral` (default), `accent` (highlight), `good`
  (success/progress), `bad` (destructive/teardown), `write` (mutation),
  `idle` (placeholder). Demos map these to narrative meaning consistently —
  keep that mapping.
- **Sizes/voice**: mono type, 10–13px, dim overlays (`text-foreground/50`),
  hairline borders (`border-white/10`), tight tracking on uppercase labels.
  The demo's dark GitHub-ish palette is one host; the portfolio's obsidian is
  another; neither is "the" theme.
- **Props**: components take `theme?` and `labels?` for injection; hooks take
  options objects; everything else stays minimal. Names follow the portfolio
  (`StepScrubber`, `TourCard`, …) — don't rename casually, the portfolio
  consumes these names.
