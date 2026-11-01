# Interactive article: Next.js + MDX

One article, "How binary search finds a number", written in MDX with
[`@sphynxoid/stepwise`](https://stepwise.thesphynx.net) components between the
paragraphs:

- **A player whose trace is computed from the input.** `useSimulation` runs a
  binary-search generator; change the target or regenerate the (seeded) array
  while it plays and the playhead stays on the same comparison.
- **Shareable links.** The frame and the input live in the URL
  (`#frame=4&in=3.9.14.25.34.47.61|34`, via `syncHash` + `syncInput`), so a
  copied link reopens on that exact step.
- **Predict mode.** Checkpoints (`holdAt`) pause at each comparison and ask
  "left, right, or found?", graded by `useEvaluator`.
- **A glossary.** `<Term>` tooltips in the prose (they nest) and an appendix
  that collects itself.
- **No Tailwind.** The library's precompiled `styles.css` plus a small plain
  stylesheet; light/dark follows the system.

This app installs the published package (not the workspace), so it's also a
consumer smoke test. It was first built by an AI agent working only from the
public docs, as a usability test of those docs.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Where things live

| Path | What |
|---|---|
| `src/app/page.mdx` | The article: prose, `<Term>`s, the player, `<GlossaryAppendix>` |
| `src/components/binary-search-player.tsx` | The player, input controls, predict mode |
| `src/lib/binary-search.ts` | The algorithm as a stepwise `Simulation` (one keyed step per moment) |
| `src/lib/glossary.tsx` | Glossary entries; definitions may contain further `<Term>`s |
| `src/app/layout.tsx` | `styles.css` and the `GlossaryProvider` around every page |
| `next.config.ts`, `mdx-components.tsx` | The MDX setup (both are required) |

The setup steps, and why each one is needed, are in the
[Next.js + MDX recipe](../../docs/RECIPES.md#an-interactive-article-in-nextjs--mdx).
