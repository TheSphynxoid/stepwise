// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { EXPLAINER_PROP_NAMES, createRng, defineExplainer, fromGraph, normalizeOptions, precompute, resolveInput } from "../core";

type CountStep = { key: string; tone: "neutral"; label: string; i: number; probe?: unknown };

const count = defineExplainer({
  name: "count",
  simulation: function* (n: number) {
    for (let i = 0; i < n; i++) yield { key: `k${i}`, tone: "neutral" as const, label: `step ${i}`, i };
  },
  input: { default: 3 },
});

const expectedSteps = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, tone: "neutral", label: `step ${i}`, i }));

describe("defineExplainer / precompute", () => {
  it("defineExplainer returns a frozen definition", () => {
    expect(Object.isFrozen(count)).toBe(true);
  });

  it("a definition without input runs on null and precomputes to JSON", () => {
    const tour = defineExplainer({
      name: "tour",
      simulation: function* () {
        yield { key: "a", tone: "neutral" as const, label: "a", i: 0 };
      },
    });
    expect(tour.input.default).toBeNull();
    expect(Object.isFrozen(tour)).toBe(true);
    expect(precompute(tour)).toEqual({ input: null, seed: 0, steps: [{ key: "a", tone: "neutral", label: "a", i: 0 }] });
    expect(resolveInput(tour, { id: "x", theme: {} })).toBeNull();
  });

  it("precompute runs the default input", () => {
    expect(precompute(count)).toEqual({ input: 3, seed: 0, steps: expectedSteps(3) });
  });

  it("precompute takes an explicit input and the definition's seed", () => {
    expect(precompute(count, 5).steps).toHaveLength(5);
    const seeded = defineExplainer({ ...count, seed: "abc" });
    expect(precompute(seeded).seed).toBe(createRng("abc").seed);
  });

  it("output survives a JSON round trip unchanged", () => {
    const out = precompute(count, 4);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("throws when the simulation throws", () => {
    const boom = defineExplainer({
      name: "boom",
      simulation: function* (): Generator<CountStep> {
        throw new Error("nope");
      },
      input: { default: 0 },
    });
    expect(() => precompute(boom)).toThrow('[stepwise] precompute("boom"): simulation threw: nope');
  });

  it("precompute's maxSteps error says \"since the last prompt\" for walks with prompts", () => {
    const looping = defineExplainer({
      name: "looping",
      walk: function* () {
        yield { key: "p", tone: "neutral" as const, label: "p", prompt: {} };
        for (let i = 0; i < 20; i++) yield { key: `k${i}`, tone: "neutral" as const, label: "k" };
      },
      maxSteps: 5,
      choose: { options: () => [] },
    } as never);
    expect(() => precompute(looping as never, undefined, ["a"])).toThrow("steps since the last prompt");
  });

  it("throws when maxSteps is hit", () => {
    const capped = defineExplainer({ ...count, maxSteps: 5 });
    expect(() => precompute(capped, 6)).toThrow("hit maxSteps (5)");
    expect(precompute(capped, 5).steps).toHaveLength(5);
  });

  it("throws on non-JSON step data, naming the path", () => {
    const bad = (probe: unknown) =>
      defineExplainer({
        simulation: function* (): Generator<CountStep> {
          yield { key: "a", tone: "neutral", label: "a", i: 0 };
          yield { key: "b", tone: "neutral", label: "b", i: 1, probe };
        },
        input: { default: 0 },
      });
    expect(() => precompute(bad(() => 1))).toThrow("steps[1].probe is not JSON-serializable (function)");
    expect(() => precompute(bad(new Date()))).toThrow("steps[1].probe is not JSON-serializable (Date)");
    expect(() => precompute(bad(NaN))).toThrow("steps[1].probe is not JSON-serializable (NaN)");
    // The unnamed form of the message.
    expect(() => precompute(bad(() => 1))).toThrow('precompute("explainer")');
    function Thing(this: { x: number }) {
      this.x = 1;
    }
    expect(() => precompute(bad(new (Thing as unknown as new () => object)()))).toThrow(
      "steps[1].probe is not JSON-serializable (Thing)"
    );
    expect(() => precompute(bad({ nested: [1, { deep: Infinity }] }))).toThrow(
      "steps[1].probe.nested[1].deep is not JSON-serializable (Infinity)"
    );
  });

  it("accepts an optional field left undefined", () => {
    const ok = defineExplainer({
      simulation: function* (): Generator<CountStep> {
        yield { key: "a", tone: "neutral", label: "a", i: 0, probe: undefined };
      },
      input: { default: 0 },
    });
    expect(precompute(ok).steps).toHaveLength(1);
  });

  it("throws on a non-JSON input, naming the path, before running the simulation", () => {
    const sim = vi.fn(function* (_input: unknown): Generator<CountStep> {
      yield { key: "a", tone: "neutral", label: "a", i: 0 };
    });
    const takes = defineExplainer({ name: "takes", simulation: sim, input: { default: {} as unknown } });
    const label = '[stepwise] precompute("takes"): ';
    expect(() => precompute(takes, { n: NaN })).toThrow(`${label}input.n is not JSON-serializable (NaN)`);
    expect(() => precompute(takes, new Map())).toThrow(`${label}input is not JSON-serializable (Map)`);
    expect(() => precompute(takes, new Date(0))).toThrow(`${label}input is not JSON-serializable (Date)`);
    expect(() => precompute(takes, { big: BigInt(1) })).toThrow(`${label}input.big is not JSON-serializable (bigint)`);
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => precompute(takes, cyclic)).toThrow(`${label}input.self is not JSON-serializable (cycle)`);
    expect(sim).not.toHaveBeenCalled();
    // An undefined field is dropped by JSON, not changed; a shared (acyclic) object is fine.
    const shared = { x: 1 };
    expect(precompute(takes, { n: 1, gone: undefined, l: shared, r: shared }).steps).toHaveLength(1);
  });

  it("throws on a cyclic step with the cycle kind", () => {
    const loop = defineExplainer({
      simulation: function* (): Generator<CountStep> {
        const probe: Record<string, unknown> = {};
        probe.back = probe;
        yield { key: "a", tone: "neutral", label: "a", i: 0, probe };
      },
      input: { default: 0 },
    });
    expect(() => precompute(loop)).toThrow("steps[0].probe.back is not JSON-serializable (cycle)");
  });

  it("returns an empty trace for a simulation that yields nothing", () => {
    const empty = defineExplainer({ simulation: (): CountStep[] => [], input: { default: 0 } });
    expect(precompute(empty).steps).toEqual([]);
  });

  it("precomputes a fromGraph run over the default word", () => {
    const g = fromGraph({
      start: "a",
      nodes: { a: {}, b: {} },
      edges: [
        { from: "a", on: "0", to: "a" },
        { from: "a", on: "1", to: "b" },
        { from: "b", on: "0", to: "b" },
        { from: "b", on: "1", to: "a" },
      ],
      accept: ["a"],
    });
    const word = "10110";
    const def = defineExplainer({ simulation: g.simulation, input: { default: word } });
    const out = precompute(def);
    expect(out.steps).toHaveLength(word.length + 1);
    expect(out.steps[0].node).toBe("a");
  });
});

describe("resolveInput", () => {
  const def = { input: { default: { arr: [1], target: 2 } } };

  it("input prop replaces; field props override own keys only", () => {
    expect(resolveInput(def, { target: 9, predict: true })).toEqual({ arr: [1], target: 9 });
    const X = { arr: [7], target: 0 };
    expect(resolveInput(def, { input: X, target: 5 })).toBe(X);
    expect(resolveInput(def)).toEqual({ arr: [1], target: 2 });
    expect(resolveInput(def, {})).not.toBe(def.input.default);
  });

  it("reserved prop names are never fields", () => {
    const withId = { input: { default: { id: 1, theme: "x", n: 3 } } };
    expect(resolveInput(withId, { id: "a", theme: {}, n: 4 })).toEqual({ id: 1, theme: "x", n: 4 });
    // `input` is how such a field is overridden.
    expect(resolveInput(withId, { input: { id: 2, theme: "y", n: 3 } })).toEqual({ id: 2, theme: "y", n: 3 });
    expect([...EXPLAINER_PROP_NAMES].sort()).toEqual(
      ["autoPlay", "children", "className", "definition", "id", "input", "keys", "link", "predict", "promptsEnabled", "theme", "trace", "view"]
    );
  });

  it("non-object default ignores field props", () => {
    expect(resolveInput({ input: { default: 3 } }, { target: 9 })).toBe(3);
    expect(resolveInput({ input: { default: [1, 2] } }, { 0: 9 })).toEqual([1, 2]);
  });
});

describe("normalizeOptions", () => {
  it("capitalizes bare strings", () => {
    expect(normalizeOptions(["left", { value: "r", label: "Right!" }])).toEqual([
      { value: "left", label: "Left" },
      { value: "r", label: "Right!" },
    ]);
  });
});
