import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useGuidedTour } from "../use-guided-tour";
import type { TourDriver, TourStepInput } from "../types";

function makeSteps() {
  return [
    { id: "a", title: "A", body: "first", onEnter: vi.fn() },
    { id: "b", title: "B", body: "second", onEnter: vi.fn() },
    { id: "c", title: "C", body: "third", onEnter: vi.fn() },
  ] as TourStepInput[];
}

function makeDriver(): TourDriver {
  return { show: vi.fn(), hide: vi.fn() };
}

afterEach(cleanup);

describe("useGuidedTour — state", () => {
  it("is inactive until started", () => {
    const { result } = renderHook(() => useGuidedTour(makeSteps()));
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBeNull();
    expect(result.current.current).toBeNull();
  });

  it("start() activates step 0 and fires its onEnter once", () => {
    const steps = makeSteps();
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.index).toBe(0);
    expect(result.current.current?.title).toBe("A");
    expect(steps[0].onEnter).toHaveBeenCalledTimes(1);
  });

  it("next() advances and fires each step's onEnter once", () => {
    const steps = makeSteps();
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(steps[1].onEnter).toHaveBeenCalledTimes(1);
    expect(steps[0].onEnter).toHaveBeenCalledTimes(1);
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
    expect(steps[2].onEnter).toHaveBeenCalledTimes(1);
  });

  it("next() past the end exits the tour", () => {
    const steps = makeSteps();
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBeNull();
    expect(result.current.current).toBeNull();
    expect(steps[2].onEnter).toHaveBeenCalledTimes(1); // no phantom fifth call
  });

  it("back() steps back and clamps at the start without exiting", () => {
    const { result } = renderHook(() => useGuidedTour(makeSteps()));
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
    expect(result.current.active).toBe(true);
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
    expect(result.current.active).toBe(true);
  });

  it("end() deactivates", () => {
    const { result } = renderHook(() => useGuidedTour(makeSteps()));
    act(() => result.current.start());
    act(() => result.current.end());
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBeNull();
  });

  it("goto() clamps and activates the tour", () => {
    const steps = makeSteps();
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.goto(9));
    expect(result.current.active).toBe(true);
    expect(result.current.index).toBe(2);
    expect(steps[2].onEnter).toHaveBeenCalledTimes(1);
    act(() => result.current.goto(-3));
    expect(result.current.index).toBe(0);
  });

  it("an empty tour refuses to start", () => {
    const { result } = renderHook(() => useGuidedTour([]));
    act(() => result.current.start());
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBeNull();
  });

  it("onEnter reads the latest steps via ref when the array identity changes", () => {
    const first = makeSteps();
    const second = makeSteps();
    const { result, rerender } = renderHook(
      ({ steps }) => useGuidedTour(steps),
      { initialProps: { steps: first } }
    );
    rerender({ steps: second });
    act(() => result.current.start());
    expect(second[0].onEnter).toHaveBeenCalledTimes(1);
    expect(first[0].onEnter).not.toHaveBeenCalled();
  });
});

describe("useGuidedTour — custom driver", () => {
  it("shows each step with a wired context and hides on end + unmount", () => {
    const steps = makeSteps();
    const driver = makeDriver();
    const { result, unmount } = renderHook(() => useGuidedTour(steps, { driver }));

    // Mounting with an inactive tour tells the driver to hide once.
    expect(driver.hide).toHaveBeenCalledTimes(1);

    act(() => result.current.start());
    expect(driver.show).toHaveBeenCalledTimes(1);
    expect(driver.show).toHaveBeenCalledWith(
      steps[0],
      expect.objectContaining({ index: 0, total: 3 })
    );

    const ctx = (driver.show as ReturnType<typeof vi.fn>).mock.calls[0][1];
    act(() => ctx.next());
    expect(result.current.index).toBe(1);
    expect(driver.show).toHaveBeenLastCalledWith(
      steps[1],
      expect.objectContaining({ index: 1 })
    );
    act(() => ctx.back());
    expect(result.current.index).toBe(0);
    act(() => ctx.end());
    expect(result.current.active).toBe(false);
    expect(driver.hide).toHaveBeenCalledTimes(2);

    unmount();
    expect(driver.hide).toHaveBeenCalledTimes(3);
  });

  it("hides immediately when the tour is inactive with a driver present", () => {
    const driver = makeDriver();
    renderHook(() => useGuidedTour(makeSteps(), { driver }));
    expect(driver.hide).toHaveBeenCalledTimes(1);
  });
});

describe("useGuidedTour — when (conditional steps)", () => {
  it("start() skips steps whose when is false", () => {
    let isBeginner = false;
    const steps: TourStepInput[] = [
      { id: "basics", title: "Basics", body: "", when: () => isBeginner, onEnter: vi.fn() },
      { id: "real", title: "Real", body: "", onEnter: vi.fn() },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.index).toBe(1);
    expect(result.current.current?.id).toBe("real");
    expect(steps[0].onEnter).not.toHaveBeenCalled(); // skipped steps never fire
    expect(steps[1].onEnter).toHaveBeenCalledTimes(1);
  });

  it("next() walks forward past skipped steps", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "b", title: "B", body: "", when: () => false }, // always skipped
      { id: "c", title: "C", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
    expect(result.current.current?.id).toBe("c");
  });

  it("back() walks backward past skipped steps", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "b", title: "B", body: "", when: () => false },
      { id: "c", title: "C", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
  });

  it("back() from a restart point stays at the first eligible step", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", when: () => false }, // never landable
      { id: "b", title: "B", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.index).toBe(1);
    act(() => result.current.back());
    expect(result.current.index).toBe(1); // backward walk exhausted → restart
    expect(result.current.active).toBe(true);
  });

  it("advancing past an all-skipped tail exits the tour", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "gone", title: "Gone", body: "", when: () => false },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBeNull();
  });

  it("when is evaluated at arrival time, not build time", () => {
    let beginner = true;
    const steps: TourStepInput[] = [
      { id: "basics", title: "Basics", body: "", when: () => beginner },
      { id: "real", title: "Real", body: "" },
    ];
    const { result, rerender } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.index).toBe(0);
    act(() => {
      beginner = false;
      rerender();
    });
    act(() => result.current.end());
    act(() => result.current.start());
    expect(result.current.index).toBe(1);
  });

  it("goto settles forward past skipped steps", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "b", title: "B", body: "", when: () => false },
      { id: "c", title: "C", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.goto(1));
    expect(result.current.index).toBe(2);
  });
});

describe("useGuidedTour — gate", () => {
  it("blocks next() while closed, reports blocked, and opens on state change", () => {
    let open = false;
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", gate: () => open },
      { id: "b", title: "B", body: "" },
    ];
    const { result, rerender } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    expect(result.current.blocked).toBe(true);
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
    act(() => {
      open = true;
      rerender();
    });
    expect(result.current.blocked).toBe(false);
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
  });

  it("goto/gotoId bypass the gate (programmatic navigation stays free)", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", gate: () => false },
      { id: "b", title: "B", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.gotoId("b"));
    expect(result.current.index).toBe(1);
  });

  it("back() is not gated (rewinding is always allowed)", () => {
    let open = false;
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "b", title: "B", body: "", gate: () => open },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.goto(1));
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
  });
});

describe("useGuidedTour — next edges", () => {
  it("follows the step's next() id instead of index+1", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", next: () => "c" },
      { id: "b", title: "B", body: "" },
      { id: "c", title: "C", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
    expect(result.current.current?.id).toBe("c");
  });

  it("an edge from the last step keeps the tour alive (loop)", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", onEnter: vi.fn() },
      { id: "b", title: "B", body: "", next: () => "a" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
    expect(result.current.active).toBe(true);
  });

  it("a null edge on the last step exits linearly", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "" },
      { id: "b", title: "B", body: "", next: () => null },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
  });

  it("an edge naming an unknown id falls back to index+1", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", next: () => "missing" },
      { id: "b", title: "B", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
  });

  it("edges respect skipped targets (edge into a when:false step settles forward)", () => {
    const steps: TourStepInput[] = [
      { id: "a", title: "A", body: "", next: () => "b" },
      { id: "b", title: "B", body: "", when: () => false },
      { id: "c", title: "C", body: "" },
    ];
    const { result } = renderHook(() => useGuidedTour(steps));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
  });
});

describe("useGuidedTour — gotoId", () => {
  it("jumps by id; unknown ids are no-ops", () => {
    const { result } = renderHook(() => useGuidedTour(makeSteps()));
    act(() => result.current.gotoId("c"));
    expect(result.current.index).toBe(2);
    act(() => result.current.gotoId("zzz"));
    expect(result.current.index).toBe(2);
  });

  it("next()/back() are no-ops while the tour is inactive", () => {
    const { result } = renderHook(() => useGuidedTour(makeSteps()));
    act(() => result.current.next());
    act(() => result.current.back());
    expect(result.current.index).toBeNull();
    expect(result.current.active).toBe(false);
  });
});
