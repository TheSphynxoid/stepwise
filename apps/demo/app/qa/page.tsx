import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GlossaryAppendix, Term, type Chapter as ChapterSpec } from "@sphynxoid/stepwise";
import { EndNote, ExplainerBar, Narration, Predict, PredictToggle, Stage } from "@sphynxoid/stepwise/kit";
import { precomputed } from "@sphynxoid/stepwise/kit/mdx";
import { ViewSource } from "../view-source";
import { think } from "./think.explainer";
import { boundaries } from "./boundaries.explainer";
import { BoundariesClient, Explain, QaLesson, ThinkClient } from "./demo";
import { Answer, C, Chapter, FollowUp, Prose, TryThis } from "./ui";
import { PRICES, SPEC } from "./tidepool";

export const metadata: Metadata = {
  title: "The QA Engineer interview",
  description: "Test design and automation for a QA Engineer interview, practised on one small system with planted bugs.",
};

// A server component: the prose, and one precomputed explainer per
// chapter. Traces are computed at build time and shipped as JSON; the
// browser re-runs a definition only when the reader edits its input.

const Think = precomputed(think, ThinkClient);
const Boundaries = precomputed(boundaries, BoundariesClient);

const CHAPTERS: ChapterSpec[] = [
  { id: "approach", label: "How to test" },
  { id: "boundaries", label: "Boundaries" },
  { id: "glossary", label: "Glossary", numbered: false },
];

function Parts({ ask, end }: { ask?: ReactNode; end: ReactNode }) {
  return (
    <>
      <Stage />
      <Narration />
      <Explain />
      {ask && <PredictToggle>Predict before each reveal</PredictToggle>}
      {ask && <Predict>{ask}</Predict>}
      <ExplainerBar />
      <EndNote>{end}</EndNote>
    </>
  );
}

/** The spec sheet of the system every chapter tests. */
function SystemUnderTest() {
  return (
    <div id="qa-sut" className="mb-16 max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-1.5 font-mono text-[10.5px] text-muted-foreground">
        <span>SPEC.md · Tidepool Tickets</span>
        <span className="text-destructive">bugs planted: several</span>
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 px-4 py-3 font-mono text-[12px] text-foreground/80 sm:grid-cols-2">
        <li>age: whole number, 0 to 120</li>
        <li>
          child under {SPEC.childBelow}: ${PRICES.child}
        </li>
        <li>
          adult {SPEC.childBelow} to {SPEC.seniorFrom - 1}: ${PRICES.adult}
        </li>
        <li>
          senior {SPEC.seniorFrom}+: ${PRICES.senior}
        </li>
        <li>tickets: 1 to {SPEC.qtyMax} per booking</li>
        <li>codes: SURF10 (10% off), TIDE5 ($5 off)</li>
        <li>discounts: member 15%, promo 10% (no stacking), weekday +5%</li>
        <li>status: draft → held → paid → issued</li>
        <li>API: POST /bookings → 201, bad input → 422</li>
        <li>UI: Book button renders after a network call</li>
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <QaLesson chapters={CHAPTERS}>
        <Link href="/#demos" className="mb-6 inline-flex items-center gap-2 font-mono text-[12px] text-muted-foreground transition hover:text-foreground">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="sw-fade-up mb-2 font-mono text-[11px] uppercase tracking-widest text-primary">Lesson · QA engineering</p>
        <h1 className="sw-fade-up sw-fade-up-1 mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">Pass the QA Engineer interview</h1>
        <div className="sw-fade-up sw-fade-up-2 mb-8 max-w-2xl space-y-3 text-[14px] leading-relaxed text-muted-foreground">
          <p>
            You can code. A QA Engineer interview checks something else: whether you can <em>find the bugs other people
            missed</em>, explain how, and make a machine keep finding them. It usually has three parts: an open &quot;how would
            you test this?&quot;, questions on test-design techniques, and a conversation about automation and CI.
          </p>
          <p>
            Every chapter here takes one question interviewers actually ask, shows the technique working (or failing) on a real
            run, and ends with the answer to give in 30 seconds. One small product is tested throughout, with bugs planted in it.
            Your job is to find them.
          </p>
        </div>
        <SystemUnderTest />

        <Chapter id="approach" n={1} slug="approach" title="How would you test this?" ask={<>&quot;Here&apos;s our booking form. How would you test it?&quot;</>}>
          <Prose>
            <p>
              The most common opening question, and the easiest to fumble. Listing tests as they come to mind sounds
              unprepared, and you forget whole areas. Walk a fixed list of categories instead, out loud, a couple of ideas
              each. The interviewer is grading the structure more than the ideas.
            </p>
            <p>
              Then, since you can&apos;t test everything, say what you&apos;d test <em>first</em> and why. That&apos;s{" "}
              <Term id="risk-based">risk-based testing</Term>: the money path and anything that loses data come before a
              misaligned tooltip.
            </p>
          </Prose>
          <Think id="think" predict>
            <Parts ask="Which category comes next in the sweep?" end="That's a complete answer. Switch the feature and do it again." />
          </Think>
          <TryThis>
            Switch to <C>api</C> and play it with predict on. Each category still applies, just with different ideas. That&apos;s
            the point of a fixed sweep: it works on anything.
          </TryThis>
          <Answer>
            <p>
              &quot;I&apos;d start by clarifying requirements, then go category by category: happy path, boundaries, negative
              inputs, state and concurrency, integration with the API, UI and accessibility, then non-functional: performance
              and security. I&apos;d prioritise by risk, so payment and pricing first.&quot;
            </p>
          </Answer>
          <FollowUp q="Test a pen. / Test a lift. / Test a vending machine.">
            The same sweep works on objects. A lift: happy path (call it, it comes), boundaries (top and bottom floor, max
            load), negative (press every button at once), state (doors open while moving?), integration (fire alarm),
            usability (braille, reachable buttons), non-functional (time to arrive, power cut).
          </FollowUp>
        </Chapter>

        <Chapter
          id="boundaries"
          n={2}
          slug="test design"
          title="Partitions and boundaries"
          ask={<>&quot;The age field accepts 0 to 120, and under-12s pay the child price. Which values do you test?&quot;</>}
        >
          <Prose>
            <p>
              Split the inputs into <Term id="partition">equivalence partitions</Term>: groups the system should treat the
              same. Here: invalid low, child, adult, senior, invalid high. One value from each is a fair start, and five
              tests instead of 121 is the whole point of the technique.
            </p>
            <p>
              But the shipped code has a planted bug, and one value per partition can&apos;t see it. Run the default probes
              and watch them all pass. Then switch to the <strong>boundaries</strong> preset:{" "}
              <Term id="boundary">boundary value analysis</Term> tests both sides of every edge, because that&apos;s where a{" "}
              <C>&lt;</C> written as <C>&lt;=</C> hides.
            </p>
          </Prose>
          <Boundaries id="bnd" predict>
            <Parts ask="Will the spec and the shipped build agree on this age?" end="Type your own ages, or try the other preset." />
          </Boundaries>
          <TryThis>
            Type just <C>11, 12, 13</C>. Three probes on one edge find what five probes across the range missed.
          </TryThis>
          <Answer>
            <p>
              &quot;Partition the range into classes the system treats alike, take one value per class, then test the
              boundaries: min-1, min, max, max+1 for each edge. So -1, 0, 11, 12, 64, 65, 120 and 121, plus non-numbers and
              decimals as negative cases.&quot;
            </p>
          </Answer>
          <FollowUp q="Why both sides of the edge, not just the edge itself?">
            An off-by-one moves an edge one step either way. Testing 12 alone catches <C>age &lt; 13</C> (12 becomes a
            child) but not <C>age &lt; 11</C>, which only 11 shows (11 becomes an adult). The last value inside and the first
            value outside pin the edge from both directions.
          </FollowUp>
        </Chapter>

        <section id="glossary" className="scroll-mt-32">
          <GlossaryAppendix title="Glossary" intro={<>Every term the lesson defines. Interviewers use these words; now you can too.</>} className="mt-0" />
        </section>
      </QaLesson>
      <ViewSource file="app/qa/page.tsx" />
      <ViewSource file="app/qa/demo.tsx" />
      <ViewSource file="app/qa/views.tsx" />
    </>
  );
}
