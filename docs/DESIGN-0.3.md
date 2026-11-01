# 0.3 design: live traces and evaluators

Status: implemented on `feat/v0.3`, unreleased. This note records what was
built, the decisions behind it, and what was deliberately left for later.

## Goal

The 0.2 player plays a *recorded* trace. The idea behind 0.3 (from the
roadmap discussion): make explainers the reader can **poke at**. Change the
input and watch the algorithm re-run, without losing your place. Then let the
explainer **ask questions** and grade the answers. Both had to stay inside the
"one cursor + policies" model, not become a second state system.

## What shipped

| Piece | API | Notes |
|---|---|---|
| Step identity | `StepwiseStep.key?: string` | Optional, so no existing trace changes |
| Re-anchoring | `useTrace` (automatic for keyed steps), `keyOf`, pure `reanchor()` | Unkeyed traces keep index clamping |
| Simulations | `useSimulation(sim, input, opts)`, `runSimulation`, `createRng` | Generator `(input, { rng }) => Iterable<step>` |
| Checkpoints | `holdAt` → `held` / `release()` on the player; `holdAt(frame, step)` on traces | Autoplay only |
| Cursor-only move | `player.jump(frame)` | Used by re-anchoring; public for restoring linked state |
| Evaluators | `Verdict`, `Evaluator<Ctx>`, `pass`/`fail`/`pending`/`toVerdict`, `useEvaluator` | Booleans accepted everywhere |
| Verdict gates | `gate: () => boolean \| Verdict`, `tour.feedback`, `TourCard feedback` | Backward compatible |
| Hash helpers | `readHashParam` / `writeHashParam` exported | Pages keeping state next to `syncHash` |

Demo: `/simulate` (insertion sort; edit while playing; predict mode) and a
verdict gate on `/discovery`.

## Decisions

**Re-anchor by walking back to the latest shared key.** Alternatives were
"same index" (what 0.2 did, meaningless after an edit), "same progress
fraction" (lands mid-nowhere), and "nearest key in either direction" (can jump
*ahead* to something the reader hasn't seen). Walking back always lands on a
moment both runs share, at or before where you were. Keys are named moments
(`c3.2` = compare at i=3, j=2) supplied by the author. The library can't infer
identity, and positional keys would just be "same index".

**Eager simulation with a cap, not lazy generation.** `runSimulation` runs the
generator to completion (default cap 10 000 steps, `truncated` flag). Lazy
pulling with checkpointed replay would allow unbounded simulations, but the
scrubber needs a total, and every demo we have finishes in well under a
millisecond. Deferred until someone has a real unbounded case.

**Determinism through the context, not a global.** The generator gets
`ctx.rng`; nothing patches `Math.random`. Same simulation + input + seed =
same trace, which is what makes `#in=…&frame=…` links replay exactly.

**Checkpoints hold autoplay only.** Manual steps and seeks are never blocked:
the reader keeps control, and "skip the quiz" stays possible. If an app wants
hard gating, it can disable Next while `player.held` is set. Pressing play is
an explicit release of the frame you're on.

**Evaluators are a shape, not a framework.** `useEvaluator` is the only stateful
piece; everything else is a type plus four helpers. Manual mode clears the
verdict when the answer changes (a stale "Right!" next to a different answer
is wrong). Async runs abort when superseded and late results are dropped.
Tour gates stay **synchronous** (evaluated during render for `blocked`). Async
gate checks go through `useEvaluator`, and the gate returns its `passed`.

## Bugs the demo found (now invariant 10 in AGENTS.md)

Building `/simulate` with real linked URLs exposed three timing bugs, two of
them pre-existing in 0.2's hash handling. Each is pinned by a test that fails
without the fix:

1. The hash writer put the stale index back into the URL in the same commit
   that read a linked frame.
2. The hash was re-read on every `total` change, so a recompute plus another
   hash part being rewritten looked like a fresh link and overrode
   re-anchoring.
3. Re-anchoring displayed the anchored index from render and relied on
   `jump()` to commit it. A same-commit move back netted out, React bailed out,
   and the screen froze on the wrong frame.

All three were invisible with autoplay running and only showed up under
reduced motion (paused), which is how the Playwright test caught the last one.

## Deferred (candidates for 0.4)

- **Tutorial / curriculum layer** (the third roadmap item): units of tours and
  lessons with prerequisites, completion decided by evaluators, progress and
  resume through the `useDiscoveries` store seam, cross-route tours, an event
  stream for analytics. It builds directly on this release's evaluators.
  Shape it from early-user feedback before committing to an API.
- **Keyed re-anchoring for `useSyncedTracks`** (it already has sync keys;
  reuse them when tracks are recomputed).
- **Lazy simulations** with checkpointed replay, if an unbounded case appears.
- **Async tour gates** natively (today: via `useEvaluator`).
- A `/simulate`-style hero on the landing page: "edit the input" is the
  strongest launch demo we have.

## Open questions for review

1. `StepwiseStep.key` is a plain optional field. If a consumer's `Data`
   already has a `key` of another type, the intersection conflicts. Is
   that acceptable, or should identity live in `keyOf` only?
2. Should checkpoints also block manual Next by default (with an opt-out),
   or is "autoplay only" the right default?
3. `useEvaluator` manual mode keeps `attempts` across answer changes (same
   question), and only `reset()` clears it. Agree?
