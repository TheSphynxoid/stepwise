# Styling setup for consumers

stepwise components ship **className strings** (`fixed inset-0`, `bg-popover`,
`w-72`, `border-white/15`, `ring-primary/80`, …). Tailwind generates CSS for
class names it can *see in your source tree* — and by default it cannot see a
node package. Three ways out, pick the one that matches your app:

| Your app | Route | Section |
|---|---|---|
| No Tailwind | `import "@sphynxoid/stepwise/styles.css"` | [Precompiled stylesheet](#precompiled-stylesheet-no-tailwind) |
| Tailwind + shadcn/ui | `npx shadcn add <url>` copies the components in | [shadcn registry](#shadcn-registry) |
| Tailwind, npm components | `@source` the package | [Tailwind v4](#tailwind-v4) / [v3](#tailwind-v3) |

All three style the same markup from the same class strings; they differ in
*who compiles the CSS* and *where the color tokens come from*.

## Precompiled stylesheet (no Tailwind)

```ts
import "@sphynxoid/stepwise/styles.css"; // once, at the app entry
```

`dist/styles.css` is compiled at build time (`npm run build:css`, Tailwind CLI
over `src/styles.css`) from exactly the classes in `components.tsx`,
`glossary.tsx` and `theme.ts`. It is built not to touch the host page:

- **No global preflight.** Every styled component sets `data-stepwise` on its
  root; a preflight subset (box-sizing, margin/padding/border reset, button
  normalization) applies only inside those subtrees, in `@layer base`.
- **No global theme variables.** Tailwind's theme is inlined, so no
  `--color-*`, `--spacing` or `--font-*` lands on `:root` — a host's own
  Tailwind theme (if any) is untouched. The only globals are the
  `--stepwise-*` tokens below and Tailwind's `--tw-*` `@property` registrations.
- **Utilities live in `@layer utilities`**, so unlayered host CSS wins on
  conflict, as with Tailwind itself.

### Stylesheet tokens

Every color resolves to a `--stepwise-*` variable with a light default, a dark
default under `prefers-color-scheme: dark`, and forced modes for `.dark` /
`[data-theme="dark"]` and `.light` / `[data-theme="light"]`. The defaults are
declared with `:where()` (zero specificity), so any host rule wins regardless
of import order:

| Token | Used for | Light | Dark |
|---|---|---|---|
| `--stepwise-background` | translucent panel fill (`bg-background/85`) | `#f8fafd` | `#0a0e1a` |
| `--stepwise-foreground` | text; also stands in for `white` in `white/N` hairlines and tints | `#101828` | `#e9eef8` |
| `--stepwise-card` | shortcuts dialog | `#ffffff` | `#101626` |
| `--stepwise-popover` | glossary tooltip | `#ffffff` | `#131a2c` |
| `--stepwise-primary` | play button, active segment, rings, `good` tone | `#2563eb` | `#6aa2ff` |
| `--stepwise-primary-foreground` | text on primary | `#ffffff` | `#071021` |
| `--stepwise-accent` | `accent` tone, links, tour wait hint | `#059669` | `#71e58f` |
| `--stepwise-destructive` | `bad` tone | `#d92d20` | `#ff6b62` |
| `--stepwise-ring` | focus rings | `#2563eb` | `#6aa2ff` |
| `--stepwise-shade` | stands in for `black` in overlays / code-block tint | `#94a3b8` | `#000000` |

```css
:root { --stepwise-primary: #7c3aed; }
.dark { --stepwise-primary: #a78bfa; }
```

To reuse a shadcn palette on a page that also loads the stylesheet, alias the
tokens: `:root { --stepwise-primary: var(--primary); … }` (shadcn v4 stores
full colors; older HSL-channel tokens need `hsl(var(--primary))`).

Limits: only the kit's *own* classes are compiled. Classes you pass through
`className` or a custom `theme` prop need your own CSS (or Tailwind).

## shadcn registry

The demo site serves a [shadcn registry](https://ui.shadcn.com/docs/registry)
at `https://stepwise-demo.vercel.app/r/`:

```bash
npx shadcn@latest add https://stepwise-demo.vercel.app/r/player-bar.json
```

| Item | Installs |
|---|---|
| `player-bar` | `PlayerBar`, `StepScrubber` |
| `code-block` | `CodeBlock` |
| `tour` | `TourSpotlight`, `TourCard` |
| `glossary` | `GlossaryProvider`, `Term`, `GlossaryAppendix` |
| `chapter-nav` | `ChapterNav` |
| `lesson-pager` | `LessonPager` |
| `shortcuts-dialog` | `ShortcutsDialog` |
| `stepwise` | all of the above |

Every item also pulls `stepwise-theme` (→ `lib/stepwise-theme.ts`, the
`defaultTheme` class map) and, where needed, `step-button`. Files land in
`components/stepwise/`; they import `cn` from `@/lib/utils` (from
`shadcn init`) and hooks/types from `@sphynxoid/stepwise`, which the CLI adds
as a dependency. Because the class strings now live in *your* source tree,
Tailwind scans them automatically — no `@source` line.

```tsx
import { useTrace } from "@sphynxoid/stepwise";
import { PlayerBar } from "@/components/stepwise/player-bar";
```

The copied source differs from the npm build in one way: `white/N` overlays
become `foreground/N`, so hairlines and tints show on light shadcn themes.

The registry JSON is generated from `packages/stepwise/src` by
`apps/demo/scripts/build-registry.mjs` (the demo's `predev`/`prebuild`), so it
never drifts from the published components. Set `STEPWISE_REGISTRY_URL` to
host it elsewhere.

## Token contract (Tailwind / shadcn hosts)

With `@source` or the registry, *your* Tailwind theme supplies the colors. The
components rely on these shadcn-named tokens (`--color-*` in `@theme`):

| Token | Utilities used | Notes |
|---|---|---|
| `background` | `bg-background/40`, `/85`, `/95` | panel fills |
| `foreground` | `text-foreground` and `/25`–`/95`, `bg-foreground/30` | |
| `card` | `bg-card` | shortcuts dialog |
| `popover` | `bg-popover` | glossary tooltip |
| `primary` | `bg-` / `text-` / `border-` / `ring-primary` (+ opacities) | |
| `primary-foreground` | `text-primary-foreground` | primary button text |
| `accent` | `text-accent`, `bg-accent/70`, `border-accent/40` | **see caveat** |
| `destructive` | `text-destructive`, `bg-destructive/70` | `bad` tone |
| `ring` | `focus-visible:ring-ring/50` | |

Plus Tailwind's built-in `white` / `black` (npm build only — the registry
rewrites `white`), which assume a dark host: on a light host override the
`StepwiseTheme` tokens that use them (`toneSegment.neutral/idle`, `surface`,
`kbd`, `codeBlock`, …) — the `/minimal` demo does exactly that.

**`accent` caveat:** stepwise uses `accent` as a *vivid highlight* (text and
timeline color). shadcn's default `--accent` is a pale hover background, so
`text-accent` can be near-invisible on a stock shadcn theme. Either point
`--color-accent` at a saturated color, or edit the copied
`lib/stepwise-theme.ts` / pass a `theme` that uses another token (e.g.
`chart-2`).

A token missing from your theme generates no CSS for its utilities
(Tailwind v4 only emits `bg-popover` if `--color-popover` exists) — that
element silently loses its color.

## Tailwind v4

Automatic content detection scans your project but **ignores gitignored
paths — including `node_modules`** — so library classes produce no CSS.
Register the library source explicitly in your CSS entry:

```css
@import "tailwindcss";
@source "../node_modules/@sphynxoid/stepwise/dist";
```

The `@source` path is **relative to the CSS file that declares it**. Count
carefully: from `app/globals.css` in a nested app dir, the repo root is often
**three** levels up (`../../../packages/...` in a monorepo that vendors the
package by path). Tailwind **silently ignores** paths that don't exist — a
wrong path looks identical to no path.

If your host app itself is gitignored or oddly rooted, also make sure the app
is covered by detection (`@source` it too).

### Monorepo example (this repo)

The demo vendors the package by path, so it scans the *source* directly:

`apps/demo/app/globals.css`:

```css
@import "tailwindcss";
@source "../../../packages/stepwise/src";
```

npm consumers scan the shipped **dist** (the tarball contains `dist`, not
`src`) — see the v4 snippet above.

## Tailwind v3

Add the source to `content`:

```js
// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./node_modules/@sphynxoid/stepwise/dist/**/*.{js}",
  ],
  // ...
};
```

## Semantic color variables

For the `@source` route, define the
[token contract](#token-contract-tailwind--shadcn-hosts) as CSS variables and
map them into Tailwind. Tailwind v4 example:

```css
:root {
  --background: #0d1117;
  --foreground: #e6edf3;
  --popover: #1c2128;
  --primary: #58a6ff;
  --accent: #7ee787;
  --border: #30363d;
  /* … */
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-popover: var(--popover);
  --color-primary: var(--primary);
  /* … */
}
```

Light themes work unchanged — the `/minimal` demo exists specifically to prove
the theme is injected, not baked in.

## Symptom checklist — "the library renders but everything is unstyled"

This exact failure cost a full debugging session. Signature:

- Host page styles are fine; **only** library-rendered elements are naked.
- Glossary tooltips appear **at the bottom of the page** (they fall into
  document flow — no `position: fixed` was generated).
- The guided-tour card is a **full-width unstyled strip** pinned to the bottom.
- The tour spotlight's dim (`boxShadow: 0 0 0 9999px` — inline, always works)
  paints as a **giant black blob at the wrong place** because its
  `fixed inset-0` wrapper class did nothing.

### Verify in 30 seconds

Fetch the built CSS and grep for a library-only class:

```powershell
(Invoke-WebRequest "http://localhost:3000/_next/static/css/app/layout.css").Content.Contains(".bg-popover")
# False  → @source missing or path wrong
```

Fix the `@source`/`content` path, restart the dev server (a stale Next process
will keep serving the old CSS), re-check. `True` ⇒ styling is wired; any
remaining layout bug is in application code.

### Also remember

- **`font-playfair` and other portfolio-specific utilities are NOT part of
  stepwise** — the library uses only standard Tailwind + the semantic tokens
  above.
- Not using Tailwind at all? Skip all of this and import
  `@sphynxoid/stepwise/styles.css`.
- If you consume the package by path in a monorepo, you must still rebuild the
  library (`npm run build -w @sphynxoid/stepwise`) because the app imports
  `dist`, not `src` — stale `dist` mimics "my changes didn't apply".
