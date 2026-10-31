# AGENTS.md — stepwise

Operating manual for AI agents (and humans) working in this repository. Read
this before changing anything; the gotchas below were each paid for with a
debugging session.

## What this is

`@sphynxoid/stepwise` — a small kit for interactive, narrated, step-driven
visualizations. **One primitive at every scale**: `useSteps` is a clamped
cursor over an ordered sequence; frames in a trace, chapters in a lesson,
tour steps, and notebook lessons are all that cursor with different policies
layered on top. The demo site (`apps/demo`) is the living documentation.

- **Library**: `packages/stepwise` (ESM, `"use client"` modules, React 18/19 peer)
- **Demo**: `apps/demo` (Next.js 15, Tailwind v4, static prerender)
- Status: **published** as `@sphynxoid/stepwise@0.1.0` (npm, public, org
  scope `sphynxoid`); GitHub at `TheSphynxoid/stepwise`; demo Vercel config
  in `vercel.json`. The portfolio consumes the package (see "Known debt").

## Commands

```bash
# from repo root
npm install                                   # workspace install (root + all workspaces)
npm run build -w @sphynxoid/stepwise             # build library → packages/stepwise/dist
npm run dev                                   # demo app (same as: npm run dev -w @stepwise/demo)

# tests — run from the package directory, NOT the root
cd packages/stepwise && npx vitest run        # 121 tests (14 useSteps, 32 player, 29 tour, 9 discoveries, 6 chapters, 4 flatten, 4 trace, 11 synced tracks, 9 lesson stream, 3 createTrace)

# demo lint (eslint flat config, no interactive prompt)
cd apps/demo && npm run lint

# demo production build
cd apps/demo && npm run build

# demo E2E smoke tests (Playwright, against the production build: build first)
cd apps/demo && PW_CHANNEL=msedge npx playwright test   # PW_CHANNEL: only Edge is installed here; CI uses bundled Chromium
```

Quirks:
- **Vitest from the root finds no jsdom config** and the hook tests fail with
  "document is not defined". Always run it inside `packages/stepwise` (its
  `vitest.config.ts` sets `environment: "jsdom"`).
- **npm workspace commands on this Windows box often report exit code -1 even
  on success**. Judge by the output ("Build success", "9/9"), not `$LASTEXITCODE`.
- The demo imports the library through `dist` (package `exports`). **After any
  `packages/stepwise/src` change you must rebuild the library** or the demo
  silently serves stale code.

## THE gotcha: Tailwind v4 and library classes

The components ship **className strings** (`fixed inset-0`, `bg-popover`,
`w-72`, `ring-primary/80`, …). Tailwind v4's automatic content detection
**ignores gitignored paths — including `node_modules`**, where the workspace
package resolves. Without help, *no library class gets CSS generated*.

**Symptom signature** (memorize it): the host page's own styles work, but every
library-rendered element is completely unstyled — tooltips fall into document
flow at the page bottom, the tour card is a full-width strip, the spotlight's
9999px box-shadow paints as a giant static blob, "positioning is broken".

**Fix (consumer side, one line in the CSS entry):**

```css
@import "tailwindcss";
@source "../node_modules/@sphynxoid/stepwise/dist";
```

In this monorepo the demo does `@source "../../../packages/stepwise/src";` —
**three** levels up from `apps/demo/app` (two resolves to
`apps/packages/...`, which doesn't exist, and Tailwind **silently ignores**
bad paths). Details and verification steps: `docs/TAILWIND-SETUP.md`.

**Two escape hatches ship with 0.2.0** (prefer pointing users at these):

- `@sphynxoid/stepwise/styles.css` — precompiled from `src/styles.css` by the
  Tailwind CLI (`npm run build:css`, chained after tsup in `build`, since
  tsup's `clean` wipes `dist`). Non-Tailwind hosts import it and are done.
  Colors are `--stepwise-*` tokens; `white`/`black` are remapped to
  foreground/shade so it works on light hosts. If you add a class with a new
  color token to a component, add the token to `src/styles.css` too.
- shadcn registry at `<demo>/r/*.json`, generated from `src` by
  `apps/demo/scripts/build-registry.mjs` (demo `predev`/`prebuild`; output is
  gitignored). It splits `components.tsx` at its `// ─── Section ───`
  banners — **renaming a banner breaks the generator** (it throws, listing
  the banners it found; update the item list).

## Architecture in one screen

```
types.ts ── schema (StepTone, StepwiseStep, TourStepInput, Chapter)
         └─ ports (PlayerEngine, TourDriver) — inversion points for adapters
create-trace.ts ── createTrace<Data>().step(…).build(): typed module-scope
                   traces without IIFEs (pure data, no React)

CORE      use-steps.ts      THE primitive: clamped cursor, stable callbacks,
                            re-clamps when count changes
POLICIES  use-step-player   timer, speed, seek, #hash deep-link, engine port,
                            reduced-motion autoPlay gate
          use-trace         player bound to a typed trace (step, toneAt/titleAt)
          use-synced-tracks comparison mode: N traces under ONE player; hold
                            the last frame or align on sync keys (alignTracks
                            is the pure table)
          use-guided-tour   onEnter effects over app state, driver port;
                            conditional tours: when (skip), gate (block next,
                            exposes `blocked`), next edges by step id, gotoId
          use-discoveries   persisted discovery ledger (localStorage default,
                            cookie/memory seams) — pair with a tour for
                            show-once feature tutorials
          use-chapters      scroll → cursor (viewport-center containment)
          use-lesson-stream windowed notebook: approach loading, prepend
                            scroll compensation, center-tracked active lesson
                            (+ useFadeIn for streamed blocks)
          use-global-keys / use-focus-trap / use-prefers-reduced-motion
PRESENT   components.tsx    PlayerBar, StepScrubber (groupOf!), ChapterNav,
                            LessonPager, TourSpotlight, TourCard,
                            ShortcutsDialog, CodeBlock, StepButton
          glossary.tsx      GlossaryProvider / Term (recursive, depth-capped
                            at 4) / GlossaryAppendix (auto-collect + intro/
                            footer/renderEntry customization)
ADAPTERS  adapters/gsap.ts (PlayerEngine), adapters/driver-js.ts (TourDriver),
          adapters/scroll.ts (PlayerEngine, dependency-free)
```

Dependency direction is strict: adapters → policies → core; presentation
depends only on core + types + theme. Full details, algorithms, and the why
behind each: `docs/ARCHITECTURE.md`.

## Invariants — do not break these

Each of these encodes a bug we already fixed once:

1. **Scroll tracking = viewport-center containment.** A chapter is active when
   `rect.top <= innerHeight/2 && rect.bottom >= mid` (fallback: deepest
   top-above-center, else first). Do not regress to "top crossed an offset" —
   that advances chapters the moment they scroll past, which users rejected.
   (`use-chapters.ts`)
2. **Tooltip positioning measures the real card in a `useLayoutEffect`.**
   Render the card whenever `open` (hidden via `visibility` until `pos` is
   set) — do NOT gate rendering on `pos !== null`, or the first measurement
   races and the card lands wrong. Place below the trigger; flip above when
   `top + height > innerHeight - 8`; clamp horizontally; pin to top as last
   resort. (`glossary.tsx`)
3. **`TourSpotlight` resolves targets as `getElementById(id)` first, then
   `[data-tour="id"]`.** The portfolio uses `data-tour`; generic consumers use
   plain ids. (`components.tsx`)
4. **`StepTone` is exactly `"neutral" | "accent" | "good" | "bad" | "write" |
   "idle"`.** There is no `"contrast"`. If a demo fails typecheck on a tone,
   fix the demo, not the union.
5. **`useStepPlayer.index === -1` means "not started".** Demo fallbacks for
   `index < 0` must render frame **0**, never the last frame. Prefer
   `useTrace(steps)` — its `step` already encodes this.
6. **Demo traces are built at module scope** (IIFE or constants), never inside
   a component referencing a later `const` — that produced a TDZ crash
   ("can't access lexical declaration before initialization"). New traces
   should use `createTrace<Data>()` (see `/compare`) instead of an IIFE.
7. **All hooks are SSR-safe**: `"use client"` at top, portals only after mount,
   no `window` at module evaluation. Callbacks returned by public hooks are
   referentially stable (refs for fresh values, not re-created closures).
   Never list a hook's memoized return object (e.g. `core` from `useSteps`)
   in a callback's deps — it churns per frame; destructure its stable
   callbacks or read through a ref. Tests assert identity for player and tour.
9. **`syncHash` owns only its key.** The fragment is `&`-separated parts;
   the player rewrites its `key=value` part and keeps everything else
   (anchors, other players). No regex on the key.
8. **Adapters are optional peers**: `driver.js` and `gsap` are in
   `peerDependenciesMeta.optional` and `external` in the tsup build; they are
   devDependencies here only so DTS generation can resolve their types.
9. **Every styled component root sets `data-stepwise`** (including portaled
   roots: tooltip card, shortcuts overlay). `styles.css` scopes its preflight
   to those subtrees — a new component without it renders with browser-default
   buttons/margins on non-Tailwind hosts.

## Demo content policy

Demo pages use **abstract, domain-free content only** (sorting, Git, HTTP/TCP,
a compiler pipeline). No portfolio / Furrballs / NUMA leakage — the library
must read as general-purpose. `/eviction` (the historical, portfolio-era
path of the player demo) permanently redirects to `/player` via
`next.config.ts`.

Page structure: each route's `page.tsx` is a tiny **server** component that
renders the client `demo.tsx` plus `<ViewSource file="app/<route>/demo.tsx" />`,
which reads that file with `fs` at build time and shows it in a collapsible
`CodeBlock` (with GitHub / StackBlitz links). So the source panel can't drift
from the running code - keep the demo itself in `demo.tsx`.

What each page must keep showcasing (the feature matrix):

| Page       | Showcases                                                                      |
|------------|--------------------------------------------------------------------------------|
| `/`        | SaaS landing: visual hero player (`HeroPlayer`: quicksort bars on `useTrace` + `PlayerBar`), one-primitive band, feature grid (lesson featured), theming section, light/dark toggle |
| `/lesson`  | **Flagship composition**: `useChapters` + `ChapterNav` scroll lesson, embedded `useTrace` Dijkstra player (chapter → frame seek while paused), `useGuidedTour` intro whose steps target sections, glossary `Term`s + `GlossaryAppendix`, live three-cursor readout |
| `/player`  | `useTrace` autoPlay, `PlayerBar`, `useGlobalKeys`, `CodeBlock`, tones, `ended` completion banner |
| `/compare` | `useSyncedTracks` (bubble vs insertion sort under one player), hold vs align-by-pass toggle, traces built with `createTrace` |
| `/tour`    | `useGuidedTour` + `TourSpotlight` + `TourCard`, id targets, `waitHint`, live interactive step |
| `/discovery`| `useDiscoveries` ledger auto-starts a tour once; `when` skips done steps, `gate` blocks Next, reset/replay controls |
| `/glossary`| `Term` chains (HTTP→HTTPS→TLS→CA hits the depth cap), appendix auto-injection + `intro` |
| `/scroll`  | `useChapters` center tracking, scrubber `groupOf` sub-chapter grouping, recursive `ChapterNav`, glossary tooltips + auto-appendix with `intro`/`footer` |
| `/minimal` | Bare `PlayerBar`, custom labels, **standalone light theme** (proves theme is injected, not baked in) |
| `/docs`    | Hand-written API reference (`app/docs/api.ts`) - update it in the same change as any public signature |

## Demo site theming (apps/demo)

The demo is dark-first with a real light/dark toggle, and the mechanism IS
the library's theming story:

- `app/globals.css` — two CSS-variable palettes; `[data-theme="light"]`
  overrides `:root`. An inline pre-paint script in `layout.tsx` sets
  `data-theme` from localStorage / `prefers-color-scheme` (no flash).
- `app/site-themes.ts` — the two `StepwiseTheme` objects (per-mode tokens).
  **No "use client"** — pure data, so server components (the landing) can
  import them.
- `app/theme-provider.tsx` — client context (`useSiteTheme()`), persists the
  mode, exposes `ThemeToggle`. Demo pages pass `theme` from the context into
  every library component.
- The landing's code sample stays dark in both modes via literal-color panel
  tokens + a scoped `style={{ "--foreground": … }}` override around it.
- The scroll page's sticky scrubber bar sits at `top-14` to clear the global
  `SiteHeader` (sticky, h-14, z-50).
- Screenshots: headless Edge `--blink-settings=preferredColorScheme=1` forces
  light — pass a dedicated `--user-data-dir` or a still-running previous
  instance can swallow the flag and render dark.

## Verification playbook

1. Library: `npm run build -w @sphynxoid/stepwise` → "ESM ⚡ Build success" +
   "DTS ⚡ Build success". Tests from `packages/stepwise`.
2. Demo: `cd apps/demo && npm run build` → "14/14 static pages" (10 routes).
   Then `PW_CHANNEL=msedge npx playwright test` (17 smoke tests: every route
   without console errors, the /eviction redirect, tour card placement - the
   Tailwind `@source` regression guard - player, tour, keyboard glossary
   tooltip, lesson composition, /compare alignment). Set `PW_PORT` if 3123 is taken.
3. **Visual check via headless Edge** (Chrome is not installed here):
   `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless,
   against `npm run dev -- -p <port>`. Screenshot after interacting (e.g.
   Tab/Enter opens the first glossary term; `#fragment` URLs jump the scroll
   demo to a chapter).
4. **Did Tailwind pick up the classes?** `Invoke-WebRequest` the built CSS
   (`/_next/static/css/app/layout.css`) and grep for `.bg-popover` — absence
   means the `@source` path is wrong. This check would have caught the
   "everything unstyled" bug in seconds.
5. Kill dev servers with
   `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -match "stepwise" } | % { Stop-Process -Id $_.ProcessId -Force }`.
   `Get-Process` has no `CommandLine`; a stale server serves stale CSS and
   fakes "the fix didn't work".

CI (`.github/workflows/ci.yml`) runs the same sequence on every push/PR:
install → build library → test library → lint demo → build demo →
Playwright Chromium smoke tests (report uploaded on failure).

## Releasing (npm)

The package is live: **`@sphynxoid/stepwise`** on npm (org scope — the
`@sphynx` name was taken; never rename casually, the portfolio pins it).

```bash
cd packages/stepwise
npm version patch|minor|major   # bump + git tag (patch=fixes, minor=additive
                                # API, major=breaking — avoid until 1.0)
npm run release                 # publish (prepublishOnly runs tests + build;
                                # 2FA OTP required — npm prompts, or use --otp)
```

Rules: never ship with failing tests (the gate catches it), never skip the
bump (npm rejects republished versions), and `export *` additions are minor,
signature changes are major while we're pre-1.0.

## Known debt / next moves

- **Portfolio integration: RESOLVED** — the portfolio consumes the npm
  package: `lib/stepwise.ts` is a one-line re-export barrel
  (`export * from "@sphynxoid/stepwise"`), the old fork is deleted, and
  `app/globals.css` registers `@source "../node_modules/@sphynxoid/stepwise/dist"`.
  The npm-page README still shows the pre-rename instructions from 0.1.0
  (wrong scope + `src` path) — the corrected docs here ship with the next
  publish.
- Vercel: demo monorepo config is in `vercel.json`. `next.config.ts` in the
  portfolio carries `ignoreBuildErrors`/`ignoreLint` — don't copy that habit here.
- E2E is smoke-level only (`apps/demo/e2e`); no visual regression yet.
- The "Open in StackBlitz" links (root `demo` script builds the library, then
  starts the demo) are untested - they only resolve once the files are on
  `master` on GitHub.
- The adapter `exports` split is done: `./adapters/*` are subpath exports and
  the root barrel imports no adapter code, so optional peers are never
  required imports.

## Where to look first

- "Why is it unstyled?" → `docs/TAILWIND-SETUP.md`
- "How does X work / why is it built this way?" → `docs/ARCHITECTURE.md`
- "What can I import?" → `packages/stepwise/src/index.ts` (the barrel is the
  public API; its header comment is the design rationale)
