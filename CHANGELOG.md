# Changelog

## 0.2.0 — unreleased

- **New**: `useTrace(steps, opts)` — a player bound to a typed trace. Returns `{ player, step, frame, toneAt, titleAt }`; `step` is frame 0 before playback starts, and the scrubber accessors are stable.
- **New**: `StepwiseStep<Data>` is generic — carry your domain payload in the step type (`StepwiseStep<{ arr: number[] }>`). The default (`StepwiseStep`) is unchanged.
- **New**: `useStepPlayer({ respectReducedMotion })` (default `true`) — with `autoPlay`, users who prefer reduced motion land on frame 0, paused.
- **Fix**: `useStepPlayer` and `useGuidedTour` control callbacks are now referentially stable (they were re-created every frame, breaking memoized children and effect deps). `useChapters` and `useGuidedTour` return memoized objects.
- **Fix**: `syncHash` no longer overwrites the whole URL fragment — it updates only its own `key=value` part and keeps anchors and other keys. Keys are matched literally (previously interpolated into a regex unescaped).
- **Docs**: npm README uses the `@sphynxoid` scope and the `dist` `@source` path.

## 0.1.0 — 2026-10-27

Initial release.

- **Core**: `useSteps` — a clamped cursor over an ordered sequence, with stable callbacks and automatic re-clamping.
- **Policies**: `useStepPlayer` (timer, speed, seek, `#hash` deep links, `PlayerEngine` port; a completion state `ended` and `onEnd` callback — distinct from the `atEnd` position flag — with engine adapters firing `onEnd` once per run on the transition into the final frame), `useGuidedTour` (`onEnter` effects, `TourDriver` port, plus conditional tours: `when` skip predicates, `gate` guards with a `blocked` flag, `next` edge overrides by step id, `gotoId`), `useChapters` (viewport-center scroll tracking), `useDiscoveries` (persisted discovery ledger with `localStorageStore` / `cookieStore` / `memoryStore` storage seams — pair with a tour for show-once feature tutorials).
- **Utilities**: `useGlobalKeys`, `useFocusTrap`, `usePrefersReducedMotion`, `flattenChapters`.
- **Presentation**: `PlayerBar`, `StepScrubber` (with `groupOf` sub-chapter grouping), `ChapterNav`, `LessonPager`, `TourSpotlight`, `TourCard` (with `nextDisabled` for gated steps), `ShortcutsDialog` (focus trap, Escape, portal), `CodeBlock`; `GlossaryProvider` / `Term` / `GlossaryAppendix`; injectable `StepwiseTheme` (surface, overlay, code block, kbd, spotlight, muted tokens).
- **Adapters** (opt-in subpaths): `./adapters/gsap`, `./adapters/driver-js`, `./adapters/scroll`.

### Packaging notes

- The root barrel is dependency-free beyond React — adapters live behind `./adapters/*` subpath exports so optional peers (gsap, driver.js) are never required imports.
- `sideEffects` declares the driver.js adapter's CSS import; everything else tree-shakes.
- The build re-adds the `"use client"` directive as a banner (esbuild strips per-file directives while bundling), so React Server Components can import the package.
