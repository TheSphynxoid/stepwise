import { describe, expect, it } from "vitest";
import { createTrace } from "../create-trace";

describe("createTrace", () => {
  it("records typed frames in order and chains", () => {
    const t = createTrace<{ arr: number[] }>();
    t.step({ tone: "neutral", label: "start", arr: [2, 1] }).step({ tone: "write", label: "swap", arr: [1, 2] });
    expect(t.length).toBe(2);
    expect(t.last()?.label).toBe("swap");
    const steps = t.build();
    expect(steps.map((s) => s.label)).toEqual(["start", "swap"]);
    expect(steps[1].arr).toEqual([1, 2]);
  });

  it("build() snapshots — later steps don't leak into earlier builds", () => {
    const t = createTrace();
    t.step({ tone: "neutral", label: "a" });
    const first = t.build();
    t.step({ tone: "good", label: "b" });
    expect(first).toHaveLength(1);
    expect(t.build()).toHaveLength(2);
    expect(t.build()).not.toBe(t.build());
  });

  it("is empty-safe", () => {
    const t = createTrace();
    expect(t.length).toBe(0);
    expect(t.last()).toBeUndefined();
    expect(t.build()).toEqual([]);
  });
});
