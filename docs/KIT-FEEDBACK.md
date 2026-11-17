# Kit feedback

Gripes met while building `/qa` (the QA Engineer lesson) with the authoring
kit and the primitives around it. Each item has what hurt, where, and a
suggested fix. None of these are fixed in the lesson's change unless noted.

## 1. A same-tab link restores the frame but not the input

**Where:** `useSimulation` `syncInput` (and so every kit explainer with
`serialize`/`parse`).
**What:** the player re-reads `#id.frame=` on `hashchange`, but the input
is read from the hash on mount only. Paste `/qa#bnd.in=11_12&bnd.frame=4`
into a tab already on `/qa` and you get frame 4 of the *old* input.
**Fix:** read `syncInput` on `hashchange` too, ordered before the frame
(the same "pendingRead" ordering mount already uses), or stop re-reading
the frame on `hashchange` when an input key is linked and changed.

## 2. `predict.at` can't see the next step

**Where:** `defineExplainer({ predict: { at } })` in `explainer.ts`.
**What:** `at(step, frame)` decides whether to stop, `truth(next, held)`
grades. To stop only where the *next* frame is answerable (in `/qa` §01:
"stop where a new category starts"), every frame has to carry a
precomputed lookahead field (`nextCat`). That's trace data invented only to
feed the predict policy.
**Fix:** pass `next` to `at`: `at(step, frame, next)`. Non-breaking.

## 3. `seed` is per definition, not per instance or link

**Where:** `defineExplainer({ seed })`.
**What:** a flaky-test chapter wants "this exact failing run" in a link.
The seed can't be a prop or a hash key, so it has to move into the input.

## 4. Tour parts break inside a filtered or transformed ancestor

**Where:** `TourCard`, `TourSpotlight` (`components.tsx`).
**What:** both are `position: fixed` but render in place. Put them inside a
sticky header with `backdrop-blur` (a common place for a "Take the tour"
button) and `fixed` resolves against the header: the card renders above
the top of the viewport. The glossary tooltip and shortcuts dialog already
portal; the tour parts don't.
**Fix:** portal both to `document.body` after mount, like the tooltip.

## 5. The kit can't host a walk

**Where:** `defineExplainer` / `createExplainer` vs `useWalk`.
**What:** §05 (be the tester) is a walk: each step waits on the reader's
choice. The kit only wraps `useSimulation`, so this chapter loses
`Narration`, `ExplainerBar`, `EndNote`, keyboard ownership, the duplicate-id
warning and `precomputed`, and re-implements the narration and "why" box by
hand. A walk's path is fully determined by `(input, choices)`, so it is just
as precomputable as a simulation.
**Fix:** `defineExplainer({ walk })` (or `defineWalk`) with `choices` in
the link, and a `Choices` part that renders the options at a choice point.

## 6. Kit parts only work inside an explainer

**Where:** `Narration`, `ExplainerBar` (`kit/parts.tsx`).
**What:** they read the explainer context, so they can't be reused around a
plain `useTrace`/`useWalk`/`useSyncedTracks` player. Every non-kit chapter
in `/qa` re-creates the narration line by hand, and the look drifts.
**Fix:** let the parts take an explicit `{ step, player }` (or export a
small `ExplainerProvider` that adapts any player).

## 7. `fromGraph` forgets node ids

**Where:** `fromGraph` (`graph.ts`).
**What:** symbols are typed (`Sym`), node ids aren't: `delta()` returns
`string | null` and `graph.edges[i].from` is `string`, so a typed state
union needs a cast at every use (`as LifeState | null`).
**Fix:** a second type parameter inferred from `nodes`' keys:
`fromGraph<Sym, Node extends string>`.

## 8. `useTrace` loops on an array rebuilt every render

**Where:** `useTrace` (`use-trace.ts`), with `follow`.
**What:** `useTrace(BUILDS.slice(0, count))` creates a new array every
render; `useTrace` re-anchors on every new array and forces a commit (rule
10a), which renders again: "Maximum update depth exceeded" (React #185),
the whole page dies. `useSimulation` has a development warning for exactly
this ("input rebuilt every render"); `useTrace` has none.
**Fix:** compare steps by key/length before re-anchoring (an equal trace
is not a change), or at least the same dev warning `useSimulation` has.

## 9. No clean way to declare an explainer without input

**Where:** `defineExplainer({ input })`, field-prop typing in
`createExplainer` / `precomputed`.
**What:** a recorded walkthrough (`/qa` §10's shrink and triage) has no
input, but `input.default` is required and must be an object. The obvious
`Record<string, never>` turns the field-prop index signature into
`undefined` for every key, so passing `theme` (a reserved prop) fails to
typecheck: "Property 'theme' is incompatible with index signature". The
workaround is a fake one-field input (`{ report: "checkout" }`).
**Fix:** make `input` optional on `defineExplainer` (default `{}` typed as
`{}` with no field props), or exclude reserved names before mapping.
