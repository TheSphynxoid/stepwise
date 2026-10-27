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

## Module map

| Module | Responsibility | Notes |
|---|---|---|
| `types.ts` | The trace contract: `StepTone`, `StepwiseStep`, `TourStepInput`, `Chapter`, `ShortcutItem`; ports `PlayerEngine` / `PlayerEngineHandle` / `TourDriver` | Definitions may embed `ReactNode` (glossary chains, tour bodies) |
| `use-steps.ts` | THE core. Clamped cursor; `go/next/prev/first`; `atStart/atEnd/canNext/canPrev`; `onChange` | All callbacks referentially stable via refs; count may change dynamically (new timeline, mounted window) and the cursor re-clamps |
| `use-step-player.ts` | Player policy: base delay, speed multiplier, play/pause/seek/replay, `syncHash` deep-link, engine port | `frame` is the raw counter (**-1 = not started**); `index` clamps into `[0, total-1]`, -1 when nothing to show |
| `use-guided-tour.ts` | Tour policy: start/end/goto, `onEnter` per step, optional driver | `onEnter` reads latest steps via ref — closures stay fresh without re-triggering effects; `next` past the end exits |
| `use-chapters.ts` | Scroll-driven cursor + smooth `goTo` | See "scroll tracking" below |
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

Polls with `requestAnimationFrame` until the target appears (targets may be
conditionally rendered), resolves **`getElementById(target)` first, then
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

## The Tailwind contract

The library ships class *names*, not CSS. The host's Tailwind build must scan
`packages/stepwise/src` or nothing is styled. See `docs/TAILWIND-SETUP.md` —
this is the single most common (and most confusing) failure mode, and the
symptom (page works, library elements naked) does not point at the cause.

## SSR notes

- Every module is `"use client"`; hooks no-op or defer `window` access behind
  effects/mounted flags.
- `LessonStream` in the portfolio seeds the SSR window around the entry
  chapter and scroll-compensates prepends in a layout effect ("prepend
  anchor"); that logic lives consumer-side because it depends on the host's
  routing. The library keeps only the tracking primitive.

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
