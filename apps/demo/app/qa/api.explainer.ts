import { defineExplainer, type Simulation, type StepwiseStep } from "@sphynxoid/stepwise/core";
import { CONTRACT, handle, type Booking, type Res } from "./driftwood";

// Chapter 7: API testing. A small request suite runs against the bookings
// API; each response is checked for the status code and, where a booking
// comes back, for the contract (every promised field present). Switch
// between the spec's API and the shipped one.

export type Call = {
  id: string;
  title: string;
  method: "GET" | "POST";
  path: string;
  body: Booking | null;
  expect: number;
  contract: boolean;
};

export const CALLS: Call[] = [
  { id: "create", title: "create a valid booking", method: "POST", path: "/bookings", body: { age: 30, qty: 2, code: "" }, expect: 201, contract: true },
  { id: "invalid-qty", title: "too many tickets", method: "POST", path: "/bookings", body: { age: 30, qty: 9, code: "" }, expect: 422, contract: false },
  { id: "invalid-age", title: "a negative age", method: "POST", path: "/bookings", body: { age: -1, qty: 1, code: "" }, expect: 422, contract: false },
  { id: "no-body", title: "no body at all", method: "POST", path: "/bookings", body: null, expect: 400, contract: false },
  { id: "get", title: "read a booking back", method: "GET", path: "/bookings/1", body: null, expect: 200, contract: true },
  { id: "missing", title: "a booking that doesn't exist", method: "GET", path: "/bookings/99", body: null, expect: 404, contract: false },
];

export const IMPLS = ["shipped", "spec"] as const;
export type ApiImpl = (typeof IMPLS)[number];
export const STATUSES = ["200", "201", "400", "404", "422"] as const;

export type Check = { kind: "status" | "contract"; pass: boolean; detail: string };
export type ApiInput = { impl: ApiImpl };
export type ApiStep = StepwiseStep<{
  kind: "start" | "request" | "response" | "done";
  explain: string;
  call: Call;
  res: Res | null;
  checks: Check[];
  /** Every response so far: call id, status, all checks passed. */
  history: { id: string; status: number; pass: boolean }[];
}>;

const EXPLAIN: Record<string, string> = {
  create: "Start with the happy path: a valid booking should come back 201 Created, with every field the contract promises.",
  "invalid-qty": "Bad input must be refused with a 4xx, here 422 Unprocessable Entity. Nine tickets is over the limit of eight.",
  "invalid-age": "Another invalid value. Watch the status as well as the body: an API that says 200 with an error inside breaks every client that trusts status codes.",
  "no-body": "A malformed request is a different failure from invalid data: 400 Bad Request. Interviewers like candidates who know the difference.",
  get: "Read it back and check the contract: every field present, with the right type. A missing field is a breaking change, even when the status is 200.",
  missing: "And the negative read: an unknown id is 404, not 200 with an empty body, and not 500.",
};

const sim: Simulation<ApiInput, ApiStep> = function* ({ impl }) {
  const history: ApiStep["history"] = [];
  yield {
    key: "start",
    kind: "start",
    tone: "neutral",
    label: `${CALLS.length} requests against the ${impl} API`,
    explain:
      "API tests skip the browser and talk to the service directly: faster and steadier than UI tests, and closer to where the logic lives. Each test sends a request, then asserts on the status, the body, and the contract.",
    call: CALLS[0],
    res: null,
    checks: [],
    history: [],
  };
  for (const call of CALLS) {
    yield {
      key: `req.${call.id}`,
      kind: "request",
      tone: "accent",
      label: `${call.method} ${call.path}: ${call.title}`,
      explain: EXPLAIN[call.id],
      call,
      res: null,
      checks: [],
      history: [...history],
    };
    const res = handle({ method: call.method, path: call.path, body: call.body ?? undefined }, impl);
    const checks: Check[] = [
      { kind: "status", pass: res.status === call.expect, detail: `expected ${call.expect}, got ${res.status}` },
    ];
    if (call.contract) {
      const missing = CONTRACT.filter((f) => !(f in res.body));
      checks.push({ kind: "contract", pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : `has ${CONTRACT.join(", ")}` });
    }
    const pass = checks.every((c) => c.pass);
    history.push({ id: call.id, status: res.status, pass });
    const failed = checks.find((c) => !c.pass);
    yield {
      key: `res.${call.id}`,
      kind: "response",
      tone: pass ? "good" : "bad",
      label: pass ? `${res.status}: every check passes` : `FAIL ${failed!.kind}: ${failed!.detail}`,
      explain: pass
        ? "Passed. Note what was checked: the status and, where a booking came back, its shape. Not just \"it didn't crash\"."
        : failed!.kind === "status" && res.status === 201
          ? "The API took 9 tickets: the same off-by-one as the form, because it shares the validator. A bug in shared logic shows at every level that uses it."
          : failed!.kind === "status"
            ? "The service did refuse the booking (look at the body), but with a 200. A UI that only checks the status would show \"Booked!\". Status codes are part of the API."
          : "The status is fine and the data is wrong: `total` is gone. A contract test (by hand like this, or with a schema or a tool like Pact) catches what a status check can't.",
      call,
      res,
      checks,
      history: [...history],
    };
  }
  const failed = history.filter((h) => !h.pass).length;
  yield {
    key: "done",
    kind: "done",
    tone: failed ? "bad" : "good",
    label: failed ? `${failed} of ${CALLS.length} requests failed` : `All ${CALLS.length} requests pass`,
    explain: failed
      ? "Three failures: the shared validator bug, a wrong status, a missing field. The last two are API-only bugs that no UI test would point at. Switch to the spec API to see the suite pass."
      : "Green. This suite is cheap enough to run on every commit.",
    call: CALLS[CALLS.length - 1],
    res: null,
    checks: [],
    history,
  };
};

export const api = defineExplainer({
  name: "qa-api",
  simulation: sim,
  input: {
    default: { impl: "shipped" } as ApiInput,
    serialize: ({ impl }) => impl,
    parse: (s) => ((IMPLS as readonly string[]).includes(s) ? { impl: s as ApiImpl } : null),
  },
  predict: {
    at: (step) => step.kind === "request",
    options: [...STATUSES],
    truth: (next) => (next?.res ? String(next.res.status) : undefined),
    hint: "This is the shipped API. Does it use the right status for every error?",
  },
});
