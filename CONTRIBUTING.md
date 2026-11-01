# Contributing to stepwise

Thanks for looking. Issues, questions and PRs are all welcome, and since the
library is pre-1.0, **feedback on the API itself is the most valuable thing
you can send**: what was confusing, what you had to work around, what you
expected a hook to do.

## Ways to help

- **Use it and tell us what hurt.** Open an issue, even a vague one.
- **Show what you built.** Explainers made with stepwise go in the
  "Show and tell" discussions; the best ones may become demos.
- **Fix something.** Issues labelled `good first issue` are scoped to be
  doable without knowing the whole codebase.

## Setup

```bash
npm install
npm run demo                              # builds the library, starts the demo on :3000
cd packages/stepwise && npx vitest run    # unit tests (run them from the package dir)
```

The demo imports the library through its `dist`, so after changing
`packages/stepwise/src`, rebuild it (`npm run build -w @sphynxoid/stepwise`)
or the demo serves stale code.

## Before you open a PR

1. Read [`AGENTS.md`](AGENTS.md). It's short, and its **Invariants** section
   lists the bugs we already fixed once (scroll tracking, tooltip measuring,
   stable callbacks, …). Don't regress them.
2. `cd packages/stepwise && npx vitest run`: all green.
3. `cd apps/demo && npm run lint && npm run build`.
4. If you changed a public signature, update `apps/demo/app/docs/api.ts`
   (the API reference page) and add a line to `CHANGELOG.md`.
5. New behavior gets a test. Hooks are tested with `@testing-library/react`
   in jsdom; see the existing `*.test.tsx` files for the pattern.

CI runs the same steps plus Playwright smoke tests against the demo.

## Design rules (short version)

- **One primitive.** New features are policies over `useSteps`, not new state models.
- **Headless first.** Hooks never render. Components are optional and take a `theme`.
- **Stable callbacks.** Anything a public hook returns that's a function must
  keep its identity across renders.
- **Optional peers stay optional.** Integrations with third-party libraries
  go in `src/adapters/*` behind a port, never in the root barrel.
- **Demo content is domain-free**: algorithms, protocols, pipelines.

## Releasing

Maintainers only: see "Releasing" in `AGENTS.md`.
