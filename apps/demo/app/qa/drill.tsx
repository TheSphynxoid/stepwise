"use client";

import { useState } from "react";
import { LessonPager, useDiscoveries, useSteps } from "@sphynxoid/stepwise";

// §11: the interview drill. A deck of the questions this lesson prepares
// you for. The deck is a useSteps cursor (the same primitive as every
// player on the page); what you already know is a useDiscoveries ledger,
// so it survives reloads. Answer out loud first, then reveal.

type Card = { id: string; q: string; a: string[]; chapter: string; chapterLabel: string };

const CARDS: Card[] = [
  {
    id: "login",
    q: "How would you test a login page?",
    a: [
      "Clarify requirements first (lockout rules, password policy, SSO?).",
      "Happy path; wrong password; unknown user; empty fields; boundaries on lengths.",
      "State: lockout after N attempts, session expiry, back button after logout.",
      "Security: SQL injection, brute force, password not in URL or logs, HTTPS.",
      "UI/a11y: keyboard, screen reader labels, error messages. Then speed under load.",
    ],
    chapter: "approach",
    chapterLabel: "§01 How would you test this?",
  },
  {
    id: "ep-bva",
    q: "Equivalence partitioning vs boundary value analysis?",
    a: [
      "Partitioning: split inputs into groups treated alike; test one value per group.",
      "Boundaries: test both sides of each edge (min-1, min, max, max+1).",
      "Partitions say which values are alike; boundaries say where bugs live (off-by-ones).",
    ],
    chapter: "boundaries",
    chapterLabel: "§02 Partitions and boundaries",
  },
  {
    id: "decision",
    q: "When do you use a decision table? What's pairwise testing?",
    a: [
      "When the outcome depends on combinations of conditions: one row per combination, with the expected result.",
      "n yes/no conditions make 2^n rows; pairwise picks fewer rows covering every pair of values.",
      "Pairwise catches 2-way interactions, not 3-way ones: keep full tables for critical logic.",
    ],
    chapter: "decisions",
    chapterLabel: "§03 Decision tables",
  },
  {
    id: "state",
    q: "What is state transition testing?",
    a: [
      "Model the feature as states and events, from the spec.",
      "Test every valid transition, and every invalid one (it must be refused).",
      "Then sequences: repeats, wrong order, concurrent actions.",
    ],
    chapter: "states",
    chapterLabel: "§05 State transitions",
  },
  {
    id: "coverage",
    q: "Is 100% code coverage enough?",
    a: [
      "No: coverage measures what executed, not what was checked.",
      "Weak assertions and missing boundary values still reach 100%.",
      "Mutation testing measures whether tests catch injected bugs.",
    ],
    chapter: "mutation",
    chapterLabel: "§04 Coverage vs mutation",
  },
  {
    id: "pyramid",
    q: "What's the test pyramid, and why?",
    a: [
      "Many unit tests, fewer API/integration tests, few end-to-end UI tests.",
      "Lower levels are faster, more stable and point at the exact failure.",
      "Test each thing at the lowest level that can catch it; keep E2E for critical journeys.",
    ],
    chapter: "pyramid",
    chapterLabel: "§06 The test pyramid",
  },
  {
    id: "api",
    q: "How do you test a REST API?",
    a: [
      "Per endpoint: status code, body, schema/contract.",
      "Negative cases: 400 malformed, 401/403 auth, 404 unknown, 422 invalid values.",
      "Idempotency, pagination, rate limits; automate in CI (REST Assured, Postman/Newman, Playwright).",
    ],
    chapter: "api",
    chapterLabel: "§07 API testing",
  },
  {
    id: "flaky",
    q: "A test fails intermittently. What do you do?",
    a: [
      "Don't just rerun: reproduce it (loop it, pin the seed and data, capture traces).",
      "Usual causes: fixed sleeps, brittle selectors, shared state, test order, real network.",
      "Fix the cause (explicit waits, stable locators, isolation); quarantine with a ticket meanwhile.",
    ],
    chapter: "flaky",
    chapterLabel: "§08 Flaky tests",
  },
  {
    id: "regression",
    q: "The build went red and 20 commits landed. How do you find the cause?",
    a: [
      "Last green and first red build bound the range.",
      "git bisect (ideally git bisect run with the failing test): log2(n) runs.",
      "Then add a regression test that pins the bug.",
    ],
    chapter: "ci",
    chapterLabel: "§09 CI and bisect",
  },
  {
    id: "smoke",
    q: "Smoke vs sanity vs regression testing?",
    a: [
      "Smoke: broad, shallow, does the build work at all?",
      "Sanity: narrow, does this specific fix work?",
      "Regression: re-run existing tests, did anything that worked break?",
    ],
    chapter: "ci",
    chapterLabel: "§09 CI and bisect",
  },
  {
    id: "sev-pri",
    q: "Severity vs priority? Give an example where they differ.",
    a: [
      "Severity: impact when it happens. Priority: how soon to fix it.",
      "Low severity, high priority: a typo in the logo on the home page.",
      "High severity, low priority: a crash on a page almost nobody can reach.",
    ],
    chapter: "repro",
    chapterLabel: "§10 Bug reports",
  },
  {
    id: "bug-report",
    q: "What goes into a good bug report?",
    a: [
      "A specific title; minimal steps to reproduce; expected vs actual.",
      "Environment (build, browser, data), and evidence: logs, screenshots, the request.",
      "Severity, and the smallest input that still fails.",
    ],
    chapter: "repro",
    chapterLabel: "§10 Bug reports",
  },
  {
    id: "automate",
    q: "What would you automate, and what not?",
    a: [
      "Automate: regression suites, smoke tests, data-heavy and repetitive checks, anything run on every build.",
      "Keep manual: exploratory testing, usability, one-off checks, features still changing daily.",
      "Decide by how often it runs, how stable it is, and what a miss costs.",
    ],
    chapter: "pyramid",
    chapterLabel: "§06 The test pyramid",
  },
  {
    id: "one-day",
    q: "You have one day to test a release. What do you do?",
    a: [
      "Risk-based: what changed, and what's most costly if broken (money, data, login).",
      "Smoke the whole thing, then go deep on changed areas and critical paths.",
      "Report clearly what was and wasn't tested, so the risk is a shared decision.",
    ],
    chapter: "approach",
    chapterLabel: "§01 How would you test this?",
  },
  {
    id: "works-for-me",
    q: "A developer says \"works on my machine\". What do you do?",
    a: [
      "Compare environments: build, config, data, browser, feature flags.",
      "Shrink the repro until it's undeniable, and share exact steps or a failing test.",
      "Stay collaborative: the goal is the fix, not winning.",
    ],
    chapter: "repro",
    chapterLabel: "§10 Bug reports",
  },
  {
    id: "verify-validate",
    q: "Verification vs validation?",
    a: ["Verification: did we build it right? (matches the spec)", "Validation: did we build the right thing? (meets the user's need)"],
    chapter: "approach",
    chapterLabel: "§01 How would you test this?",
  },
];

export function Drill() {
  const deck = useSteps(CARDS);
  const { discovered, markDiscovered, reset } = useDiscoveries({ key: "stepwise-qa-drill" });
  const [shown, setShown] = useState<string | null>(null);
  const card = CARDS[Math.max(0, deck.index)];
  const known = CARDS.filter((c) => discovered.has(c.id)).length;
  const revealed = shown === card.id;
  const advance = () => {
    setShown(null);
    deck.next();
  };
  const prev = CARDS[deck.index - 1];
  const next = CARDS[deck.index + 1];

  return (
    <div id="qa-drill-deck" data-testid="qa-drill" data-stepwise="" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">
          card {deck.index + 1}/{CARDS.length}
        </span>
        <span className="flex items-center gap-3">
          <span data-testid="drill-progress" className="text-accent">{`${known}/${CARDS.length} known`}</span>
          <button type="button" onClick={reset} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Start over
          </button>
        </span>
      </div>
      <div className="h-1 bg-secondary" aria-hidden>
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(known / CARDS.length) * 100}%` }} />
      </div>
      <div className="px-5 py-5">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
          Interviewer
          {discovered.has(card.id) && <span className="rounded border border-accent/40 px-1.5 py-0.5 text-accent normal-case tracking-normal">known</span>}
        </div>
        <p className="mb-4 text-lg font-semibold leading-snug">{card.q}</p>
        {revealed ? (
          <div data-testid="drill-answer" className="mb-4 rounded-lg border border-accent/30 bg-accent/[0.06] px-4 py-3">
            <ul className="list-disc space-y-1 pl-4 text-[13.5px] leading-relaxed text-foreground/85">
              {card.a.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <a href={`#${card.chapter}`} className="mt-2 inline-block font-mono text-[11px] text-primary underline-offset-4 hover:underline">
              Revisit {card.chapterLabel} →
            </a>
          </div>
        ) : (
          <p className="mb-4 text-[13px] text-muted-foreground">Say your answer out loud first. Then check it.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {revealed ? (
            <>
              <button
                type="button"
                onClick={() => {
                  markDiscovered(card.id);
                  advance();
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-foreground hover:opacity-90"
              >
                I knew it
              </button>
              <button type="button" onClick={advance} className="rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-secondary">
                Not yet, next
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setShown(card.id)} className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90">
              Show answer
            </button>
          )}
        </div>
      </div>
      <LessonPager
        className="justify-between border-t border-border px-4 py-2"
        prev={prev ? { label: `card ${deck.index}`, hint: prev.q } : undefined}
        next={next ? { label: `card ${deck.index + 2}`, hint: next.q } : undefined}
        onNavigate={(dir) => {
          setShown(null);
          if (dir === "next") deck.next();
          else deck.prev();
        }}
        labels={{ previous: "Previous card", next: "Next card" }}
      />
    </div>
  );
}
