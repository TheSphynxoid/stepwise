import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { fail, pass, pending, toVerdict, type Evaluator } from "../evaluate";
import { useEvaluator } from "../use-evaluator";
import { useGuidedTour } from "../use-guided-tour";
import type { TourStepInput } from "../types";

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("verdicts", () => {
  it("normalizes booleans and builds verdicts", () => {
    expect(toVerdict(true)).toEqual({ status: "pass" });
    expect(toVerdict(false)).toEqual({ status: "fail" });
    expect(pass("yes")).toEqual({ status: "pass", feedback: "yes" });
    expect(fail().status).toBe("fail");
    expect(pending("wait").status).toBe("pending");
  });
});

describe("useEvaluator — auto", () => {
  it("judges immediately and on every context change", () => {
    const isEven: Evaluator<number> = (n) => (n % 2 === 0 ? pass("even") : fail("odd"));
    const { result, rerender } = renderHook(({ n }) => useEvaluator(isEven, n), { initialProps: { n: 1 } });
    expect(result.current.status).toBe("fail");
    expect(result.current.feedback).toBe("odd");
    rerender({ n: 4 });
    expect(result.current.passed).toBe(true);
    expect(result.current.feedback).toBe("even");
  });

  it("reports pending for async checks and drops superseded results", async () => {
    const calls: { n: number; d: ReturnType<typeof deferred<boolean>>; signal: AbortSignal }[] = [];
    const slow: Evaluator<number> = (n, signal) => {
      const d = deferred<boolean>();
      calls.push({ n, d, signal });
      return d.promise;
    };
    const { result, rerender } = renderHook(({ n }) => useEvaluator(slow, n), { initialProps: { n: 1 } });
    expect(result.current.status).toBe("pending");

    rerender({ n: 2 });
    expect(calls[0].signal.aborted).toBe(true);
    // The stale check resolving "pass" late must not win.
    await act(async () => calls[0].d.resolve(true));
    expect(result.current.status).toBe("pending");
    await act(async () => calls[1].d.resolve(false));
    expect(result.current.status).toBe("fail");
  });

  it("a throwing evaluator fails with the error kept", () => {
    const boom: Evaluator<null> = () => {
      throw new Error("nope");
    };
    const { result } = renderHook(() => useEvaluator(boom, null));
    expect(result.current.status).toBe("fail");
    expect((result.current.error as Error).message).toBe("nope");
  });
});

describe("useEvaluator — manual", () => {
  it("waits for check(), counts attempts, and clears on a new answer", async () => {
    const isB: Evaluator<string | null> = (g) => (g === "b" ? pass("Right") : fail("Try again"));
    const { result, rerender } = renderHook(({ g }) => useEvaluator(isB, g, { mode: "manual" }), {
      initialProps: { g: "a" as string | null },
    });
    expect(result.current.status).toBe("idle");
    const { check, reset } = result.current;

    await act(async () => {
      await result.current.check();
    });
    expect(result.current.status).toBe("fail");
    expect(result.current.attempts).toBe(1);

    rerender({ g: "b" });
    expect(result.current.status).toBe("idle");
    await act(async () => {
      expect((await result.current.check())?.status).toBe("pass");
    });
    expect(result.current.passed).toBe(true);
    expect(result.current.attempts).toBe(2);

    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.attempts).toBe(0);
    expect(result.current.check).toBe(check);
    expect(result.current.reset).toBe(reset);
  });
});

describe("useGuidedTour — verdict gates", () => {
  it("blocks on a failing verdict and surfaces its feedback", () => {
    let staged = 0;
    const steps: TourStepInput[] = [
      {
        id: "stage",
        title: "Stage",
        body: null,
        gate: () => (staged > 0 ? pass("Nice, staged.") : fail("Stage at least one file")),
      },
      { id: "commit", title: "Commit", body: null },
    ];
    const { result, rerender } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.blocked).toBe(true);
    expect(result.current.feedback).toBe("Stage at least one file");
    act(() => result.current.next());
    expect(result.current.index).toBe(0);

    staged = 1;
    rerender();
    expect(result.current.blocked).toBe(false);
    expect(result.current.feedback).toBe("Nice, staged.");
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(result.current.feedback).toBeUndefined();
  });

  it("treats a pending verdict as blocked", () => {
    const steps: TourStepInput[] = [
      { title: "Wait", body: null, gate: () => pending("Checking…") },
      { title: "Done", body: null },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
    expect(result.current.blocked).toBe(true);
  });
});
