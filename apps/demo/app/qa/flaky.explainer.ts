import { createRng, defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { SLEEP_MS, uiAttempt } from "./tidepool";

// Chapter 8: flaky UI tests. The same test, "click Book", runs N times
// against a page whose button renders after a random network delay, with
// a promo banner that sometimes appears above the form. The seed is part
// of the input (so it rides in the link): the definition-level `seed` is
// one per explainer, and a flaky run is only useful if you can replay it.

export const STRATEGIES = ["sleep", "wait"] as const;
export const SELECTORS = ["fragile", "stable"] as const;
export type Strategy = (typeof STRATEGIES)[number];
export type Selector = (typeof SELECTORS)[number];
export const MAX_RUNS = 30;
export const LATENCY = { min: 80, max: 520 } as const;
/** One run in this many shows the banner. */
export const BANNER_ODDS = 5;

export const SELECTOR_CODE: Record<Selector, string> = {
  fragile: "page.click('form > :nth-child(3)')",
  stable: "page.getByTestId('book').click()",
};
export const STRATEGY_CODE: Record<Strategy, string> = {
  sleep: `await page.waitForTimeout(${SLEEP_MS})`,
  wait: "await expect(page.getByTestId('book')).toBeVisible()",
};

export type Run = { n: number; latency: number; banner: boolean; pass: boolean; reason: string };
export type FlakyInput = { strategy: Strategy; selector: Selector; runs: number; seed: number };
export type FlakyStep = StepwiseStep<{
  kind: "start" | "render" | "result" | "done";
  explain: string;
  results: Run[];
  /** The run in progress (render and result frames). */
  current: Omit<Run, "pass" | "reason"> | null;
  passRate: number;
  upcoming: "pass" | "fail" | null;
}>;

const sim: Simulation<FlakyInput, FlakyStep> = function* ({ strategy, selector, runs, seed }) {
  const rng = createRng(seed);
  const results: Run[] = [];
  const rate = () => (results.length ? results.filter((r) => r.pass).length / results.length : 0);
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `Run the same UI test ${runs} times (seed ${seed})`,
    explain:
      "A flaky test passes and fails on the same code. Run it once and you learn nothing; run it many times and the pattern shows. Fixing the seed makes a failing run reproducible, which is the first thing to do with any flake.",
    results: [],
    current: null,
    passRate: 0,
    upcoming: null,
  };
  for (let n = 1; n <= runs; n++) {
    const latency = rng.int(LATENCY.min, LATENCY.max);
    const banner = rng.int(1, BANNER_ODDS) === 1;
    const out = uiAttempt(latency, strategy, banner, selector);
    yield {
      key: `render.${n}`,
      kind: "render",
      tone: "accent",
      label: `Run ${n}: the button renders at ${latency} ms${banner ? ", and a promo banner appears above the form" : ""}`,
      explain:
        strategy === "sleep"
          ? `The test sleeps ${SLEEP_MS} ms and then clicks, whatever the page is doing. Compare the two numbers.`
          : "The test waits until the button is actually there, however long that takes (up to a timeout), then clicks.",
      results: [...results],
      current: { n, latency, banner },
      passRate: rate(),
      upcoming: out.pass ? "pass" : "fail",
    };
    results.push({ n, latency, banner, ...out });
    yield {
      key: `result.${n}`,
      kind: "result",
      tone: out.pass ? "good" : "bad",
      label: `Run ${n}: ${out.pass ? "PASS" : "FAIL"}, ${out.reason}`,
      explain: out.pass
        ? "Green. A pass from a racy test only means the race went your way this time."
        : banner && selector === "fragile"
          ? "The positional selector clicked the banner: the page's structure changed and the test broke, though nothing is wrong with the app. Select by role, label or test id instead."
          : "The click came before the button existed. The app is fine; the test is wrong. A fixed sleep is a guess about timing, and the guess loses on slow runs.",
      results: [...results],
      current: { n, latency, banner },
      passRate: rate(),
      upcoming: null,
    };
  }
  const p = rate();
  yield {
    key: "done",
    kind: "done",
    tone: p === 1 ? "good" : "bad",
    label: `${Math.round(p * 100)}% passed (${results.filter((r) => r.pass).length}/${results.length})`,
    explain:
      p === 1
        ? "Every run green, on every seed: the test waits for what it needs and finds the button the way a user would."
        : strategy === "sleep"
          ? "Flaky. Raising the sleep only moves the line (and slows every run). Switch to an explicit wait."
          : "The waits are fixed, but the selector still depends on page structure. Switch to the stable selector.",
    results,
    current: null,
    passRate: p,
    upcoming: null,
  };
};

const int = (s: string | undefined, lo: number, hi: number) => {
  const n = Number(s);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

export const flaky = defineExplainer({
  name: "qa-flaky",
  simulation: sim,
  input: {
    default: { strategy: "sleep", selector: "fragile", runs: 12, seed: 7 } as FlakyInput,
    serialize: ({ strategy, selector, runs, seed }) => `${strategy}_${selector}_${runs}_${seed}`,
    parse: (s) => {
      const [strategy, selector, r, sd] = s.split("_");
      const runs = int(r, 1, MAX_RUNS);
      const seed = int(sd, 0, 9999);
      if (!(STRATEGIES as readonly string[]).includes(strategy) || !(SELECTORS as readonly string[]).includes(selector) || runs === null || seed === null) return null;
      return { strategy: strategy as Strategy, selector: selector as Selector, runs, seed };
    },
  },
  predict: {
    at: (step) => step.kind === "render",
    options: [
      { value: "pass", label: "Pass" },
      { value: "fail", label: "Fail" },
    ],
    truth: (_next, held) => held.upcoming ?? undefined,
    hint: `With sleep: did the button render before ${SLEEP_MS} ms? With the fragile selector: is there a banner?`,
  },
});
