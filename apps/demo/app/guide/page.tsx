import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Example } from "./example";
import { GuideNav } from "./guide-nav";
import { FirstPlayer } from "./examples/first-player";
import { LiveSort } from "./examples/simulation";
import { LinkedSort } from "./examples/links";
import { PredictSort } from "./examples/predict";
import { LiveFeed } from "./examples/live";
import { CounterTour } from "./examples/tour";
import { HashGlossary } from "./examples/glossary";
import { PivotWalk } from "./examples/walk";
import { ThemedSorting } from "./examples/kit/sorting";
import { Boot } from "./examples/step-parts";

export const metadata: Metadata = {
  title: "Guide",
  description: "Learn stepwise by goal: a first player, live simulations, links, predict mode, tours, scroll lessons, branching walks and the authoring kit, each with a live example.",
};

// ─── Small building blocks for the prose ─────────────────────────────────────

function Section({ id, kicker, title, children }: { id: string; kicker?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-border/60 pt-12 mt-12">
      {kicker && <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">{kicker}</p>}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

function When({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border-l-2 border-primary/60 bg-primary/5 px-4 py-3 text-[14px] text-foreground/85">
      <strong className="font-semibold text-foreground">Reach for this when </strong>
      {children}
    </p>
  );
}

function Watch({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13.5px]">
      <p className="mb-1 font-semibold text-foreground">Watch out</p>
      <ul className="list-disc space-y-1 pl-5">{children}</ul>
    </div>
  );
}

function Experimental() {
  return (
    <p className="text-[13px] text-muted-foreground">
      Experimental: this may still change in a minor release. Pin the version if you depend on it.
    </p>
  );
}

function SeeLive({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="text-[13px]">
      A bigger version: <Link href={href} className="text-primary hover:underline">{children}</Link>
    </p>
  );
}

const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[0.88em] text-foreground">{children}</code>;

function Snippet({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-card px-4 py-3 font-mono text-[12.5px] leading-6 text-foreground/85">
      {children}
    </pre>
  );
}

// ─── Common mistakes: what you see, why, what to do ──────────────────────────

const MISTAKES: { see: ReactNode; why: ReactNode; fix: ReactNode }[] = [
  {
    see: "Every stepwise component renders unstyled: the tour card is a full-width strip at the bottom of the page, the bar has no colors.",
    why: <>No stylesheet reaches the components. Tailwind v4 skips <C>node_modules</C>, where the package lives.</>,
    fix: <>Import <C>@sphynxoid/stepwise/styles.css</C> once, or add the <C>@source</C> line from <a href="#start" className="text-primary">Start here</a>.</>,
  },
  {
    see: "The page crashes with “can’t access lexical declaration before initialization”, or the player restarts on every render.",
    why: "The steps are built inside the component (a new array every render) or refer to a constant declared further down.",
    fix: <>Build traces at module scope, once, with <C>createTrace</C> or a constant.</>,
  },
  {
    see: "Before pressing play, the view shows nothing, or the last frame.",
    why: <><C>player.index</C> is <C>-1</C> until playback starts, and <C>steps[-1]</C> is <C>undefined</C>.</>,
    fix: <>Render <C>step</C> from <C>useTrace</C> / <C>useSimulation</C>: it is frame 0 before the start.</>,
  },
  {
    see: "After editing the input, the player jumps to an unrelated moment.",
    why: <>The steps have no <C>key</C>, so the player can only keep the same index.</>,
    fix: <>Give every yielded step a <C>key</C> naming its moment (<C>{"`swap ${i}.${j}`"}</C>).</>,
  },
  {
    see: "Every frame shows the final state.",
    why: "The generator yields the same array each time and keeps mutating it.",
    fix: <>Yield copies: <C>arr: [...a]</C>.</>,
  },
  {
    see: "The simulation recomputes on every render (development builds warn about it).",
    why: <>The input is an object literal written inline: <C>{"useSimulation(sim, { arr, target })"}</C> is a new object each time.</>,
    fix: <>Keep the input in state, or <C>useMemo</C> it.</>,
  },
  {
    see: "A shared link opens on the wrong frame.",
    why: "The input was restored from the URL by hand, after the player had already applied the frame to the default input.",
    fix: <>Use <C>syncInput</C>: it restores the input first, then the frame.</>,
  },
  {
    see: "Playback stops at a checkpoint and never continues.",
    why: "A held player waits for you on purpose.",
    fix: <>Wire a Continue (or Skip) button to <C>player.release()</C>.</>,
  },
  {
    see: <>A type error on a tone such as <C>&quot;contrast&quot;</C>.</>,
    why: "There are exactly six tones.",
    fix: <><C>neutral</C>, <C>accent</C>, <C>good</C>, <C>bad</C>, <C>write</C>, <C>idle</C>.</>,
  },
  {
    see: <>A server component calls <C>runSimulation</C> or <C>precompute</C> and gets “not a function”.</>,
    why: <>It imported from the package root, which is a client module.</>,
    fix: <>Import pure functions from <C>@sphynxoid/stepwise/core</C>.</>,
  },
  {
    see: <>Next.js + MDX: “createContext is not a function”.</>,
    why: <><C>mdx-components.tsx</C> is missing at the project root.</>,
    fix: <>Add it and spread <C>stepwiseComponents</C> into it (see <a href="#kit" className="text-primary">the kit</a>).</>,
  },
  {
    see: "Two players on one page fight over the URL.",
    why: <>They both write <C>#frame=</C>.</>,
    fix: <>Give each its own key (<C>syncHash: &quot;a.frame&quot;</C>), or, for kit explainers, its own <C>id</C>.</>,
  },
  {
    see: "A walk never stops to ask; the choice comes back undefined.",
    why: <>The step that asks is missing <C>await: true</C>.</>,
    fix: <>Mark every choice point with <C>await: true</C>.</>,
  },
  {
    see: <>A kit explainer with an <C>id</C> field in its input ignores <C>{'<X id="..." />'}</C> as input.</>,
    why: <>A few prop names are reserved (<C>id</C>, <C>input</C>, <C>predict</C>, <C>link</C>, <C>autoPlay</C>, …) and always mean the prop.</>,
    fix: <>Pass that field through <C>{"input={{ ... }}"}</C>.</>,
  },
  {
    see: <><C>require(&quot;@sphynxoid/stepwise&quot;)</C> fails.</>,
    why: "The package is ESM only.",
    fix: <>Use <C>import</C>, or <C>await import()</C> from CommonJS.</>,
  },
];

// ─── Words used here ─────────────────────────────────────────────────────────

const WORDS: { word: string; meaning: ReactNode }[] = [
  { word: "Step / frame", meaning: <>One moment of what you&apos;re explaining: a <C>tone</C>, a <C>label</C>, and your own data. A trace is the list of them.</> },
  { word: "Tone", meaning: "The kind of moment (neutral, accent, good, bad, write, idle). It colors the scrubber so a reader can see the shape of the run." },
  { word: "Player", meaning: <>The state that moves through the steps: play, pause, next, seek, speed. <C>PlayerBar</C> is its controls.</> },
  { word: "Simulation", meaning: <>A generator function that produces the steps from an input. Change the input and the steps are produced again.</> },
  { word: "Key", meaning: "A step's name for its moment (\"swap 2.1\"). When the steps are recomputed, the player looks for the same key so it stays on the same moment." },
  { word: "Re-anchoring", meaning: "That “stay on the same moment” behavior after the steps change." },
  { word: "Checkpoint", meaning: <>A frame where playback pauses and waits (<C>holdAt</C>), usually to ask the reader something.</> },
  { word: "Evaluator / verdict", meaning: <>A function that grades something and returns <C>pass(…)</C>, <C>fail(…)</C> or pending, with feedback.</> },
  { word: "Walk / choice point", meaning: "A simulation that stops to ask the reader and branches on the answer. The step that asks is a choice point." },
  { word: "Explainer", meaning: "The kit's bundle: a definition (simulation + input + options) and a view, as one component." },
  { word: "Precompute", meaning: "Running the definition ahead of time, on the server or at build time, and shipping the finished steps as JSON." },
  { word: "Step parts", meaning: <>The kit&apos;s ready-made pieces around a player: <C>Narration</C>, <C>StepCode</C>, <C>ExplainerBar</C>, <C>EndNote</C>.</> },
];

// ─── The page ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-background text-foreground pt-12 pb-24">
      <div className="mx-auto max-w-3xl px-6">
        <article className="min-w-0">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-primary">Guide</p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight">Learn stepwise by building with it</h1>
          <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
            stepwise is a set of React hooks and components for explainers a reader can step through: an algorithm, a
            protocol, a product feature. This guide goes from a first player to the experimental parts, one goal at a
            time. Every example on this page is running, and the code under it is its real source (minus a line or two
            that hooks it into this site&apos;s light/dark switch). For every option of every hook, see the{" "}
            <Link href="/docs" className="text-primary hover:underline">API reference</Link>.
          </p>
          <GuideNav />

          <Section id="start" kicker="Basics" title="Start here">
            <p>Install the package. It needs React 18 or 19 and is ESM only.</p>
            <Snippet>npm install @sphynxoid/stepwise</Snippet>
            <p>
              The hooks have no styles at all. The ready-made components (the player bar, the tour card, the glossary
              tooltip) need one of these, depending on your app:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-muted-foreground">
                  <tr><th className="py-2 pr-4 font-medium">Your app</th><th className="py-2 font-medium">Do this once</th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr><td className="py-2 pr-4">No Tailwind</td><td className="py-2"><C>import &quot;@sphynxoid/stepwise/styles.css&quot;;</C> in your entry or root layout</td></tr>
                  <tr><td className="py-2 pr-4">Tailwind v4</td><td className="py-2"><C>@source &quot;../node_modules/@sphynxoid/stepwise/dist&quot;;</C> in your CSS entry, next to <C>@import &quot;tailwindcss&quot;</C></td></tr>
                  <tr><td className="py-2 pr-4">shadcn/ui</td><td className="py-2"><C>npx shadcn@latest add https://stepwise.thesphynx.net/r/player-bar.json</C> copies the component into your code</td></tr>
                </tbody>
              </table>
            </div>
            <p>Then a first player: four steps, built once, and the bar that plays them. Press play, or drag the scrubber.</p>
            <Example files={["examples/first-player.tsx"]}>
              <FirstPlayer />
            </Example>
            <p>
              That&apos;s the whole pattern: you describe the steps, stepwise gives you the one on screen and a player
              to move through them, and you draw it however you like (HTML, SVG, canvas).
            </p>
          </Section>

          <Section id="idea" kicker="Basics" title="The idea">
            <p>
              Frames of an animation, steps of a product tour and chapters of a long article look like different things,
              but each is a <strong>position in an ordered list</strong>: you&apos;re on one, you can go to the next, the
              previous, or jump. stepwise has one piece of state for that (<C>useSteps</C>) and builds everything else on
              it, which is why a scroll lesson, an embedded player and a tour can share one page and stay in sync.
            </p>
            <p>
              A <strong>step</strong> is a plain object: a <C>label</C> (what&apos;s happening, in words), a{" "}
              <C>tone</C>, and whatever data your view needs. Optional fields: <C>code</C> (lines to show beside it) and{" "}
              <C>key</C> (its name, covered next). The tone is one of six (<C>neutral</C>, <C>accent</C>, <C>good</C>,{" "}
              <C>bad</C>, <C>write</C>, <C>idle</C>) and colors the scrubber, so a reader sees where the interesting
              moments are before playing.
            </p>
            <p>The rest of this guide is recipes: pick the one that matches what you&apos;re building.</p>
          </Section>

          <Section id="trace" kicker="Recipe" title="A fixed trace">
            <When>you already know every step: a walkthrough you wrote by hand, a recorded run, a protocol diagram.</When>
            <p>
              That&apos;s the first example above: <C>createTrace</C> to build the steps (typed, at module scope), <C>useTrace</C>{" "}
              to get the current step and a player, <C>PlayerBar</C> for the controls. Add <C>autoPlay: true</C> to start
              on its own (it stays paused for readers who ask for reduced motion), and <C>syncHash: &quot;frame&quot;</C> to
              put the position in the URL.
            </p>
            <Watch>
              <li>Build the steps outside the component. Inside it, they&apos;re a new list every render.</li>
              <li>Render <C>step</C>, not <C>steps[player.index]</C>: the index is -1 until playback starts.</li>
            </Watch>
            <SeeLive href="/player">the TCP handshake player</SeeLive>
          </Section>

          <Section id="simulation" kicker="Recipe" title="A trace computed from an input">
            <When>the reader should be able to change the input (the numbers to sort, the word to parse) and watch the run change.</When>
            <p>
              Instead of listing steps, write the algorithm once as a <strong>generator</strong>: each <C>yield</C> is a
              step. <C>useSimulation</C> runs it for the current input, and runs it again when the input changes. Click a
              bar below while it plays: the sort re-runs on the new numbers and the player carries on from the{" "}
              <em>same moment</em>, not from the same position number.
            </p>
            <Example files={["examples/simulation.tsx"]} caption="Click any bar to change its value, even mid-playback.">
              <LiveSort />
            </Example>
            <p>
              That &ldquo;same moment&rdquo; comes from <C>key</C>: each step names its moment (<C>swap 3.2</C>), and
              after a re-run the player looks for the same key. If you need randomness, use the seeded <C>rng</C> the
              generator receives as its second argument, never <C>Math.random</C>, so a run can be replayed exactly.
            </p>
            <Watch>
              <li>Yield copies (<C>[...a]</C>). Yielding the array you keep mutating makes every frame show the end state.</li>
              <li>An object input must keep its identity: hold it in state or <C>useMemo</C>, not inline.</li>
              <li>To test the algorithm without React, <C>runSimulation(sim, input).steps</C> gives you the list.</li>
            </Watch>
            <SeeLive href="/simulate">the /simulate demo</SeeLive>
          </Section>

          <Section id="links" kicker="Recipe" title="Shareable links">
            <When>a reader should be able to send someone exactly what they&apos;re looking at: this input, this frame.</When>
            <p>
              <C>syncHash</C> keeps the frame in the URL fragment; <C>syncInput</C> keeps the input there too, with your
              own <C>serialize</C> / <C>parse</C>. On load, the library restores the input first and the frame second, so
              the link lands on the right step. Change a bar, step forward, copy the link, open it in a new tab.
            </p>
            <Example files={["examples/links.tsx"]}>
              <LinkedSort />
            </Example>
            <Watch>
              <li>Don&apos;t read the URL yourself in an effect: by then the frame was applied to the default input. <C>syncInput</C> gets the order right.</li>
              <li><C>parse</C> should reject anything it doesn&apos;t understand (return <C>null</C>); links get edited by hand.</li>
              <li>Several players on one page each need their own keys.</li>
            </Watch>
          </Section>

          <Section id="predict" kicker="Recipe" title="Pause and predict">
            <When>you want the reader to think before they watch: guess the next step, then see if they were right.</When>
            <p>
              Two pieces. <C>holdAt</C> marks checkpoints: playback pauses there until you call <C>player.release()</C>.{" "}
              <C>useEvaluator</C> grades an answer and gives you a verdict (<C>pass</C> / <C>fail</C> with feedback, and
              an attempt count). The right answer is simply what the next frame does. Press play:
            </p>
            <Example files={["examples/predict.tsx"]}>
              <PredictSort />
            </Example>
            <Watch>
              <li>A checkpoint only holds playback; Next and the scrubber still move freely.</li>
              <li>Reset the guess and the verdict when the checkpoint changes, or the last answer shows on the new question.</li>
            </Watch>
            <SeeLive href="/simulate">predict mode on /simulate</SeeLive>
          </Section>

          <Section id="live" kicker="Recipe" title="Live timelines">
            <When>the steps keep arriving while the reader watches: a log, a job&apos;s progress, an agent&apos;s actions.</When>
            <p>
              Pass a list that grows to <C>useTrace</C> with <C>follow: true</C>. While the reader is at the newest step,
              new ones play in. If they scrub back to read an older one, they stay there, and <C>PlayerBar live</C> shows
              a &ldquo;Go live&rdquo; button to come back. Try scrubbing back, then adding events.
            </p>
            <Example files={["examples/live.tsx"]}>
              <LiveFeed />
            </Example>
            <SeeLive href="/live">the /live demo</SeeLive>
          </Section>

          <Section id="tours" kicker="Recipe" title="Guided tours">
            <When>you&apos;re walking someone through your own interface, and some steps should wait until they&apos;ve actually done something.</When>
            <p>
              A tour is a list of steps, each pointing at an element by id. <C>useGuidedTour</C> moves through them;{" "}
              <C>TourSpotlight</C> highlights the target and <C>TourCard</C> shows the text. A step&apos;s <C>gate</C> keeps
              Next disabled until it returns true (or a passing verdict), with your message in the meantime.
            </p>
            <Example files={["examples/tour.tsx"]}>
              <CounterTour />
            </Example>
            <p>
              Steps can also run code when they open (<C>onEnter</C>: switch a tab, open a panel), skip themselves (
              <C>when</C>) or jump elsewhere (<C>next</C>). To show a tour only once per user, pair it with{" "}
              <C>useDiscoveries</C>, which remembers what someone has seen.
            </p>
            <SeeLive href="/discovery">the show-once tour on /discovery</SeeLive>
          </Section>

          <Section id="chapters" kicker="Recipe" title="Scroll chapters">
            <When>you&apos;re writing a long page and want a table of contents that follows the reader, or a player that follows the scroll.</When>
            <p>
              <C>useChapters</C> takes your sections (by DOM id) and tells you which one is at the middle of the screen.{" "}
              <C>ChapterNav</C> draws the list. The live example is this page: the chapter bar that stays at the top of the
              screen as you scroll is exactly this code.
            </p>
            <Example files={["chapters.ts", "guide-nav.tsx"]} />
            <p>
              Because <C>active</C> is just a number, you can feed it to anything, for instance seek an embedded player
              to the frame that matches the chapter being read.
            </p>
            <SeeLive href="/lesson">the composed lesson (chapters drive a player)</SeeLive>
          </Section>

          <Section id="glossary" kicker="Recipe" title="Glossary tooltips">
            <When>your prose uses terms a reader may not know, and you&apos;d rather define them in place than send them away.</When>
            <p>
              Put the definitions in a <C>GlossaryProvider</C>, mark words with <C>Term</C>, and optionally add a{" "}
              <C>GlossaryAppendix</C> that lists them all. Definitions can contain terms of their own. Hover or focus a
              dotted word:
            </p>
            <Example files={["examples/glossary.tsx"]}>
              <HashGlossary />
            </Example>
            <Watch>
              <li><C>Term</C> and <C>GlossaryAppendix</C> must sit inside the provider.</li>
            </Watch>
            <SeeLive href="/glossary">the /glossary demo</SeeLive>
          </Section>

          <Section id="walks" kicker="Experimental" title="Branching walks">
            <Experimental />
            <When>the reader&apos;s answers should change what happens next: a quiz that explores the wrong answer, a &ldquo;choose your path&rdquo; lesson, playing the part of an automaton.</When>
            <p>
              A walk is a simulation that can stop and ask. A step with <C>await: true</C> is a <strong>choice point</strong>:
              the run pauses there, and that <C>yield</C> returns whatever the reader picked. The path taken is still a
              plain list of steps, so the player bar, links and &ldquo;same moment&rdquo; all work as before. Go back and
              pick the other answer: the old ending is replaced.
            </p>
            <Example files={["examples/walk.tsx"]}>
              <PivotWalk />
            </Example>
            <p>
              <C>useWalk</C> comes from <C>@sphynxoid/stepwise/experimental</C>. <C>syncChoices</C> puts the answers in the
              link, and <C>fromGraph</C> builds a walk from a state machine you can also draw.
            </p>
            <SeeLive href="/automaton">/automaton</SeeLive>
          </Section>

          <Section id="kit" kicker="Experimental" title="The authoring kit">
            <Experimental />
            <When>you&apos;re writing several explainers (a course, a blog with interactive figures) and want each to be one tag, with links, keyboard, predict mode and a server-rendered first frame handled for you.</When>
            <p>An explainer is three small files, each on its own side of the server/browser line:</p>
            <ol className="list-decimal space-y-1 pl-6">
              <li><strong>The definition</strong> (<C>sorting.explainer.ts</C>): the simulation, the default input, how it goes in a link, where predict mode asks. Plain code, so the server can run it too.</li>
              <li><strong>The view</strong> (<C>sorting-player.tsx</C>): how a step looks. It reads the step with <C>useExplainer()</C>; <C>createExplainer</C> joins it to the definition.</li>
              <li><strong>The wrapper</strong> (<C>sorting.tsx</C>): <C>precomputed</C> runs the definition on the server, so the first frame is in the HTML and a broken definition fails the build, not the page.</li>
            </ol>
            <p>Then a page (or an MDX file) writes one tag. This one is <C>{'<Sorting id="guide" />'}</C>, with the default layout:</p>
            <Example files={["examples/kit/sorting.explainer.ts", "examples/kit/sorting-player.tsx", "examples/kit/sorting.tsx"]}>
              <ThemedSorting id="guide" />
            </Example>
            <p>
              Children replace the default layout, using the kit&apos;s parts in any order: <C>Stage</C> (your view),{" "}
              <C>Narration</C>, <C>StepCode</C>, <C>Predict</C> and <C>PredictToggle</C>, <C>Choices</C> (for walks),{" "}
              <C>ExplainerBar</C>, <C>EndNote</C>. A prop named after an input field sets it (<C>{"<Sorting arr={[3, 1, 2]} />"}</C>),
              and <C>predict</C> starts in predict mode. In MDX, spread <C>stepwiseComponents</C> into{" "}
              <C>mdx-components.tsx</C> so the parts are available as tags.
            </p>
            <Watch>
              <li>Give each explainer on a page its own <C>id</C>: it namespaces its link (<C>#guide.frame=…</C>).</li>
              <li>The kit&apos;s <C>autoPlay</C> defaults to off.</li>
              <li>A definition can hold a <C>walk</C> instead of a <C>simulation</C>; the bar then has arrows instead of Play, and <C>Choices</C> shows the options.</li>
            </Watch>
            <SeeLive href="/kit">/kit, and the full lessons on /llm and /qa</SeeLive>
          </Section>

          <Section id="step-parts" kicker="Experimental" title="Kit parts, anywhere">
            <When>you like the kit&apos;s narration line, code panel and bar but your player is a plain <C>useTrace</C>, <C>useSimulation</C> or <C>useWalk</C>.</When>
            <p>Wrap it in <C>StepParts</C> and the parts read from it, no explainer needed.</p>
            <Example files={["examples/step-parts.tsx"]}>
              <Boot />
            </Example>
          </Section>

          <Section id="mistakes" title="Common mistakes">
            <p>What you see, why it happens, and the fix. Most of these cost someone an afternoon.</p>
            <div className="space-y-3">
              {MISTAKES.map((m, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/40 px-4 py-3 text-[13.5px]">
                  <p className="font-medium text-foreground">{m.see}</p>
                  <p className="mt-1 text-muted-foreground"><span className="font-mono text-[11px] uppercase tracking-wider">Why </span>{m.why}</p>
                  <p className="mt-1"><span className="font-mono text-[11px] uppercase tracking-wider text-primary">Fix </span>{m.fix}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="words" title="Words used here">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
              {WORDS.map((w) => (
                <div key={w.word} className="contents">
                  <dt className="font-semibold text-foreground">{w.word}</dt>
                  <dd className="text-foreground/75">{w.meaning}</dd>
                </div>
              ))}
            </dl>
            <p className="pt-4 text-[13px] text-muted-foreground">
              Building with an AI assistant? Point it at <a href="/llms-full.txt" className="text-primary hover:underline">/llms-full.txt</a>:
              the same material, condensed, plus the whole API reference in one file.
            </p>
          </Section>
        </article>
      </div>
    </main>
  );
}
