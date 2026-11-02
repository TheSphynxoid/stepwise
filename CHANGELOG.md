# Changelog

## 0.5.0 — 2026-11-02

Transitions: a trace becomes a graph. Everything new is in the new
`@sphynxoid/stepwise/experimental` entry point and may change in a minor
release; the root entry is unchanged.

- **New (experimental)**: `useWalk` / `runWalk`: simulations that branch on the reader's choices. A step with `await: true` is a choice point, and that `yield` returns the choice. `choose()` answers the choice point under the playhead: at the end the walk continues; a different answer on an earlier one cuts off the old future. A walk is (simulation, input, seed, choices); `syncChoices` puts the choices in the URL so a link replays the path. `anchor: "index"` keeps the position on input edits for walks where step i means "after i inputs".
- **New (experimental)**: `fromGraph`: a declared automaton (nodes, labeled edges, accept states, an `otherwise` dead state), run over a word and drawable from `.graph`.
- **New (experimental)**: `diffTraces` / `structuralEqual`: which steps an edit changed (`useWalk` exposes `lastChange`).
- **Fix**: a checkpoint (`holdAt`) on the last frame now holds; playback used to end there instead.
- **Demo**: `/automaton`: a divisible-by-3 automaton run and drawn from one declaration, and a "be the automaton" walk where wrong answers take a detour.
- **Docs**: "The model" in docs/ARCHITECTURE.md; LLMS.md section 8.

## 0.4.0 — 2026-11-01

Shareable simulation links, and docs built from two outside test builds (AI
agents given only the public package and docs). Additive; no breaking changes.

- **New**: `useSimulation({ syncInput: { key, serialize, parse, onRestore } })` keeps the input in the URL next to the `syncHash` frame. On mount the linked input is handed to `onRestore` (your `setInput`) and the linked frame is applied to the trace computed from it, which fixes the race of doing this by hand (the player read `#frame=` against the default input's trace, where the frame may not exist, and could overwrite it). Edits are written back. `SyncInputOptions` is exported.
- **New**: development builds warn once when `useSimulation`'s object input is a new object with the same content on every render (`useSimulation(sim, { arr, target })` inline), which silently recomputed the trace each render.
- **Changed**: `CodeBlock`'s `lines` is optional and accepts `readonly string[]`, so `<CodeBlock lines={step.code} />` typechecks (`step.code` is optional).
- **Fix**: `pass`, `fail`, `pending` and `toVerdict` are declared directly in `index.d.ts` again, instead of only as aliased re-exports from a shared chunk (`i as fail`), which made them look missing.
- **Docs**: `readHashParam` / `writeHashParam` and `TONE_CHIP_CLASS` / `TONE_SEGMENT_CLASS` are documented (they were public but only visible in demo sources). Precise semantics for `holdAt` (doesn't resume until `release()`), `useEvaluator` manual mode (clears the verdict on a new `ctx`, keeps `attempts` until `reset()`), grading a checkpoint against the next frame, `Term` inside `GlossaryProvider`, `import type { GlossaryEntry }`, `syncHash` with bare anchors, ESM only.
- **Docs**: [docs/RECIPES.md](docs/RECIPES.md): Next.js + MDX article, shareable links, grading a checkpoint, testing. New README sections: shareable links, testing.
- **New**: `examples/next-mdx`, an interactive binary-search article (editable input, predict mode, glossary) in Next.js App Router + MDX.
- **New**: `LLMS.md` ships in the package, and the demo site serves `/llms.txt` and `/llms-full.txt`: a compact guide for AI assistants, which won't know a library this new.
- **Demo**: `/simulate` uses `syncInput` instead of its hand-rolled linking code.
- **Dev**: the demo builds the library itself on a fresh clone (`npm run dev` used to fail with "Module not found").

## 0.3.0 — 2026-11-01

Live traces and evaluators. Additive; no breaking changes.

- **New**: `useSimulation(simulation, input, opts)` — a live trace. A simulation is a generator `(input, { rng }) => Iterable<step>`; change the input (or `seed`) and the trace is recomputed while the playhead stays on the same logical step and playback continues. Returns every `useTrace` field plus `steps`, `truncated`, `error`, `seed`. Pure pieces: `runSimulation` (module scope / server safe, `maxSteps` cap, keeps partial steps on a throw) and `createRng(seed)` (seeded mulberry32; string seeds hashed), the only randomness a simulation should use so runs replay exactly.
- **New**: `StepwiseStep.key` — stable step identity across re-runs. `useTrace` re-anchors keyed traces when `steps` changes: the playhead goes to the latest step whose key both traces share (`reanchor`, exported pure). Custom identity via `keyOf`. Unkeyed traces keep the old behavior (same index, clamped).
- **New**: player checkpoints — `useStepPlayer({ holdAt })` pauses autoplay on chosen frames and reports `held` until `release()`. Manual steps and seeks are never held; pressing play releases; `start()` re-arms. On `useTrace`/`useSimulation`, `holdAt` also receives the step.
- **New**: following the live edge — `useStepPlayer({ follow: true })` (and `useTrace` / `useSimulation`) for timelines that grow while watched: a stream, a log, an agent's steps, a game's move history. A reader who is live (playing, or parked on the last frame) plays into appended frames at the normal pace; one who scrubbed back stays put. `player.live` and `player.goLive()` drive a "Go live" control, and `PlayerBar live` renders one. Checkpoints still hold; a following `autoPlay` player can mount empty. Appends to a keyed trace skip re-anchoring (same key at the same index).
- **New**: `player.jump(frame)` — move the cursor without touching play state (re-anchoring, restoring linked state).
- **New**: evaluators — `Verdict { status: "pass" | "fail" | "pending", feedback }` and `Evaluator<Ctx> = (ctx, signal) => boolean | Verdict | Promise<…>`, with `pass` / `fail` / `pending` / `toVerdict`. `useEvaluator(evaluator, ctx, { mode })` keeps the verdict as state: `"auto"` re-judges on context change (gates), `"manual"` on `check()` (quizzes) and clears when the answer changes; async checks report pending, abort superseded runs and drop late results; `attempts` for hints.
- **New**: tour gates may return a `Verdict`: anything but pass blocks Next, and `tour.feedback` carries the message; `TourCard` takes `feedback` and announces it politely.
- **New**: `readHashParam` / `writeHashParam` are public, for pages that keep their own state in the fragment next to a player's `syncHash` key.
- **Fix**: on mount, the player's hash writer no longer puts the stale index back into the URL in the same commit that reads a linked frame (sibling effects saw `#frame=0`).
- **Fix**: the player re-read the URL frame on every timeline length change, which could override the playhead after a recompute. It now reads on mount, on `hashchange`, and when the first non-empty timeline arrives.
- **Demo**: `/simulate` — edit an insertion sort's input while it plays (the step stays put, links replay exactly), plus a predict mode built from checkpoints and a manual evaluator. `/live` — a build log streaming in: follow the edge, scrub back to inspect an event, then Go live. `/discovery`'s query gate now explains what's missing.

## 0.2.1 — not published separately (shipped in 0.3.0; docs and demo only)

- **Docs**: README rewritten for first-time visitors (hero GIF, use-case table, honest comparison with tour/scrollytelling libraries); sharper npm description and keywords.
- **New**: `examples/vite-starter` — the smallest real app on the published package, no Tailwind (`styles.css`); the StackBlitz target.
- **Demo**: OG tags and registry point at the real demo origin, https://stepwise.thesphynx.net (the deployed registry referenced a non-existent domain, so `shadcn add` failed on dependencies; override with `SITE_URL`); site version badges read the package version; `opengraph-image.png`.

## 0.2.0 — 2026-11-01

- **New**: `useTrace(steps, opts)` — a player bound to a typed trace. Returns `{ player, step, frame, toneAt, titleAt }`; `step` is frame 0 before playback starts, and the scrubber accessors are stable.
- **New**: `StepwiseStep<Data>` is generic — carry your domain payload in the step type (`StepwiseStep<{ arr: number[] }>`). The default (`StepwiseStep`) is unchanged.
- **New**: `useStepPlayer({ respectReducedMotion })` (default `true`) — with `autoPlay`, users who prefer reduced motion land on frame 0, paused.
- **New**: `createTrace<Data>()` — a typed trace builder (`.step()`, `.length`, `.last()`, `.build()`) so traces are built at module scope without IIFEs. `build()` returns `StepwiseStep<Data>[]` snapshots.
- **New**: `useSyncedTracks(tracks, opts)` — comparison mode: several traces under one player. Shorter tracks hold their last frame, or align steps on shared sync keys (`key`). Returns per-track views (`step`, `index`, `held`, `done`) plus stable `toneAt`/`titleAt`. `alignTracks` exposes the pure alignment.
- **New**: `useLessonStream(count, opts)` — headless windowed notebook reader: mounts a window around the seed lesson, loads neighbours on approach, compensates the scroll for content prepended above the reader, and tracks the active lesson by viewport center. Composes with `ChapterNav` / `LessonPager`. `useFadeIn` fades streamed blocks in.
- **Fix**: `useStepPlayer` and `useGuidedTour` control callbacks are now referentially stable (they were re-created every frame, breaking memoized children and effect deps). `useChapters` and `useGuidedTour` return memoized objects.
- **Fix**: `syncHash` no longer overwrites the whole URL fragment — it updates only its own `key=value` part and keeps anchors and other keys. Keys are matched literally (previously interpolated into a regex unescaped).
- **New**: precompiled stylesheet `@sphynxoid/stepwise/styles.css` — styles the components without Tailwind. Only the kit's own classes, no global preflight (scoped to `[data-stepwise]` roots), no global theme variables; colors are `--stepwise-*` tokens with light/dark defaults (`prefers-color-scheme`, `.dark` / `[data-theme]`). Built by the Tailwind CLI (`npm run build:css`, part of `build`).
- **New**: shadcn registry served by the demo at `/r/*.json` — `npx shadcn@latest add https://stepwise.thesphynx.net/r/player-bar.json` copies the component source (`player-bar`, `code-block`, `tour`, `glossary`, `chapter-nav`, `lesson-pager`, `shortcuts-dialog`, or `stepwise` for all) into your repo; hooks stay imported from the package. Generated from the library source on every demo build.
- **Change**: styled component roots carry a `data-stepwise` attribute (the stylesheet's preflight scope).
- **Docs**: npm README uses the `@sphynxoid` scope and the `dist` `@source` path. TAILWIND-SETUP covers all three styling routes and documents the shadcn token contract (including the `accent` caveat and the dark-host `white/N` overlays).

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
