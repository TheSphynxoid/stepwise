"use client";

import { useEffect, type ComponentProps, type ReactNode } from "react";
import {
  ChapterNav,
  GlossaryProvider,
  Term,
  TourCard,
  TourSpotlight,
  useChapters,
  useDiscoveries,
  useGuidedTour,
  type Chapter,
  type GlossaryEntry,
  type StepwiseStep,
  type TourStepInput,
} from "@sphynxoid/stepwise";
import { createExplainer, useExplainer } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../theme-provider";
import { think } from "./think.explainer";
import { boundaries } from "./boundaries.explainer";
import { decisions } from "./decisions.explainer";
import { mutation } from "./mutation.explainer";
import { BoundaryView, ThinkView } from "./views";
import { DecisionView, MutationView } from "./design-views";
import { api } from "./api.explainer";
import { ApiView } from "./automation-views";
import { flaky } from "./flaky.explainer";
import { bisect } from "./bisect.explainer";
import { BisectView, FlakyView } from "./ci-views";

// The lesson's client half: explainers (a definition from a *.explainer.ts
// file plus a view, bound by createExplainer), and the shell around the
// server-rendered prose: chapter nav, glossary, and a first-visit tour.

const Think = createExplainer({ definition: think, view: ThinkView });
const Boundaries = createExplainer({ definition: boundaries, view: BoundaryView });
const Decisions = createExplainer({ definition: decisions, view: DecisionView });
const Mutation = createExplainer({ definition: mutation, view: MutationView });
const Api = createExplainer({ definition: api, view: ApiView });
const Flaky = createExplainer({ definition: flaky, view: FlakyView });
const Bisect = createExplainer({ definition: bisect, view: BisectView });

// The server page passes plain data (precomputed traces, ids); the theme
// follows the site's light/dark toggle from here.
export function ThinkClient(props: ComponentProps<typeof Think>) {
  return <Think {...props} theme={useSiteTheme().theme} />;
}
export function BoundariesClient(props: ComponentProps<typeof Boundaries>) {
  return <Boundaries {...props} theme={useSiteTheme().theme} />;
}

export function DecisionsClient(props: ComponentProps<typeof Decisions>) {
  return <Decisions {...props} theme={useSiteTheme().theme} />;
}
export function MutationClient(props: ComponentProps<typeof Mutation>) {
  return <Mutation {...props} theme={useSiteTheme().theme} />;
}

export function ApiClient(props: ComponentProps<typeof Api>) {
  return <Api {...props} theme={useSiteTheme().theme} />;
}

export function FlakyClient(props: ComponentProps<typeof Flaky>) {
  return <Flaky {...props} theme={useSiteTheme().theme} />;
}
export function BisectClient(props: ComponentProps<typeof Bisect>) {
  return <Bisect {...props} theme={useSiteTheme().theme} />;
}

/** The current step's "why": what this moment teaches. */
export function Explain() {
  const { step } = useExplainer<unknown, StepwiseStep<{ explain?: string }>>();
  if (!step?.explain) return null;
  return (
    <div data-stepwise="" className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-primary">Why</span>
      {step.explain}
    </div>
  );
}

const GLOSSARY: GlossaryEntry[] = [
  { id: "sut", term: "System under test (SUT)", definition: <>Whatever the tests are pointed at: a function, a service, a whole app. Here, Tidepool Tickets.</> },
  { id: "oracle", term: "Test oracle", definition: <>How a test knows the right answer: a spec, a second implementation, a rule like &quot;never negative&quot;. Without an oracle a test can run but can&apos;t judge.</> },
  { id: "partition", term: "Equivalence partition", definition: <>A group of inputs the system should treat the same way (all child ages, say). One value per partition checks the rule; it can&apos;t check where the partition ends. See <Term id="boundary">boundary value</Term>.</> },
  { id: "boundary", term: "Boundary value analysis", definition: <>Testing the values on each side of every edge of a <Term id="partition">partition</Term>: min-1, min, max, max+1. Off-by-one bugs live here.</> },
  { id: "decision-table", term: "Decision table", definition: <>A table with one row per combination of conditions and the expected result for each. Complete, but n yes/no conditions make 2<sup>n</sup> rows. See <Term id="pairwise">pairwise</Term>.</> },
  { id: "pairwise", term: "Pairwise (all-pairs) testing", definition: <>Choosing fewer rows of a <Term id="decision-table">decision table</Term> so every pair of conditions still meets in every combination. Catches 2-way interactions; can miss 3-way ones.</> },
  { id: "line-coverage", term: "Line (statement) coverage", definition: <>The share of lines the tests executed. Says nothing about whether the results were checked.</> },
  { id: "branch-coverage", term: "Branch coverage", definition: <>The share of decision outcomes (each <code>if</code> going true and false) the tests executed. Stricter than <Term id="line-coverage">line coverage</Term>, same blind spot.</> },
  { id: "mutation", term: "Mutation testing", definition: <>Making small deliberate bugs (mutants) in the code and running the suite against each. A mutant the suite doesn&apos;t notice &quot;survives&quot; and points to a missing test. Tools: Stryker, PIT, mutmut.</> },
  { id: "state-transition", term: "State transition testing", definition: <>Testing a system as states and the events that move between them: every valid transition, every invalid one (it must be refused), and sequences.</> },
  { id: "negative-test", term: "Negative test", definition: <>A test that something is <em>refused</em>: bad input rejected, a forbidden action blocked. Happy-path tests can&apos;t find a feature that does too much.</> },
  { id: "pyramid", term: "Test pyramid", definition: <>Many fast unit tests, fewer API/integration tests, a few slow <Term id="e2e">end-to-end</Term> tests. Test each thing at the lowest level that can catch it.</> },
  { id: "e2e", term: "End-to-end (E2E) test", definition: <>A test that drives the whole system the way a user would, usually through a browser (Playwright, Cypress, Selenium). Most realistic, slowest, most <Term id="flaky">flaky</Term>.</> },
  { id: "contract-test", term: "Contract test", definition: <>Checks that an API&apos;s responses keep the shape its consumers rely on: every field, every type. A schema check, or consumer-driven with a tool like Pact.</> },
  { id: "flaky", term: "Flaky test", definition: <>A test that passes and fails on the same code. Usually timing (a fixed sleep racing the app), shared state, or order dependence. It teaches the team to ignore red, which is worse than no test.</> },
  { id: "explicit-wait", term: "Explicit wait", definition: <>Waiting for a specific condition (an element visible, a request finished) instead of a fixed time. The cure for most <Term id="flaky">flaky</Term> UI tests.</> },
  { id: "selector", term: "Selector (locator)", definition: <>How a UI test finds an element. Stable: role, label, test id. Fragile: position (<code>nth-child</code>), long CSS paths, generated class names.</> },
  { id: "ci", term: "Continuous integration (CI)", definition: <>Building and testing every change automatically as it lands, so a break is found within minutes and tied to one change. Pipelines run cheap stages first.</> },
  { id: "regression", term: "Regression", definition: <>Something that used to work and broke. Regression testing re-runs existing tests to catch these; a regression test is one added to pin a fixed bug.</> },
  { id: "bisect", term: "git bisect", definition: <>Binary search over history for the commit that introduced a change: test the middle, keep the half that changed. log2(n) steps; <code>git bisect run</code> automates it.</> },
  { id: "risk-based", term: "Risk-based testing", definition: <>Spending test effort where failure is most likely or most costly. The honest answer to &quot;you can&apos;t test everything, so what do you test?&quot;</> },
];

const TOUR: TourStepInput[] = [
  { id: "sut", title: "The system under test", body: "One small, invented product with bugs planted in it. Every chapter tests it a different way.", target: "qa-sut" },
  { id: "player", title: "Step through each technique", body: "→ steps, Play runs it. Where you see Predict, it stops and asks you first: that's the interview practice.", target: "qa-think" },
  { id: "nav", title: "Jump around", body: "Chapters follow the order interviews usually go: test design first, then automation, then process.", target: "qa-nav" },
];

/**
 * First-visit tour, remembered with useDiscoveries. Returns the replay
 * button and the overlay separately: the overlay must not render inside the
 * blurred sticky nav, since backdrop-filter makes `position: fixed` children
 * position against the nav instead of the viewport.
 */
function useIntroTour() {
  const { theme } = useSiteTheme();
  const tour = useGuidedTour(TOUR);
  const { ready, isDiscovered, markDiscovered } = useDiscoveries({ key: "stepwise-qa" });
  const { start } = tour;
  useEffect(() => {
    if (!ready || isDiscovered("qa-intro")) return;
    // A deep link means the reader came for one thing: don't cover it with a tour.
    if (window.location.hash.length > 1) return;
    markDiscovered("qa-intro");
    start();
  }, [ready, isDiscovered, markDiscovered, start]);
  const button = (
    <button type="button" onClick={start} className="shrink-0 font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
      Replay the tour
    </button>
  );
  const overlay = tour.active && tour.current && tour.index !== null && (
    <>
      <TourSpotlight target={tour.current.target ?? null} theme={theme} />
      <TourCard step={tour.current} index={tour.index} total={TOUR.length} onNext={tour.next} onBack={tour.back} onEnd={tour.end} theme={theme} />
    </>
  );
  return { button, overlay };
}

/** The lesson shell: glossary, chapter nav that follows the scroll, the tour. */
export function QaLesson({ chapters, children }: { chapters: Chapter[]; children: ReactNode }) {
  const { theme } = useSiteTheme();
  const nav = useChapters(chapters);
  const intro = useIntroTour();
  return (
    <GlossaryProvider entries={GLOSSARY} theme={theme}>
      <main className="min-h-screen bg-background pb-24 text-foreground">
        <div id="qa-nav" className="sticky top-14 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-2">
            <ChapterNav
              chapters={chapters}
              active={nav.active}
              onNavigate={nav.goTo}
              theme={theme}
              className="static z-auto min-w-0 flex-1 border-transparent bg-transparent shadow-none"
            />
            {intro.button}
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-6 pt-10">{children}</div>
      </main>
      {intro.overlay}
    </GlossaryProvider>
  );
}
