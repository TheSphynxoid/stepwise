import { createTrace, type StepwiseStep } from "@sphynxoid/stepwise/core";

// Chapter 6: the test pyramid. The same bug (9 tickets accepted) caught at
// three levels. Each trace is a fixed recording built with createTrace;
// steps sharing a `sync` key line up under one player (useSyncedTracks).
// Times are illustrative but in realistic proportion.

export type LevelStep = StepwiseStep<{
  /** Alignment key: setup, act, assert, report. Steps without one are the level's own overhead. */
  sync: "setup" | "act" | "assert" | "report" | null;
  /** What the test does at this step, as code. */
  line: string;
  /** Milliseconds since the test started. */
  elapsed: number;
}>;

const unit = createTrace<LevelStep>()
  .step({ tone: "neutral", label: "import the validator", sync: "setup", line: "import { book } from './booking'", elapsed: 0.2 })
  .step({ tone: "write", label: "call it directly", sync: "act", line: "const out = book({ age: 30, qty: 9, code: '' })", elapsed: 0.3 })
  .step({ tone: "accent", label: "assert", sync: "assert", line: "expect(out).toEqual({ ok: false, error: 'qty' })", elapsed: 0.4 })
  .step({ tone: "bad", label: "FAIL: got { ok: true }", sync: "report", line: "✗ booking › rejects 9 tickets (1 ms)", elapsed: 1 })
  .build();

const api = createTrace<LevelStep>()
  .step({ tone: "neutral", label: "start the service", sync: "setup", line: "const app = await startTestServer()", elapsed: 35 })
  .step({ tone: "write", label: "send the request", sync: "act", line: "const res = await post('/bookings', { age: 30, qty: 9 })", elapsed: 52 })
  .step({ tone: "accent", label: "assert on the response", sync: "assert", line: "expect(res.status).toBe(422)", elapsed: 54 })
  .step({ tone: "bad", label: "FAIL: got 201", sync: "report", line: "✗ POST /bookings › rejects 9 tickets (58 ms)", elapsed: 58 })
  .build();

const ui = createTrace<LevelStep>()
  .step({ tone: "neutral", label: "launch a browser", sync: "setup", line: "const page = await browser.newPage()", elapsed: 900 })
  .step({ tone: "idle", label: "load the page", sync: null, line: "await page.goto('/book')", elapsed: 1500 })
  .step({ tone: "idle", label: "fill the form", sync: null, line: "await page.fill('#age', '30'); await page.fill('#qty', '9')", elapsed: 1750 })
  .step({ tone: "write", label: "click Book", sync: "act", line: "await page.click('[data-testid=book]')", elapsed: 1900 })
  .step({ tone: "idle", label: "wait for the result", sync: null, line: "await page.waitForSelector('[role=alert], .confirmation')", elapsed: 2350 })
  .step({ tone: "accent", label: "assert on the screen", sync: "assert", line: "await expect(page.getByRole('alert')).toHaveText(/at most 8/)", elapsed: 2400 })
  .step({ tone: "bad", label: "FAIL: saw a confirmation", sync: "report", line: "✗ booking form › rejects 9 tickets (2.4 s)", elapsed: 2410 })
  .build();

export const PYRAMID = { unit, api, ui };
export type Level = keyof typeof PYRAMID;
export const LEVELS: { id: Level; name: string; share: string; runs: string }[] = [
  { id: "unit", name: "Unit", share: "~70%", runs: "every save" },
  { id: "api", name: "API / integration", share: "~20%", runs: "every commit" },
  { id: "ui", name: "UI / end-to-end", share: "~10%", runs: "before merge, nightly" },
];
