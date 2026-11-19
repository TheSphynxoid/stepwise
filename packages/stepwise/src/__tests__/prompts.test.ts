import { describe, expect, it } from "vitest";
import {
  EMPTY_RECORD,
  applyAnswer,
  canAnswer,
  reachEntry,
  retriesLeft,
  scoreOf,
  settledAnswer,
  skipEntry,
  truncateAfter,
  type PromptRecord,
} from "../core";

const reach = (rec: PromptRecord<string>, frame: number, retries = 0, judged = true) =>
  reachEntry(rec, { id: `p${frame}`, frame, source: "generator", judged, retries });
const at = (rec: PromptRecord<string>, frame: number) => rec.entries.find((e) => e.frame === frame)!;

describe("prompt record", () => {
  it("retries 0, judged: a wrong first answer settles as fail", () => {
    const rec = applyAnswer(reach(EMPTY_RECORD, 3), 3, "keep", "fail");
    const e = at(rec, 3);
    expect(e).toMatchObject({ status: "fail", settled: true });
    expect(canAnswer(e)).toBe(false);
    expect(retriesLeft(e)).toBe(0);
  });

  it("retries 2, judged: two misses stay open, the third answer settles", () => {
    let rec = reach(EMPTY_RECORD, 1, 2);
    rec = applyAnswer(rec, 1, "a", "fail");
    expect(at(rec, 1)).toMatchObject({ status: "fail", settled: false });
    rec = applyAnswer(rec, 1, "b", "fail");
    expect(at(rec, 1).settled).toBe(false);
    expect(canAnswer(at(rec, 1))).toBe(true);
    const failed = applyAnswer(rec, 1, "c", "fail");
    expect(at(failed, 1)).toMatchObject({ status: "fail", settled: true });
    const passed = applyAnswer(rec, 1, "c", "pass");
    expect(at(passed, 1)).toMatchObject({ status: "pass", settled: true });
  });

  it("a pass settles even with retries left; changing it later uses a retry and re-judges", () => {
    let rec = applyAnswer(reach(EMPTY_RECORD, 1, 1), 1, "right", "pass");
    expect(at(rec, 1)).toMatchObject({ status: "pass", settled: true });
    expect(retriesLeft(at(rec, 1))).toBe(1);
    expect(canAnswer(at(rec, 1))).toBe(true);
    rec = applyAnswer(rec, 1, "wrong", "fail");
    expect(at(rec, 1)).toMatchObject({ status: "fail", settled: true });
    expect(retriesLeft(at(rec, 1))).toBe(0);
    expect(settledAnswer(at(rec, 1))).toBe("wrong");
  });

  it("unjudged: the first answer settles as answered; with retries Infinity it can change forever", () => {
    let rec = reach(EMPTY_RECORD, 2, Infinity, false);
    expect(settledAnswer(at(rec, 2))).toBeUndefined();
    for (let i = 0; i < 10; i++) {
      rec = applyAnswer(rec, 2, `a${i}`, null);
      expect(at(rec, 2)).toMatchObject({ status: "answered", settled: true });
      expect(canAnswer(at(rec, 2))).toBe(true);
    }
    expect(settledAnswer(at(rec, 2))).toBe("a9");
  });

  it("skip marks skipped; a later answer counts as the first (no retry used)", () => {
    let rec = skipEntry(reach(EMPTY_RECORD, 1, 0, false), 1);
    expect(at(rec, 1).status).toBe("skipped");
    expect(settledAnswer(at(rec, 1))).toBeUndefined();
    expect(canAnswer(at(rec, 1))).toBe(true);
    rec = applyAnswer(rec, 1, "x", null);
    expect(at(rec, 1)).toMatchObject({ status: "answered", settled: true });
    expect(at(rec, 1).attempts).toHaveLength(1);
    expect(canAnswer(at(rec, 1))).toBe(false);
  });

  it("applyAnswer on a settled entry with no retries left returns the same record object", () => {
    const rec = applyAnswer(reach(EMPTY_RECORD, 3), 3, "keep", "pass");
    expect(applyAnswer(rec, 3, "again", "pass")).toBe(rec);
  });

  it("reachEntry is idempotent per frame and keeps reach order", () => {
    let rec = reach(EMPTY_RECORD, 5);
    rec = reach(rec, 2);
    const again = reach(rec, 5);
    expect(again).toBe(rec);
    expect(rec.entries.map((e) => e.frame)).toEqual([5, 2]);
  });

  it("truncateAfter(rec, 4) drops entries with frame > 4", () => {
    let rec = reach(reach(reach(EMPTY_RECORD, 1), 4), 7);
    rec = truncateAfter(rec, 4);
    expect(rec.entries.map((e) => e.frame)).toEqual([1, 4]);
  });

  it("scoreOf counts reached/passed/failed/answered/skipped", () => {
    let rec: PromptRecord<string> = EMPTY_RECORD;
    rec = applyAnswer(reach(rec, 1), 1, "a", "pass");
    rec = applyAnswer(reach(rec, 2), 2, "a", "fail");
    rec = applyAnswer(reach(rec, 3, 0, false), 3, "a", null);
    rec = skipEntry(reach(rec, 4, 0, false), 4);
    rec = reach(rec, 5);
    expect(scoreOf(rec)).toEqual({ reached: 5, passed: 1, failed: 1, answered: 1, skipped: 1 });
  });
});
