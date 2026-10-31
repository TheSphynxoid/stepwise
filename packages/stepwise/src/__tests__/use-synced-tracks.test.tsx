import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { alignTracks, useSyncedTracks } from "../use-synced-tracks";
import type { StepTone, StepwiseStep } from "../types";

afterEach(cleanup);

const s = (label: string, tone: StepTone = "neutral") => ({ tone, label });
const labels = (tracks: Record<string, readonly StepwiseStep[]>, rows: ReturnType<typeof alignTracks>) =>
  rows.map((r) => Object.keys(r).map((n) => `${tracks[n][r[n].index]?.label}${r[n].held ? "*" : ""}`).join("|"));

const A = [s("a0"), s("a1"), s("a2", "good")];
const B = [s("b0", "write"), s("b1", "bad")];

describe("alignTracks", () => {
  it("hold mode: longest track sets the length, shorter ones hold their last frame", () => {
    const rows = alignTracks({ a: A, b: B });
    expect(labels({ a: A, b: B }, rows)).toEqual(["a0|b0", "a1|b1", "a2|b1*"]);
  });

  it("key mode: a track waits at a sync point until the others reach it", () => {
    const a = [s("x"), s("y"), s("SYNC"), s("z")];
    const b = [s("p"), s("SYNC"), s("q")];
    const key = (step: { label: string }) => (step.label === "SYNC" ? "sync" : null);
    const rows = alignTracks({ a, b }, key);
    expect(labels({ a, b }, rows)).toEqual(["x|p", "y|p*", "SYNC|SYNC", "z|q"]);
  });

  it("key mode: a track whose first step is a sync point waits at frame 0, held", () => {
    const a = [s("x"), s("S")];
    const b = [s("S"), s("q")];
    const rows = alignTracks({ a, b }, (st) => (st.label === "S" ? "S" : null));
    expect(labels({ a, b }, rows)).toEqual(["x|S*", "S|S", "S*|q"]);
  });

  it("key mode: n-th occurrence pairs with n-th occurrence", () => {
    const a = [s("k"), s("k")];
    const b = [s("free"), s("k"), s("k")];
    const rows = alignTracks({ a, b }, (st) => (st.label === "k" ? "k" : null));
    expect(labels({ a, b }, rows)).toEqual(["k*|free", "k|k", "k|k"]);
  });

  it("key mode: conflicting key order degrades to lockstep instead of deadlocking", () => {
    const a = [s("x"), s("y")];
    const b = [s("y"), s("x")];
    const rows = alignTracks({ a, b }, (st) => st.label);
    expect(labels({ a, b }, rows)).toEqual(["x|y", "y|x"]);
  });

  it("handles empty tracks", () => {
    expect(alignTracks({})).toEqual([]);
    const rows = alignTracks({ a: A, e: [] });
    expect(rows).toHaveLength(3);
    expect(rows[0].e).toEqual({ index: -1, held: true });
  });
});

describe("useSyncedTracks", () => {
  it("one player over the aligned timeline; frame 0 before start", () => {
    const { result } = renderHook(() => useSyncedTracks({ a: A, b: B }));
    expect(result.current.total).toBe(3);
    expect(result.current.player.index).toBe(-1);
    expect(result.current.frame).toBe(0);
    expect(result.current.tracks.a.step?.label).toBe("a0");
    expect(result.current.tracks.b.step?.label).toBe("b0");

    act(() => result.current.player.seek(2));
    expect(result.current.tracks.a).toMatchObject({ index: 2, held: false, done: true, length: 3 });
    expect(result.current.tracks.b).toMatchObject({ index: 1, held: true, done: true });
  });

  it("memoizes the alignment over a fresh tracks object with the same arrays", () => {
    const { result, rerender } = renderHook(() => useSyncedTracks({ a: A, b: B }, { key: () => null }));
    const { rows, tracks, toneAt, titleAt, player } = result.current;
    rerender();
    expect(result.current.rows).toBe(rows);
    expect(result.current.tracks).toBe(tracks);
    expect(result.current.toneAt).toBe(toneAt);
    expect(result.current.titleAt).toBe(titleAt);
    expect(result.current.player.seek).toBe(player.seek);
  });

  it("re-aligns when a track changes", () => {
    const { result, rerender } = renderHook(({ b }) => useSyncedTracks({ a: A, b }), {
      initialProps: { b: B as readonly StepwiseStep[] },
    });
    expect(result.current.total).toBe(3);
    rerender({ b: [...B, s("b2"), s("b3")] });
    expect(result.current.total).toBe(4);
  });

  it("toneAt / titleAt summarise the tracks that moved on a frame", () => {
    const { result } = renderHook(() => useSyncedTracks({ a: A, b: B }));
    expect(result.current.toneAt(0)).toBe("write");
    expect(result.current.toneAt(1)).toBe("bad");
    // frame 2: b is holding, so only a's "good" counts
    expect(result.current.toneAt(2)).toBe("good");
    expect(result.current.titleAt(2)).toBe("a: a2");
    expect(result.current.titleAt(0)).toBe("a: a0 · b: b0");
    expect(result.current.titleAt(9)).toBe("frame 10");
  });

  it("is empty-safe", () => {
    const { result } = renderHook(() => useSyncedTracks({ a: [] as StepwiseStep[] }));
    expect(result.current.frame).toBe(-1);
    expect(result.current.tracks.a.step).toBeUndefined();
    expect(result.current.tracks.a.index).toBe(-1);
  });
});
