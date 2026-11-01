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
with an editable player, predict mode and a glossary.

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
in the library but isn't.

```tsx
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return components;
}
```

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

**5. Write the article.** Interactive pieces are client components in their
own files (`"use client"` at the top); the library's components can be used
straight from MDX.

```mdx
{/* app/page.mdx */}
import { Term, GlossaryAppendix } from "@sphynxoid/stepwise";
import { BinarySearchPlayer } from "@/components/binary-search-player";

# How binary search finds a number

Binary search needs a <Term id="sorted-array" />, and runs in <Term id="log-time" />.

<BinarySearchPlayer />

<GlossaryAppendix />
```

The player itself is an ordinary `useSimulation` component: see the README's
"Live simulations" section, and the next recipe to make its links shareable.

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

It's also the fastest way to debug a simulation: print the keys.

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
