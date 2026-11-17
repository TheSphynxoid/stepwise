// Invariant check for the /qa lesson's system under test ("Tidepool
// Tickets"): every "this technique catches the bug / misses it" story the
// lesson tells is pinned here. Run: npx jiti apps/demo/scripts/check-qa-model.ts
import assert from "node:assert/strict";
import { precompute, runWalk } from "@sphynxoid/stepwise/core";
import { lifecycleWalk } from "../app/qa/lifecycle.walk";
import { decisions } from "../app/qa/decisions.explainer";
import { mutation } from "../app/qa/mutation.explainer";
import {
  BAD_COMMIT,
  BUG_CARDS,
  CODES,
  COMMITS,
  CONTRACT,
  DEFAULT_PAYLOAD,
  FAILING_PAYLOAD,
  LIFECYCLE_SHIPPED,
  LIFECYCLE_SPEC,
  LINES,
  MUTANTS,
  PRICES,
  SHIPPED,
  SPEC,
  STRONG_SUITE,
  WEAK_SUITE,
  book,
  bookTraced,
  discount,
  handle,
  payloadFails,
  runSuite,
  testsPassAt,
  uiAttempt,
  type Booking,
  type Rules,
} from "../app/qa/tidepool";

const b = (age: number, qty = 1, code = ""): Booking => ({ age, qty, code });

// Boundaries: the shipped child cutoff is off by one, and qty accepts 9.
assert.equal(SPEC.childBelow, 12);
const at12spec = book(b(12), SPEC);
const at12ship = book(b(12), SHIPPED);
assert.ok(at12spec.ok && at12spec.tier === "adult", "12 is an adult in the spec");
assert.ok(at12ship.ok && at12ship.tier === "child", "12 is a child in the shipped build");
assert.deepEqual(book(b(30, 9), SPEC), { ok: false, error: "qty" });
assert.ok(book(b(30, 9), SHIPPED).ok, "shipped accepts qty 9");
for (const v of [5, 11, 13, 64, 65, 66]) assert.deepEqual(book(b(v), SPEC), book(b(v), SHIPPED), `age ${v} agrees`);

// Garbage never throws; it is rejected.
for (const g of [b(-1), b(1000), b(2.5), b(30, 0), b(30, 1, "NOPE"), b(Number.NaN)]) {
  const r = book(g, SHIPPED);
  assert.equal(r.ok, false, `rejects ${JSON.stringify(g)}`);
}
assert.equal(PRICES.adult, 20);
assert.equal(CODES.SURF10(100), 90);
assert.equal(CODES.TIDE5(3), 0);

// Coverage: the weak suite runs every line and passes on the shipped build.
for (const r of runSuite(WEAK_SUITE, SHIPPED)) assert.ok(r.pass, `weak case ${r.name} passes on shipped`);
const covered = new Set(WEAK_SUITE.flatMap((t) => bookTraced(t.input, SHIPPED).lines));
assert.deepEqual([...covered].sort(), LINES.map((l) => l.id).sort(), "weak suite: 100% line coverage");
assert.ok(runSuite(STRONG_SUITE, SHIPPED).some((r) => !r.pass), "strong suite catches the shipped bugs");
for (const r of runSuite(STRONG_SUITE, SPEC)) assert.ok(r.pass, `strong case ${r.name} passes on spec`);

// Mutation: the weak suite lets some mutants live; the strong suite kills all.
const survivors = MUTANTS.filter((m) => runSuite(WEAK_SUITE, m.impl).every((r) => r.pass));
assert.ok(survivors.length >= 3, `weak suite: >=3 survivors (got ${survivors.length})`);
for (const m of MUTANTS) assert.ok(runSuite(STRONG_SUITE, m.impl).some((r) => !r.pass), `strong suite kills ${m.id}`);

// Decision table: only the 3-way row differs, so pairwise misses it.
const rows: Rules[] = [];
for (const member of [false, true]) for (const promo of [false, true]) for (const weekday of [false, true]) rows.push({ member, promo, weekday });
for (const r of rows) {
  const all3 = r.member && r.promo && r.weekday;
  if (all3) {
    assert.equal(discount(r, "spec"), 20);
    assert.equal(discount(r, "shipped"), 30);
  } else assert.equal(discount(r, "spec"), discount(r, "shipped"), `row ${JSON.stringify(r)} agrees`);
}

// Lifecycle: exactly one extra edge.
const key = (e: { from: string; on: string; to: string }) => `${e.from}-${e.on}-${e.to}`;
const extra = LIFECYCLE_SHIPPED.map(key).filter((k) => !LIFECYCLE_SPEC.map(key).includes(k));
assert.deepEqual(extra, ["held-refund-refunded"]);

// API: wrong status on invalid input, a missing field in the contract.
const bad = { method: "POST", path: "/bookings", body: b(30, 9) } as const;
assert.equal(handle(bad, "spec").status, 422);
assert.equal(handle(bad, "shipped").status, 200);
const ok = handle({ method: "POST", path: "/bookings", body: b(30, 2) }, "spec");
assert.equal(ok.status, 201);
for (const f of CONTRACT) assert.ok(f in ok.body, `POST body has ${f}`);
const get = handle({ method: "GET", path: "/bookings/1" }, "shipped");
assert.equal(get.status, 200);
assert.ok(!("total" in get.body), "shipped GET omits total");
for (const f of CONTRACT) assert.ok(f in handle({ method: "GET", path: "/bookings/1" }, "spec").body, `spec GET has ${f}`);
assert.equal(handle({ method: "GET", path: "/bookings/99" }, "spec").status, 404);

// Flaky UI: sleeps race the render; waits don't; positional selectors break.
assert.equal(uiAttempt(350, "sleep", false, "stable").pass, false);
assert.equal(uiAttempt(250, "sleep", false, "stable").pass, true);
assert.equal(uiAttempt(350, "wait", false, "stable").pass, true);
assert.equal(uiAttempt(100, "wait", true, "fragile").pass, false);
assert.equal(uiAttempt(100, "wait", true, "stable").pass, true);

// Bisect: one bad commit.
assert.equal(COMMITS.length, 20);
assert.equal(BAD_COMMIT, 13);
assert.ok(testsPassAt(12) && !testsPassAt(13) && !testsPassAt(19) && testsPassAt(0));

// Minimal repro: a two-field interaction.
assert.ok(payloadFails(FAILING_PAYLOAD));
assert.ok(!payloadFails(DEFAULT_PAYLOAD));
assert.ok(!payloadFails({ ...DEFAULT_PAYLOAD, qty: FAILING_PAYLOAD.qty }), "qty alone passes");
assert.ok(!payloadFails({ ...DEFAULT_PAYLOAD, code: FAILING_PAYLOAD.code }), "code alone passes");
assert.ok(payloadFails({ ...DEFAULT_PAYLOAD, qty: FAILING_PAYLOAD.qty, code: FAILING_PAYLOAD.code }), "both fail");

// Triage: the two classic off-diagonal cases exist.
assert.ok(BUG_CARDS.some((c) => c.severity === "high" && c.priority === "low"));
assert.ok(BUG_CARDS.some((c) => c.severity === "low" && c.priority === "high"));

// Everything shipped to the page is JSON.
for (const [name, v] of Object.entries({ SPEC, SHIPPED, PRICES, LINES, WEAK_SUITE, STRONG_SUITE, MUTANTS, LIFECYCLE_SPEC, LIFECYCLE_SHIPPED, CONTRACT, COMMITS, FAILING_PAYLOAD, DEFAULT_PAYLOAD, BUG_CARDS }))
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, `${name} is JSON`);

// §03 decision table: pairwise misses the 3-way bug, the full table finds it.
const last = <T,>(a: T[]) => a[a.length - 1];
const pair = precompute(decisions, { rows: "pairwise" }).steps;
const full = precompute(decisions, { rows: "all" }).steps;
assert.equal(last(pair).tone, "good", "pairwise: no difference found");
assert.equal(last(full).tone, "bad", "all rows: the difference is found");
assert.equal(full.filter((s) => s.kind === "row").length, 8);
assert.equal(pair.filter((s) => s.kind === "row").length, 4);

// §04 coverage vs mutation.
const weak = last(precompute(mutation, { suite: "weak" }).steps);
assert.equal(weak.lineCoverage, 100, "weak suite: 100% line coverage");
assert.equal(weak.branchCoverage, 100, "weak suite: 100% branch coverage too, and the bugs still survive");
assert.ok(weak.mutants.filter((m) => m.status === "survived").length >= 3, "weak suite: survivors");
const strong = last(precompute(mutation, { suite: "strong" }).steps);
assert.equal(strong.mutants.filter((m) => m.status === "survived").length, 0, "strong suite kills all");

// §05 the tester's walk: refusals stay put, hold → refund is the bug.
const w1 = runWalk(lifecycleWalk, null, { choices: ["pay", "hold", "refund"] });
assert.equal(w1.steps[w1.steps.length - 1].key.startsWith("found"), true, "hold → refund finds the bug");
assert.equal(w1.awaiting, false, "the walk ends on the bug");
assert.ok(w1.steps.some((s) => s.result === "refused"), "pay from draft is refused");
const w2 = runWalk(lifecycleWalk, null, { choices: ["hold", "pay", "issue", "refund"] });
assert.ok(!w2.steps.some((s) => s.key.startsWith("found")), "the legal path finds nothing");
assert.equal(w2.steps[w2.steps.length - 1].state, "refunded");

console.log("qa model: ok");
