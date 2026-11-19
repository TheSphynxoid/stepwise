import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { WalkSimulation, WalkStep } from "../walk";
import { addPath, branchesOf } from "../branch-history";
import type { BranchNode } from "../branch-history";
import { usePrompts } from "../use-prompts";
import { usePromptHistory } from "../use-prompt-history";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const empty: BranchNode<string> = { answers: [], children: [] };

describe("addPath / branchesOf", () => {
  it("addPath keeps an abandoned branch when overwrite is off", () => {
    const tree = addPath(addPath(empty, ["a", "b"], false), ["a", "c"], false);
    expect(branchesOf(tree)).toEqual([
      ["a", "b"],
      ["a", "c"],
    ]);
  });

  it("overwrite on replaces the branch", () => {
    const tree = addPath(addPath(empty, ["a", "b"], true), ["a", "c"], true);
    expect(branchesOf(tree)).toEqual([["a", "c"]]);
  });

  it("a path that follows or extends an existing one adds no branch", () => {
    const one = addPath(empty, ["a", "b"], false);
    expect(addPath(one, ["a"], true)).toBe(one);
    expect(branchesOf(addPath(one, ["a", "b", "d"], true))).toEqual([["a", "b", "d"]]);
  });
});

type W = WalkStep;
const s = (key: string): W => ({ key, tone: "neutral", label: key });
// The first answer picks the path.
const forkStory: WalkSimulation<null, W, string> = function* () {
  yield s("intro");
  const c = yield { ...s("fork"), prompt: { options: ["left", "right"] } };
  yield s(c === "left" ? "L" : "R");
  yield s("end");
};

const setup = (opts?: { overwrite?: boolean }) =>
  renderHook(() => {
    const run = usePrompts({ simulation: forkStory, input: null }, { onInputChange: "keep", retries: Infinity });
    return { run, history: usePromptHistory(run, opts) };
  });

const answer = (r: ReturnType<typeof setup>["result"], a: string) => {
  act(() => r.current.run.player.jump(1));
  act(() => r.current.run.respond(a));
};

describe("usePromptHistory", () => {
  it("the hook counts a backtrack each time a settled generator answer changes", () => {
    const { result } = setup();
    answer(result, "left");
    expect(result.current.history.backtracks).toBe(0);
    answer(result, "right");
    expect(result.current.history.backtracks).toBe(1);
    expect(result.current.history.branches).toEqual([["left"], ["right"]]);
    answer(result, "left");
    expect(result.current.history.backtracks).toBe(2);
    expect(result.current.history.branches).toHaveLength(2);
  });

  it("overwrite drops the branch an answer replaced", () => {
    const { result } = setup({ overwrite: true });
    answer(result, "left");
    answer(result, "right");
    expect(result.current.history.branches).toEqual([["right"]]);
  });

  it("restore replays a kept branch", () => {
    const { result } = setup();
    answer(result, "left");
    answer(result, "right");
    expect(result.current.run.steps.map((x) => x.label)).toEqual(["intro", "fork", "R", "end"]);
    act(() => result.current.history.restore(["left"]));
    expect(result.current.run.steps.map((x) => x.label)).toEqual(["intro", "fork", "L", "end"]);
    expect(result.current.history.backtracks).toBe(1);
    expect(result.current.history.branches).toEqual([["left"], ["right"]]);
  });

  it("restoreAnswers while the input is locked is ignored with one dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => usePrompts({ simulation: forkStory, input: null }, { onInputChange: "lock" }));
    act(() => result.current.player.jump(1));
    act(() => result.current.respond("left"));
    expect(result.current.inputLocked).toBe(true);
    act(() => result.current.restoreAnswers(["right"]));
    act(() => result.current.restoreAnswers(["right"]));
    expect(result.current.steps.map((x) => x.label)).toEqual(["intro", "fork", "L", "end"]);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("[stepwise]"))).toHaveLength(1);
  });
});
