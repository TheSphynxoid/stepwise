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
- Status: v0.1.0, not yet published to npm; GitHub repo + Vercel not yet wired up.

## Commands

```bash
# from repo root
npm install                                   # workspace install (root + all workspaces)
npm run build -w @sphynxoid/stepwise             # build library → packages/stepwise/dist
npm run dev                                   # demo app (same as: npm run dev -w @stepwise/demo)

# tests — run from the package directory, NOT the root
cd packages/stepwise && npx vitest run        # 84 tests (14 useSteps, 23 player, 28 tour, 9 discoveries, 6 chapters, 4 flatten)

# demo lint (eslint flat config, no interactive prompt)
cd apps/demo && npm run lint

# demo production build
cd apps/demo && npm run build
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

## Architecture in one screen

```
types.ts ── schema (StepTone, StepwiseStep, TourStepInput, Chapter)
         └─ ports (PlayerEngine, TourDriver) — inversion points for adapters

CORE      use-steps.ts      THE primitive: clamped cursor, stable callbacks,
                            re-clamps when count changes
POLICIES  use-step-player   timer, speed, seek, #hash deep-link, engine port
          use-guided-tour   onEnter effects over app state, driver port;
                            conditional tours: when (skip), gate (block next,
                            exposes `blocked`), next edges by step id, gotoId
          use-discoveries   persisted discovery ledger (localStorage default,
                            cookie/memory seams) — pair with a tour for
                            show-once feature tutorials
          use-chapters      scroll → cursor (viewport-center containment)
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
   `index < 0` must render frame **0**, never the last frame.
6. **Demo traces are built at module scope** (IIFE or constants), never inside
   a component referencing a later `const` — that produced a TDZ crash
   ("can't access lexical declaration before initialization").
7. **All hooks are SSR-safe**: `"use client"` at top, portals only after mount,
   no `window` at module evaluation. Callbacks returned by public hooks are
   referentially stable (refs for fresh values, not re-created closures).
8. **Adapters are optional peers**: `driver.js` and `gsap` are in
   `peerDependenciesMeta.optional` and `external` in the tsup build; they are
   devDependencies here only so DTS generation can resolve their types.

## Demo content policy

Demo pages use **abstract, domain-free content only** (sorting, Git, HTTP/TCP,
a compiler pipeline). No portfolio / Furrballs / NUMA leakage — the library
must read as general-purpose. The `/eviction` path name is historical
(portfolio extraction); it now hosts a bubble-sort demo.

What each page must keep showcasing (the feature matrix):

| Page       | Showcases                                                                      |
|------------|--------------------------------------------------------------------------------|
| `/`        | SaaS landing: live hero player (`HeroPlayer`), one-primitive band, feature grid, theming section, light/dark toggle |
| `/eviction`| `useStepPlayer` autoPlay, `PlayerBar`, `useGlobalKeys`, `CodeBlock`, tones, `ended` completion banner |
| `/tour`    | `useGuidedTour` + `TourSpotlight` + `TourCard`, id targets, `waitHint`, live interactive step |
| `/discovery`| `useDiscoveries` ledger auto-starts a tour once; `when` skips done steps, `gate` blocks Next, reset/replay controls |
| `/glossary`| `Term` chains (HTTP→HTTPS→TLS→CA hits the depth cap), appendix auto-injection + `intro` |
| `/scroll`  | `useChapters` center tracking, scrubber `groupOf` sub-chapter grouping, recursive `ChapterNav`, glossary tooltips + auto-appendix with `intro`/`footer` |
| `/minimal` | Bare `PlayerBar`, custom labels, **standalone light theme** (proves theme is injected, not baked in) |

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
2. Demo: `cd apps/demo && npm run build` → "9/9 static pages" (7 routes).
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
install → build library → test library → lint demo → build demo.

## Known debt / next moves

- **Portfolio sync debt**: the portfolio repo (`custom_portfolio/lib/stepwise/`)
  still carries an older fork — it lacks the tooltip below/above flip, the id
  fallback in `TourSpotlight`, the appendix auto-injection API, center-based
  `useChapters`, and grouped scrubber segments. Either port those back or
  switch the portfolio to consume the package.
- Not yet on GitHub / npm / Vercel. Vercel import: **Root Directory =
  `apps/demo`**. `next.config.ts` in the portfolio carries
  `ignoreBuildErrors`/`ignoreLint` — don't copy that habit here.
  **Before publishing**: the `repository`/`homepage`/`bugs` URLs in
  `packages/stepwise/package.json`, `SITE_URL` in `apps/demo/app/layout.tsx`,
  and the LICENSE copyright line are placeholders — fill in the real ones.
- No E2E tests; the "verification playbook" is manual. Playwright would slot
  in naturally against the demo pages.
- Consider renaming `/eviction` → `/player`. (The adapter `exports` split is
  done: `./adapters/*` are subpath exports and the root barrel imports no
  adapter code, so optional peers are never required imports.)

## Where to look first

- "Why is it unstyled?" → `docs/TAILWIND-SETUP.md`
- "How does X work / why is it built this way?" → `docs/ARCHITECTURE.md`
- "What can I import?" → `packages/stepwise/src/index.ts` (the barrel is the
  public API; its header comment is the design rationale)
