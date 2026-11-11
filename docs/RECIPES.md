# Recipes

How-tos that span several APIs. Each one came out of a real build that got
stuck on it. The API reference is at
[stepwise.thesphynx.net/docs](https://stepwise.thesphynx.net/docs).

- [An interactive article in Next.js + MDX](#an-interactive-article-in-nextjs--mdx)
- [Shareable links](#shareable-links)
- [Grading a checkpoint](#grading-a-checkpoint)
- [Testing a stepwise page](#testing-a-stepwise-page)
- [Exporting a GIF or video](#exporting-a-gif-or-video)

---

## An interactive article in Next.js + MDX

Interactive explainers mostly live in articles. The complete version of this
recipe is [`examples/next-mdx`](../examples/next-mdx): a binary-search article
with an editable player, predict mode and a glossary. The `/kit` page of the
demo site is the same explainer, with its source.

The explainer comes from the authoring kit (`@sphynxoid/stepwise/core`,
`/kit` and `/kit/server`, experimental: they may change in a minor release).
An author writes a definition and a view; the player, the links, the keyboard,
predict mode and the layout come from the kit.

**1. Install**

```bash
npm install @sphynxoid/stepwise @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
```

**2. `next.config.ts`**: let `.mdx` files be pages. Under Turbopack (the
default since Next 16) loader options must be serializable, so pass remark
plugins by name, not as imported functions.

```ts
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { remarkPlugins: [["remark-gfm"]] }, // by name, not remarkGfm
});

export default withMDX({ pageExtensions: ["ts", "tsx", "mdx"] } satisfies NextConfig);
```

**3. `mdx-components.tsx` at the project root.** The App Router requires this
file. Without it the build fails with an unhelpful
`createContext is not a function`, which looks like a client/server problem
in the library but isn't. Spread `stepwiseComponents` into it, so every
article can use the explainer parts and the glossary without importing them:

```tsx
import type { MDXComponents } from "mdx/types";
import { stepwiseComponents } from "@sphynxoid/stepwise/kit/server";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...stepwiseComponents, ...components };
}
```

`stepwiseComponents` is `Term`, `GlossaryAppendix`, `Stage`, `Narration`,
`StepCode`, `Predict`, `PredictToggle`, `ExplainerBar` and `EndNote`. It comes
from `/kit/server` because a server file can't spread an object exported by a
client module (it only gets references).

**4. `app/layout.tsx`**: the stylesheet (skip it if you use Tailwind, see
the README's Styling section) and the glossary provider around everything, so
every `<Term>` in every article has its definitions.

```tsx
import "@sphynxoid/stepwise/styles.css";
import "./globals.css";
import { GlossaryProvider } from "@sphynxoid/stepwise";
import { GLOSSARY } from "@/lib/glossary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlossaryProvider entries={GLOSSARY}>{children}</GlossaryProvider>
      </body>
    </html>
  );
}
```

```tsx
// lib/glossary.tsx: definitions are ReactNode and may contain further Terms
import { Term, type GlossaryEntry } from "@sphynxoid/stepwise";

export const GLOSSARY: GlossaryEntry[] = [
  { id: "sorted-array", term: "sorted array", definition: "Elements in nondecreasing order." },
  {
    id: "log-time",
    term: "logarithmic time",
    definition: <>Doubling the input adds one step. Binary search on a <Term id="sorted-array" /> runs in it.</>,
  },
];
```

**5. The explainer: three small files beside the simulation.** MDX can't
call functions, so the binding happens in `.ts(x)` files and the article only
renders a tag. Next to the simulation (`lib/binary-search.ts`, a generator
that yields keyed steps) go the definition, the client view and the wrapper.
[`examples/next-mdx`](../examples/next-mdx) is this recipe, complete.

The definition is a plain module (no `"use client"`), so the server can run it
and the client can re-run it when the reader edits the input. Import from
`/core` here: the root entry is a client module.

```ts
// lib/binary-search.ts: the simulation
import type { Simulation, StepwiseStep } from "@sphynxoid/stepwise/core";

export type SearchInput = { arr: number[]; target: number };
export type SearchStep = StepwiseStep<{ kind: "start" | "compare" | "left" | "right" | "found" | "missing"; arr: number[]; lo: number; hi: number; mid: number }>;

export const search: Simulation<SearchInput, SearchStep> = function* ({ arr, target }) { /* yield keyed steps */ };
```

```ts
// lib/binary-search.explainer.ts: the definition
import { defineExplainer } from "@sphynxoid/stepwise/core";
import { search, type SearchInput, type SearchStep } from "./binary-search";

export const binarySearch = defineExplainer<SearchInput, SearchStep>({
  name: "binary-search",
  simulation: search,
  input: {
    default: { arr: [3, 9, 14, 25, 34, 47, 61], target: 34 },
    serialize: ({ arr, target }) => `${arr.join(".")}~${target}`, // #in=3.9.14.25.34.47.61~34
    parse: (raw) => {
      // Validate raw (links come from strangers) and return the parsed input.
      return null; // null ignores the link
    },
  },
  predict: {
    at: (step) => step.kind === "compare",           // a match with no next frame is skipped
    options: [                                       // every possible next frame
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
      { value: "found", label: "Found here" },
    ],
    truth: (next) => next?.kind,                     // graded against the frame after
    feedback: (guess, truth) => (guess === truth ? "Right." : `Not quite: it went ${truth}.`),
    hint: "Compare the highlighted probe with the target.",
  },
});
```

The view is a client component that takes no props and reads the frame from
`useExplainer()`; `createExplainer` binds it to the definition:

```tsx
// components/binary-search-player.tsx: the client view and its binding
"use client";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import type { SearchInput, SearchStep } from "@/lib/binary-search";
import { binarySearch } from "@/lib/binary-search.explainer";

function SearchView() {
  const { step, input, setInput } = useExplainer<SearchInput, SearchStep>();
  if (!step) return null;
  // Draw step.arr and step.lo / hi / mid; a control edits the input.
  return (
    <div>
      <p>{step.arr.join(" ")}</p>
      <button onClick={() => setInput({ ...input, target: input.target + 1 })}>target + 1</button>
    </div>
  );
}

export const BinarySearchClient = createExplainer({ definition: binarySearch, view: SearchView });
```

The wrapper is a plain module (no `"use client"`): it computes the trace
where the page renders and hands it to the client as JSON. Keep `.server.`
out of its name: Remix and React Router treat `*.server.*` files as
server-only modules.

```tsx
// components/binary-search.tsx: the wrapper the article imports
import { precomputed } from "@sphynxoid/stepwise/kit/server";
import { binarySearch } from "@/lib/binary-search.explainer";
import { BinarySearchClient } from "./binary-search-player";

export const BinarySearch = precomputed(binarySearch, BinarySearchClient);
```

What that buys: the page is server-rendered either way, so the first frame
is in the HTML with or without the wrapper. A definition that throws, never
terminates or yields non-JSON data fails the build instead of the reader's
page, and a recorded-only explainer (no definition on the client) ships no
simulation code. Skipping the run on hydration depends on the host: in an
RSC host (the Next.js App Router, as here) the wrapper runs only on the
server, so the client starts from the shipped trace and doesn't re-run the
search. In a non-RSC SSR host (Docusaurus, the Next.js Pages Router, Remix)
the wrapper itself runs again in the browser, so the simulation runs once
there too. Without the wrapper, export `BinarySearchClient` and use that.

**6. Write the article.**

```mdx
{/* app/page.mdx */}
import { BinarySearch } from "@/components/binary-search";

# How binary search finds a number

Binary search needs a <Term id="sorted-array" />, and runs in <Term id="log-time" />.

<BinarySearch id="intro" />

Now you drive. It pauses at every probe: where does the search go?

<BinarySearch id="quiz" target={61} predict>
  <Stage />
  <Narration />
  <PredictToggle />
  <Predict>Will the search go left, right, or stop?</Predict>
  <ExplainerBar />
  <EndNote>Try a target that isn't in the array.</EndNote>
</BinarySearch>

<GlossaryAppendix />
```

- **Give every explainer on a page an `id`.** Each keeps its frame (and its
  input) in the URL under its own keys (`intro.frame`, `quiz.in`); two
  without distinct ids share keys, and development builds warn.
- **Props are data.** `target={61}` overrides one field of the default input
  (the default is a plain object); `input={{ ... }}` replaces it all. Both
  are read once, at mount. Field props are typed from the default input, and
  an unknown or misspelled prop (`autoplay`) is a type error in TSX (MDX
  isn't typechecked, so check names there). A field named like one of the
  explainer's own props (`id`, `theme`, ...) can only be set through
  `input`. The kit's `autoPlay` defaults to false.
- **Children replace the default layout** (`Stage`, `Narration`, `Predict`,
  `StepCode`, `ExplainerBar`, `EndNote`), in any order, with prose in
  `Predict` and `EndNote`, and `PredictToggle`'s children as its label.
- **Keyboard**: ArrowRight, ArrowLeft and Space drive the explainer the
  reader last clicked or focused. Until the reader clicks or focuses one, no
  explainer takes the keys, so Space still scrolls the page. `keys={false}`
  opts one out entirely: clicking it leaves the keys with the others.
- **Checkpoints**: a guess is graded against the frame after the held one,
  so a checkpoint on a frame with no successor is skipped.

The next recipe covers the same links without the kit, and the one after it
the grading that predict mode does for you.

---

## Shareable links

**A simulation's input and frame**: use `syncInput` next to `syncHash`. The
library restores the input on mount, then applies the linked frame to the
trace of *that* input. (Doing it by hand races: the player reads `#frame=`
against the default input's trace, where the frame may not exist.)

```tsx
const [input, setInput] = useState<readonly number[]>([5, 2, 8, 1]);
const sim = useSimulation(insertionSort, input, {
  autoPlay: true,
  syncHash: "frame",
  syncInput: {
    key: "in",
    serialize: (a) => a.join("."),
    // Links come from strangers: validate, and return null to ignore.
    parse: (s) => {
      const a = s.split(".").map(Number);
      return a.length >= 2 && a.length <= 12 && a.every((v) => Number.isInteger(v) && v >= 0 && v <= 99) ? a : null;
    },
    onRestore: setInput,
  },
});
```

If the input has two parts (an array and a target), serialize both into one
value (`"3.9.14.25|34"`), or keep them as one state object. Either way, keep
any separate display copy of the input (a text box's draft value) in sync
from the restored input, not from your defaults.

**Other state next to the frame** (a toggle, a selected tab): use
`readHashParam` / `writeHashParam`, which read and write one `key=value` part
and keep every other part.

```tsx
const mode = readHashParam(window.location.hash, "mode");            // "predict" | null
history.replaceState(null, "", writeHashParam(window.location.hash, "mode", "predict"));
```

**Plain anchors and `syncHash`.** A bare `#section` part is kept, so a page
with `#glossary-invariant` becomes `#glossary-invariant&frame=3`. It works in
the session, but a shared copy of that URL no longer scrolls to the anchor,
because the fragment no longer equals the element's id. If shared anchor
links matter on a page, don't put a `syncHash` player on it, or link to
anchors on another page.

---

## Grading a checkpoint

Pause where the reader should think, ask, grade, continue:

```tsx
const [predict, setPredict] = useState(false);
const sim = useSimulation(binarySearch, input, {
  autoPlay: true,
  holdAt: (_, step) => predict && step?.kind === "compare",
});
const { player } = sim;

// The truth is the next frame: whatever the algorithm actually did.
const truth = player.held !== null ? sim.steps[player.held + 1]?.kind : undefined;

const [guess, setGuess] = useState<"left" | "right" | "found" | null>(null);
const answer = useEvaluator(
  (g: typeof guess) =>
    g === null ? fail("Pick an answer first.") : g === truth ? pass("Right.") : fail("Look at a[mid] and the target."),
  guess,
  { mode: "manual" }
);

// A new checkpoint is a new question: clear the guess and the attempt count.
const { reset } = answer;
useEffect(() => {
  setGuess(null);
  reset();
}, [player.held, reset]);

// UI while held: options → setGuess, Check → answer.check(),
// Continue (after a pass) or Skip → player.release()
```

- **Every possible next frame needs an answer option.** Binary search can go
  left, go right, or find the target: a left/right question is sometimes
  unanswerable.
- **A held player waits.** Nothing resumes until `release()` or play.
- **Manual mode clears the verdict on a new guess, not the attempt count**:
  attempts stay for "show a hint after two tries" until you `reset()`.

---

## Testing a stepwise page

**Unit tests: test the trace.** `runSimulation` is pure, so a trace is plain
data in any runner, no DOM:

```ts
import { runSimulation } from "@sphynxoid/stepwise";

const { steps } = runSimulation(binarySearch, { arr: [1, 3, 5, 7], target: 5 });
// The keys your generator yields: here, compare at mid=1, go right, compare, found.
expect(steps.map((s) => s.key)).toEqual(["start", "c0", "r0", "c1", "f1"]);
```

It's also the fastest way to debug a simulation: print the keys. (A test
runner is fine with the root entry; a server component or a build script
should import `runSimulation` from `@sphynxoid/stepwise/core`, since the root
is a client module. An explainer definition is tested the same way:
`precompute(definition, input).steps`.)

**Browser tests:**

- Put `data-testid` on your own elements (the narration line, the
  checkpoint panel). A playing player re-renders every tick, and
  accessible-name locators that wait for the page to settle can stall on it.
- Test linked URLs with reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`):
  autoplay stays paused, so the linked frame holds still while you assert.
- To test playback itself, leave motion on and poll for progress instead of
  sleeping: `expect.poll(() => scrubber.getAttribute("aria-valuenow"))`.

**ESM only.** The package has no CommonJS entry. A `.ts` script that your
runner compiles to CommonJS fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`; name it
`.mts`, or use `await import("@sphynxoid/stepwise")`.

---

## Exporting a GIF or video

stepwise is for explainers the reader drives, but you'll still want a clip of
yours for a post or a README. Because every screen is a function of the step
you're on, a clip is a loop: go to step *i*, screenshot, repeat.
[`examples/export-video`](../examples/export-video) does exactly that with
Playwright:

```bash
cd examples/export-video && npm install
node record.mjs http://localhost:3000/article --selector "#sort-card" --out sort.gif
```

It loads the page with **reduced motion**, so the player never autoplays, then
clicks the `PlayerBar`'s Next button until the scrubber's `aria-valuenow`
reaches `aria-valuemax`, taking a shot after each step (plus one halfway
through the transition, `--tween`). The core of it:

```js
const page = await browser.newPage({ reducedMotion: "reduce" });
await page.goto(url);
const next = page.getByRole("button", { name: "Next step" });
const scrubber = page.getByRole("slider", { name: "Frames" });
await shot();
while (Number(await scrubber.getAttribute("aria-valuenow")) <
       Number(await scrubber.getAttribute("aria-valuemax"))) {
  await next.dispatchEvent("click"); // no hover or focus ring in the shot
  await page.waitForTimeout(300);    // let CSS transitions finish
  await shot();
}
```

- **Same clip every time.** Simulations are pure and `createRng` is seeded, so
  a `#in=…&frame=…` link from `syncInput` records the exact run you linked.
- **Custom controls.** No `PlayerBar`? Pass `--next` / `--scrubber` with your
  own controls' accessible names, or drive the player through its hash
  (with `syncHash: "frame"`, set `location.hash = "frame=7"` for the eighth
  frame; it's 0-based) and screenshot after each change.
- **MP4.** `--frames frames` also writes every shot as a PNG; then
  `ffmpeg -framerate 2 -i frames/%04d.png -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -pix_fmt yuv420p out.mp4`
  (the pad makes the size even, which H.264 needs).
- **Showing edits.** To record someone changing the input mid-run (like the
  landing hero's GIF), click your own controls between steps. A GIF has no
  mouse pointer, so draw a marker where you click:
  `apps/demo/scripts/record-helpers.mjs` has one (`recordClick`).

**What this isn't:** smooth, frame-accurate animation. The clip is a sequence
of steps with CSS transitions caught at fixed delays, which is right for
"watch the algorithm" clips. If every in-between frame must be exact (the
video is the product), use a tool whose rendering is a function of time,
like Remotion or Motion Canvas, or animate with the GSAP adapter, whose
timelines can be seeked.
