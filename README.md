# stepwise

A kit for interactive, narrated, step-driven visualizations — one primitive (`useSteps`) at every scale.

Frames in a trace, chapters in a lesson, lessons in a notebook, and tour steps are the same thing at the core: a clamped cursor over an ordered sequence. Timers, tour effects, scroll tracking, and third-party presenters are policies and adapters layered on top.

## Packages

- `packages/stepwise` — the library (`@sphynxoid/stepwise`)
- `apps/demo` — the demo site (Next.js): bubble-sort player, guided tour, glossary chains, scroll-driven compiler pipeline with sub-chapters, minimal light-theme player

## Documentation

- [`AGENTS.md`](AGENTS.md) — operating manual: commands, invariants, gotchas, verification playbook. **Read this before changing anything.**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the layering, ports/adapters, and the algorithms (tooltip positioning, center-containment scroll tracking, scrubber grouping, spotlight) with the reasoning behind each.
- [`docs/TAILWIND-SETUP.md`](docs/TAILWIND-SETUP.md) — consumer setup. **Required**: the components ship className strings; Tailwind must scan the library source or nothing is styled.

## Development

```bash
npm install
npm run dev       # starts the demo app
npm run test      # runs all tests (or: cd packages/stepwise && npx vitest run)
npm run build     # builds all packages (library → dist; the demo imports dist)
```

## License

MIT

## Tailwind CSS v4 consumers

The components ship className strings, so your Tailwind build must scan the
library source. Tailwind v4's automatic detection skips node_modules — register
the source explicitly in your CSS entry:

```css
@import "tailwindcss";
@source "../node_modules/@sphynxoid/stepwise/dist";
```

Details, v3 setup, and the "everything is unstyled" troubleshooting checklist:
[`docs/TAILWIND-SETUP.md`](docs/TAILWIND-SETUP.md).
