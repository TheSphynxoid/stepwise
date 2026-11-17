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
