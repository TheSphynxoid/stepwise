# Tailwind setup for consumers

stepwise components ship **className strings** (`fixed inset-0`, `bg-popover`,
`w-72`, `border-white/15`, `ring-primary/80`, …). Tailwind generates CSS for
class names it can *see in your source tree* — and by default it cannot see a
node package.

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

The default theme references shadcn-style semantic tokens
(`bg-background`, `text-foreground`, `bg-popover`, `text-primary`,
`border-border`, `text-accent`, …). Define them as CSS variables and map them
into Tailwind. Tailwind v4 example:

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
- If you consume the package by path in a monorepo, you must still rebuild the
  library (`npm run build -w @sphynxoid/stepwise`) because the app imports
  `dist`, not `src` — stale `dist` mimics "my changes didn't apply".
