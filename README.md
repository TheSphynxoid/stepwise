# stepwise

A kit for interactive, narrated, step-driven visualizations — one primitive (`useSteps`) at every scale.

## Packages

- `packages/stepwise` — the library (`@sphynx/stepwise`)
- `apps/demo` — the demo site (Next.js)

## Development

```bash
npm install
npm run dev       # starts the demo app
npm run test      # runs all tests
npm run build     # builds all packages
```

## License

MIT

## Tailwind CSS v4 consumers

The components ship className strings, so your Tailwind build must scan the
library source. Tailwind v4's automatic detection skips node_modules � register
the source explicitly in your CSS entry:

``css
@import "tailwindcss";
@source "../node_modules/@sphynx/stepwise/src";
``
