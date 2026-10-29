import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useDiscoveries, localStorageStore, cookieStore, memoryStore } from "../use-discoveries";

function clearCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

beforeEach(() => {
  window.localStorage.clear();
  clearCookie("sw.test");
  clearCookie("sw.ck");
});
afterEach(cleanup);

describe("useDiscoveries — memoryStore", () => {
  it("starts empty, marks ids, and writes through to the store", () => {
    const store = memoryStore();
    const { result } = renderHook(() => useDiscoveries({ store }));
    expect(result.current.ready).toBe(true);
    expect(result.current.discovered.size).toBe(0);

    act(() => result.current.markDiscovered("feat:one"));
    expect(result.current.discovered.has("feat:one")).toBe(true);
    expect(result.current.isDiscovered("feat:one")).toBe(true);
    expect(store.read()).toEqual(["feat:one"]);
  });

  it("accepts batches and dedupes repeats", () => {
    const store = memoryStore();
    const { result } = renderHook(() => useDiscoveries({ store }));
    act(() => result.current.markDiscovered(["a", "b"]));
    act(() => result.current.markDiscovered("a"));
    expect(store.read()).toEqual(["a", "b"]);
  });

  it("hydrates from a seeded store", () => {
    const store = memoryStore(["seeded:x"]);
    const { result } = renderHook(() => useDiscoveries({ store }));
    expect(result.current.ready).toBe(true);
    expect(result.current.discovered.has("seeded:x")).toBe(true);
  });

  it("reset clears state and storage", () => {
    const store = memoryStore(["old"]);
    const { result } = renderHook(() => useDiscoveries({ store }));
    act(() => result.current.reset());
    expect(result.current.discovered.size).toBe(0);
    expect(store.read()).toEqual([]);
  });
});

describe("useDiscoveries — localStorageStore", () => {
  it("hydrates from localStorage and persists marks as JSON", () => {
    window.localStorage.setItem("sw.ls", JSON.stringify(["kept:1"]));
    const { result } = renderHook(() =>
      useDiscoveries({ store: localStorageStore("sw.ls") })
    );
    expect(result.current.discovered.has("kept:1")).toBe(true);

    act(() => result.current.markDiscovered("kept:2"));
    expect(JSON.parse(window.localStorage.getItem("sw.ls") ?? "[]")).toEqual([
      "kept:1",
      "kept:2",
    ]);
  });

  it("reads corrupted storage as empty and recovers on write", () => {
    window.localStorage.setItem("sw.ls", "{not json");
    const { result } = renderHook(() =>
      useDiscoveries({ store: localStorageStore("sw.ls") })
    );
    expect(result.current.discovered.size).toBe(0);
    act(() => result.current.markDiscovered("fresh"));
    expect(JSON.parse(window.localStorage.getItem("sw.ls") ?? "[]")).toEqual(["fresh"]);
  });

  it("ignores non-string entries", () => {
    window.localStorage.setItem("sw.ls", JSON.stringify(["good", 42, null, "also-good"]));
    const { result } = renderHook(() =>
      useDiscoveries({ store: localStorageStore("sw.ls") })
    );
    expect([...result.current.discovered]).toEqual(["good", "also-good"]);
  });
});

describe("useDiscoveries — cookieStore", () => {
  it("hydrates from a cookie and persists marks", () => {
    document.cookie = `sw.test=${encodeURIComponent(JSON.stringify(["ck:1"]))}; path=/`;
    const { result } = renderHook(() => useDiscoveries({ store: cookieStore("sw.test") }));
    expect(result.current.discovered.has("ck:1")).toBe(true);

    act(() => result.current.markDiscovered("ck:2"));
    const raw = document.cookie.match(/(?:^|;\s*)sw\.test=([^;]*)/)?.[1] ?? "";
    expect(JSON.parse(decodeURIComponent(raw))).toEqual(["ck:1", "ck:2"]);
  });

  it("reads an absent cookie as empty", () => {
    const { result } = renderHook(() => useDiscoveries({ store: cookieStore("sw.test") }));
    expect(result.current.ready).toBe(true);
    expect(result.current.discovered.size).toBe(0);
  });
});
