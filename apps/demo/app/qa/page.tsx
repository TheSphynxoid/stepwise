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
import { decisions } from "./decisions.explainer";
import { mutation } from "./mutation.explainer";
import { ApiClient, BoundariesClient, DecisionsClient, Explain, MutationClient, QaLesson, ThinkClient } from "./demo";
import { Answer, C, Chapter, FollowUp, Prose, TryThis } from "./ui";
import { Lifecycle } from "./lifecycle";
import { Pyramid } from "./automation-views";
import { api } from "./api.explainer";
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
const Decisions = precomputed(decisions, DecisionsClient);
const Mutation = precomputed(mutation, MutationClient);
const Api = precomputed(api, ApiClient);

const CHAPTERS: ChapterSpec[] = [
  { id: "approach", label: "How to test" },
  { id: "boundaries", label: "Boundaries" },
  { id: "decisions", label: "Decision tables" },
  { id: "mutation", label: "Coverage" },
  { id: "states", label: "States" },
  { id: "pyramid", label: "Pyramid" },
  { id: "api", label: "API" },
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

        <Chapter
          id="decisions"
          n={3}
          slug="test design"
          title="Decision tables, and when pairwise isn't enough"
          ask={<>&quot;Members get 15% off, promo codes 10%, they don&apos;t stack, and weekdays add 5%. How do you test the pricing?&quot;</>}
        >
          <Prose>
            <p>
              When the result depends on several conditions together, list every combination in a{" "}
              <Term id="decision-table">decision table</Term> and write the expected result next to each. Three yes/no
              conditions make 8 rows. Each row is a test case.
            </p>
            <p>
              Eight is fine. Ten conditions make 1,024, so real teams reach for <Term id="pairwise">pairwise</Term> testing:
              a smaller set where every <em>pair</em> of conditions still meets in every combination. Most bugs come from
              two things interacting, so pairwise usually works. This one doesn&apos;t: the planted bug needs member, promo{" "}
              <em>and</em> weekday together. Run pairwise first, then the full table.
            </p>
          </Prose>
          <Decisions id="dt" predict>
            <Parts ask="Will the shipped price match the spec for this rule?" end="Switch between pairwise and all 8 rows." />
          </Decisions>
          <Answer>
            <p>
              &quot;I&apos;d build a decision table: each combination of member, promo and weekday, with the expected discount
              from the spec. That&apos;s 8 rows, cheap enough to test all of them. If it grew, I&apos;d use pairwise to cut it
              down, but keep the full table for the money-critical combinations, because pairwise misses 3-way
              interactions.&quot;
            </p>
          </Answer>
          <FollowUp q="What's a tool for generating pairwise sets?">
            PICT (Microsoft, free), AllPairs, or the pairwise options in most test-management tools. Knowing one by name is
            enough in an interview.
          </FollowUp>
        </Chapter>

        <Chapter
          id="mutation"
          n={4}
          slug="test quality"
          title="Coverage tells you what ran. Mutation tells you what was checked."
          ask={<>&quot;Our suite has 100% coverage. Is it a good suite?&quot;</>}
        >
          <Prose>
            <p>
              A trap question. <Term id="line-coverage">Line coverage</Term> and{" "}
              <Term id="branch-coverage">branch coverage</Term> count what the tests <em>executed</em>. A test that runs a
              line and checks the wrong thing, or checks nothing, still counts. Watch the weak suite reach 100% on both,
              pass every test, and miss both planted bugs.
            </p>
            <p>
              <Term id="mutation">Mutation testing</Term> asks the real question. Make small bugs on purpose (flip a{" "}
              <C>&lt;</C>, move a limit by one), run the suite against each, and count how many it notices. Every mutant
              that survives is a test you haven&apos;t written.
            </p>
          </Prose>
          <Mutation id="mut" predict>
            <Parts ask="Will this suite notice the mutant?" end="Switch to the strong suite and compare the score." />
          </Mutation>
          <TryThis>
            Compare the two suites&apos; final frames. Both show 100% coverage. Only the score at the top right tells them
            apart.
          </TryThis>
          <Answer>
            <p>
              &quot;Not necessarily. Coverage shows what code ran, not whether the assertions are any good: 100% is a floor
              for spotting untested code, not a measure of quality. I&apos;d look at the assertions and the boundary cases,
              and run mutation testing: the mutation score shows how many injected bugs the suite actually catches.&quot;
            </p>
          </Answer>
          <FollowUp q="Why doesn't everyone run mutation testing?">
            It&apos;s slow: the whole suite runs once per mutant, and real code has thousands. Teams run it on critical modules,
            on changed files only, or nightly instead of on every commit.
          </FollowUp>
        </Chapter>

        <Chapter
          id="states"
          n={5}
          slug="test design"
          title="State transitions: test what must not happen"
          ask={<>&quot;A booking goes draft, held, paid, issued, and can be cancelled or refunded. How do you test the status logic?&quot;</>}
        >
          <Prose>
            <p>
              Draw the <Term id="state-transition">state transition</Term> diagram from the spec, then test two things. Every
              arrow on it should work (that&apos;s the happy-path coverage). And every arrow that <em>isn&apos;t</em> on it
              should be refused: those are <Term id="negative-test">negative tests</Term>, and they find the bugs.
            </p>
            <p>
              This one you do by hand. You&apos;re the tester: from each state, pick an action to try. The diagram shows the
              spec, so you know what should happen. Somewhere, the shipped build allows a transition it shouldn&apos;t. Pick
              a wrong answer early? Scrub back to any earlier choice and pick again: the old path is cut off and replayed
              from there.
            </p>
          </Prose>
          <Lifecycle />
          <TryThis>
            Systematic beats lucky: in each state, try all five actions before moving on. That&apos;s 6 states × 5 actions =
            30 cases, and the bug is one of them.
          </TryThis>
          <Answer>
            <p>
              &quot;I&apos;d draw the state diagram from the spec and build a state table: every state against every event.
              Test each valid transition, then each invalid one to make sure it&apos;s rejected, like refunding an unpaid
              booking or paying a cancelled one. Then sequences: the same action twice, and two users acting on one
              booking at the same time.&quot;
            </p>
          </Answer>
          <FollowUp q="What's 0-switch vs 1-switch coverage?">
            0-switch coverage tests every single transition once. 1-switch (Chow&apos;s) coverage tests every pair of
            consecutive transitions, catching bugs that depend on how you arrived in a state. It&apos;s the state-machine
            version of going from single conditions to pairs.
          </FollowUp>
        </Chapter>
        <Chapter
          id="pyramid"
          n={6}
          slug="automation"
          title="The test pyramid: catch it at the cheapest level"
          ask={<>&quot;Should this check be a unit test, an API test, or a UI test?&quot;</>}
        >
          <Prose>
            <p>
              The quantity bug can be caught three ways. A unit test calls the validator directly. An API test sends a
              request. A UI test drives a real browser. All three fail, as they should. Play them under one clock and
              compare what each one costs.
            </p>
            <p>
              That&apos;s the <Term id="pyramid">test pyramid</Term>: many fast unit tests at the bottom, fewer API tests, a
              handful of slow <Term id="e2e">end-to-end</Term> tests on top. UI tests catch what only a browser can (layout,
              wiring, real clicks), but every one costs seconds and can be <Term id="flaky">flaky</Term>. When the logic can
              be tested lower down, test it lower down.
            </p>
          </Prose>
          <Pyramid />
          <Answer>
            <p>
              &quot;As low as it can go. Pricing and validation rules are unit tests: milliseconds, no flakiness, exact
              failures. Service contracts and status codes are API tests. I keep UI tests for critical user journeys, like
              booking and paying end to end, because they&apos;re slow and brittle. The goal is a pyramid, not an ice-cream
              cone with most of the tests in the UI.&quot;
            </p>
          </Answer>
          <FollowUp q="What's the 'testing trophy'?">
            Kent C. Dodds&apos; variant: integration tests are the widest band, because they give the most confidence per
            test in typical web apps. Same idea, different weights. The shared rule: few slow end-to-end tests.
          </FollowUp>
        </Chapter>

        <Chapter
          id="api"
          n={7}
          slug="automation"
          title="API testing: status codes and contracts"
          ask={<>&quot;How would you test a REST endpoint?&quot;</>}
        >
          <Prose>
            <p>
              Send real requests and assert on three things: the <strong>status code</strong>, the <strong>body</strong>, and
              the <strong>contract</strong>, meaning every field the API promised, with the right type. Then the negative
              cases: invalid data (422), a malformed request (400), something that doesn&apos;t exist (404).
            </p>
            <p>
              The shipped API has three problems, and only one of them is the validator bug you already know. Predict each
              status code before it comes back. The refusal that comes back as <C>200</C>, and the response quietly missing
              a field, are the kinds of bug a <Term id="contract-test">contract test</Term> exists for.
            </p>
          </Prose>
          <Api id="api" predict>
            <Parts ask="Which status code will the shipped API return?" end="Switch to the spec API and replay." />
          </Api>
          <Answer>
            <p>
              &quot;For each endpoint: the happy path with full response validation, status code, body and schema; then
              negative cases, so invalid input gets 4xx with a clear error, plus missing auth, unknown ids and malformed
              JSON; then idempotency, pagination and limits where they apply. I&apos;d automate it in the pipeline with
              something like REST Assured, Postman/Newman, or plain Playwright API requests, plus contract tests if other
              teams consume it.&quot;
            </p>
          </Answer>
          <FollowUp q="400 vs 422? 401 vs 403?">
            400: the request is malformed (bad JSON, wrong types). 422: well-formed, but the values break a rule. 401: we
            don&apos;t know who you are. 403: we know, and you&apos;re not allowed.
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
