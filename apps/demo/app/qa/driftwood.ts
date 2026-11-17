// "Driftwood Tickets": the invented system under test for the /qa lesson.
// Pure data and functions (no React, no "use client"), so the server can
// precompute every chapter's trace and the client can re-run them on edits.
//
// Each part comes twice: the SPEC (what the product should do) and what
// SHIPPED (what the code actually does). The differences are the planted
// bugs, and each chapter's technique is a different way of finding them.
// apps/demo/scripts/check-qa-model.ts pins every bug the prose relies on.

// ─── The booking form ────────────────────────────────────────────────

export type Booking = { age: number; qty: number; code: string };
export type Tier = "child" | "adult" | "senior";
export type Outcome = { ok: true; tier: Tier; total: number } | { ok: false; error: "age" | "qty" | "code" };

/** The knobs of the validator. Mutants and the shipped build are just other settings. */
export type Impl = { childBelow: number; seniorFrom: number; qtyMax: number; checkCode: boolean };

/** Rules: ages 0-120; under 12 is a child, 65 and up a senior; 1-8 tickets; known codes only. */
export const SPEC: Impl = { childBelow: 12, seniorFrom: 65, qtyMax: 8, checkCode: true };
/** Two off-by-one bugs: 12-year-olds pay the child price, and 9 tickets go through. */
export const SHIPPED: Impl = { childBelow: 13, seniorFrom: 65, qtyMax: 9, checkCode: true };

export const PRICES: Record<Tier, number> = { child: 10, adult: 20, senior: 12 };

export const CODES: Record<string, (subtotal: number) => number> = {
  "": (s) => s,
  SURF10: (s) => Math.round(s * 0.9),
  TIDE5: (s) => Math.max(0, s - 5),
};

/** The validator's source, one entry per line, for coverage views. */
export const LINES: readonly { id: string; text: string }[] = [
  { id: "L1", text: "if (!int(age) || age < 0 || age > 120) return reject('age')" },
  { id: "L2", text: "if (!int(qty) || qty < 1 || qty > QTY_MAX) return reject('qty')" },
  { id: "L3", text: "if (!(code in CODES)) return reject('code')" },
  { id: "L4", text: "let tier = 'adult'" },
  { id: "L5", text: "if (age < CHILD_BELOW) tier = 'child'" },
  { id: "L6", text: "else if (age >= SENIOR_FROM) tier = 'senior'" },
  { id: "L7", text: "const subtotal = PRICES[tier] * qty" },
  { id: "L8", text: "return accept(tier, CODES[code](subtotal))" },
];

/**
 * The validator, instrumented: which lines ran, and which way each
 * decision went (`L5:T` = the condition on line 5 was true). Line coverage
 * counts the first list; branch coverage counts the second.
 */
export function bookTraced(b: Booking, impl: Impl): { outcome: Outcome; lines: string[]; branches: string[] } {
  const lines: string[] = [];
  const branches: string[] = [];
  const decide = (id: string, cond: boolean) => {
    lines.push(id);
    branches.push(`${id}:${cond ? "T" : "F"}`);
    return cond;
  };
  const done = (outcome: Outcome) => ({ outcome, lines, branches });
  const { age, qty, code } = b;
  if (decide("L1", !Number.isInteger(age) || age < 0 || age > 120)) return done({ ok: false, error: "age" });
  if (decide("L2", !Number.isInteger(qty) || qty < 1 || qty > impl.qtyMax)) return done({ ok: false, error: "qty" });
  if (decide("L3", impl.checkCode && !(code in CODES))) return done({ ok: false, error: "code" });
  lines.push("L4");
  let tier: Tier = "adult";
  if (decide("L5", age < impl.childBelow)) tier = "child";
  else if (decide("L6", age >= impl.seniorFrom)) tier = "senior";
  lines.push("L7");
  const subtotal = PRICES[tier] * qty;
  lines.push("L8");
  return done({ ok: true, tier, total: (CODES[code] ?? CODES[""])(subtotal) });
}

export function book(b: Booking, impl: Impl): Outcome {
  return bookTraced(b, impl).outcome;
}

export const sameOutcome = (a: Outcome, b: Outcome) => JSON.stringify(a) === JSON.stringify(b);

// ─── Test suites and mutants ─────────────────────────────────────────

export type TestCase = { name: string; input: Booking; expect: Outcome };

const tc = (name: string, age: number, qty: number, code: string): TestCase => ({
  name,
  input: { age, qty, code },
  expect: book({ age, qty, code }, SPEC),
});

/** One case per behaviour, no boundary values: every line runs, and both shipped bugs slip through. */
export const WEAK_SUITE: TestCase[] = [
  tc("adult, two tickets", 30, 2, ""),
  tc("child price", 5, 1, ""),
  tc("senior with SURF10", 70, 1, "SURF10"),
  tc("negative age rejected", -1, 1, ""),
  tc("zero tickets rejected", 30, 0, ""),
  tc("unknown code rejected", 30, 1, "NOPE"),
];

/** The weak suite plus both sides of every boundary. */
export const STRONG_SUITE: TestCase[] = [
  ...WEAK_SUITE,
  tc("11 is a child", 11, 1, ""),
  tc("12 is an adult", 12, 1, ""),
  tc("64 is an adult", 64, 1, ""),
  tc("65 is a senior", 65, 1, ""),
  tc("8 tickets allowed", 30, 8, ""),
  tc("9 tickets rejected", 30, 9, ""),
];

/** Small edits to the correct code. A good suite fails on each one ("kills" it). */
export const MUTANTS: readonly { id: string; label: string; impl: Impl }[] = [
  { id: "child-11", label: "age < 11 (was < 12)", impl: { ...SPEC, childBelow: 11 } },
  { id: "child-13", label: "age < 13 (was < 12)", impl: { ...SPEC, childBelow: 13 } },
  { id: "senior-64", label: "age >= 64 (was >= 65)", impl: { ...SPEC, seniorFrom: 64 } },
  { id: "senior-66", label: "age >= 66 (was >= 65)", impl: { ...SPEC, seniorFrom: 66 } },
  { id: "qty-7", label: "qty > 7 (was > 8)", impl: { ...SPEC, qtyMax: 7 } },
  { id: "qty-9", label: "qty > 9 (was > 8)", impl: { ...SPEC, qtyMax: 9 } },
  { id: "no-code-check", label: "code check deleted", impl: { ...SPEC, checkCode: false } },
];

export function runSuite(suite: TestCase[], impl: Impl): { name: string; pass: boolean; got: Outcome }[] {
  return suite.map((t) => {
    const got = book(t.input, impl);
    return { name: t.name, pass: sameOutcome(got, t.expect), got };
  });
}

// ─── Discounts (decision table) ──────────────────────────────────────

export type Rules = { member: boolean; promo: boolean; weekday: boolean };

/**
 * Percent off. Spec: member (15) and promo (10) don't stack, take the
 * bigger; weekday (5) stacks with anything. Shipped: when all three apply,
 * member and promo stack too. Only one row of eight shows it.
 */
export function discount(r: Rules, impl: "spec" | "shipped"): number {
  if (impl === "shipped" && r.member && r.promo && r.weekday) return 30;
  return Math.max(r.member ? 15 : 0, r.promo ? 10 : 0) + (r.weekday ? 5 : 0);
}

// ─── Booking lifecycle (state transitions) ───────────────────────────

export type LifeState = "draft" | "held" | "paid" | "issued" | "cancelled" | "refunded";
export type LifeAction = "hold" | "pay" | "issue" | "cancel" | "refund";
export const LIFE_ACTIONS: readonly LifeAction[] = ["hold", "pay", "issue", "cancel", "refund"];
export const LIFE_STATES: readonly LifeState[] = ["draft", "held", "paid", "issued", "cancelled", "refunded"];

export const LIFECYCLE_SPEC: readonly { from: LifeState; on: LifeAction; to: LifeState }[] = [
  { from: "draft", on: "hold", to: "held" },
  { from: "held", on: "pay", to: "paid" },
  { from: "paid", on: "issue", to: "issued" },
  { from: "draft", on: "cancel", to: "cancelled" },
  { from: "held", on: "cancel", to: "cancelled" },
  { from: "paid", on: "refund", to: "refunded" },
  { from: "issued", on: "refund", to: "refunded" },
];

/** The spec plus one edge nobody asked for: refunding a booking that was never paid. */
export const LIFECYCLE_SHIPPED: typeof LIFECYCLE_SPEC = [...LIFECYCLE_SPEC, { from: "held", on: "refund", to: "refunded" }];

// ─── The API ─────────────────────────────────────────────────────────

export type Req = { method: "GET" | "POST"; path: string; body?: Booking };
export type Res = { status: number; body: Record<string, unknown> };

/** Fields every booking response must carry. */
export const CONTRACT: readonly string[] = ["id", "tier", "total", "status"];

const STORED = { id: 1, tier: "adult", total: 40, status: "held" };

/**
 * Spec: POST valid → 201 with the booking; invalid → 422 with the error;
 * no body → 400; GET a known id → 200; unknown → 404. Shipped: validates
 * with the shipped rules (so 9 tickets get through), returns 200 for the
 * input it does reject (error in the body), and GET drops `total`.
 */
export function handle(req: Req, impl: "spec" | "shipped"): Res {
  if (req.method === "POST" && req.path === "/bookings") {
    if (!req.body) return { status: 400, body: { error: "body required" } };
    const out = book(req.body, impl === "shipped" ? SHIPPED : SPEC);
    if (!out.ok) return { status: impl === "shipped" ? 200 : 422, body: { error: out.error } };
    return { status: 201, body: { id: 2, tier: out.tier, total: out.total, status: "held" } };
  }
  const m = /^\/bookings\/(\d+)$/.exec(req.path);
  if (req.method === "GET" && m) {
    if (Number(m[1]) !== 1) return { status: 404, body: { error: "not found" } };
    if (impl === "shipped") {
      return { status: 200, body: { id: STORED.id, tier: STORED.tier, status: STORED.status } };
    }
    return { status: 200, body: { ...STORED } };
  }
  return { status: 404, body: { error: "no route" } };
}

// ─── The UI (flaky tests) ────────────────────────────────────────────

export const SLEEP_MS = 300;
export const WAIT_TIMEOUT_MS = 2000;

/**
 * One run of the UI test "click Book". The button renders after
 * `latencyMs`. `sleep` waits a fixed 300 ms then clicks; `wait` polls
 * until the button exists (up to 2 s). A promo banner sometimes renders
 * above the form, shifting positions: a `fragile` (nth-child) selector then
 * clicks the banner instead.
 */
export function uiAttempt(
  latencyMs: number,
  strategy: "sleep" | "wait",
  banner: boolean,
  selector: "fragile" | "stable"
): { pass: boolean; reason: string } {
  if (strategy === "sleep" && latencyMs > SLEEP_MS)
    return { pass: false, reason: `clicked at ${SLEEP_MS} ms; the button appeared at ${latencyMs} ms` };
  if (strategy === "wait" && latencyMs > WAIT_TIMEOUT_MS) return { pass: false, reason: "timed out waiting" };
  if (selector === "fragile" && banner) return { pass: false, reason: "form > :nth-child(3) matched the banner" };
  return { pass: true, reason: strategy === "wait" ? `waited ${latencyMs} ms for the button` : `button was there (${latencyMs} ms)` };
}

// ─── History (bisect) ────────────────────────────────────────────────

const MSGS = [
  "init booking form",
  "add price table",
  "child and senior tiers",
  "promo codes",
  "lint fixes",
  "API: POST /bookings",
  "API: GET /bookings/:id",
  "lifecycle states",
  "refactor pricing module",
  "bump dependencies",
  "copy tweaks on checkout",
  "add weekday discount",
  "logging around payment",
  "simplify age checks",
  "dark mode for the form",
  "retry on payment timeout",
  "README",
  "faster seat map",
  "analytics events",
  "release 2.4",
];

export const COMMITS: readonly { sha: string; msg: string }[] = MSGS.map((msg, i) => ({
  sha: ((i * 2654435761 + 0x9e3779b9) >>> 0).toString(16).padStart(8, "0").slice(0, 7),
  msg,
}));

/** "simplify age checks" turned `< 12` into `< 13`. */
export const BAD_COMMIT = 13;
export const testsPassAt = (i: number) => i < BAD_COMMIT;

// ─── A failing bug report (minimal repro) ────────────────────────────

export type Payload = {
  age: number;
  qty: number;
  code: string;
  name: string;
  seat: string;
  notes: string;
  lang: string;
  newsletter: boolean;
};

export const PAYLOAD_FIELDS: readonly (keyof Payload)[] = ["age", "qty", "code", "name", "seat", "notes", "lang", "newsletter"];

/** What the user sent when checkout crashed. */
export const FAILING_PAYLOAD: Payload = {
  age: 34,
  qty: 9,
  code: "SURF10",
  name: "Ada",
  seat: "B12",
  notes: "window seat please",
  lang: "fr",
  newsletter: true,
};

/** A plain booking that works. Shrinking resets fields to these values. */
export const DEFAULT_PAYLOAD: Payload = { age: 30, qty: 1, code: "", name: "x", seat: "", notes: "", lang: "en", newsletter: false };

/** The shipped checkout crashes when a 9-ticket order (the qty bug) also carries SURF10. */
export const payloadFails = (p: Payload) => p.qty > SPEC.qtyMax && p.code === "SURF10";

// ─── Triage ──────────────────────────────────────────────────────────

export type BugCard = { id: string; title: string; severity: "high" | "low"; priority: "high" | "low"; why: string };

export const BUG_CARDS: readonly BugCard[] = [
  {
    id: "checkout-crash",
    title: "Checkout crashes for 9 tickets with SURF10",
    severity: "high",
    priority: "high",
    why: "Money path, data loss, reachable by any customer. Fix now.",
  },
  {
    id: "logo-typo",
    title: "Home page says \"Driftwod\"",
    severity: "low",
    priority: "high",
    why: "Nothing breaks, but every visitor sees it and launch is tomorrow. Cheap and visible: fix first.",
  },
  {
    id: "legacy-crash",
    title: "Old 2019 receipts page throws on open",
    severity: "high",
    priority: "low",
    why: "A crash, but on a page linked from nowhere and scheduled for deletion. Severe, not urgent.",
  },
  {
    id: "tooltip-misaligned",
    title: "Seat tooltip is 2px off in Firefox",
    severity: "low",
    priority: "low",
    why: "Cosmetic and rare. Backlog.",
  },
  {
    id: "child-price",
    title: "12-year-olds get the child price",
    severity: "high",
    priority: "high",
    why: "Wrong money on every such order, silently. Severity is about impact, not noise.",
  },
];
