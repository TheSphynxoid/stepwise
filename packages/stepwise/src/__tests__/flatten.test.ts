import { describe, it, expect } from "vitest";
import { flattenChapters } from "../flatten";
import type { Chapter } from "../types";

describe("flattenChapters", () => {
  it("returns flat chapters at depth 0", () => {
    const chapters: Chapter[] = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const flat = flattenChapters(chapters);
    expect(flat).toHaveLength(2);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(0);
    expect(flat[0].chapter.id).toBe("a");
  });

  it("flattens nested chapters depth-first", () => {
    const chapters: Chapter[] = [
      { id: "a", label: "A", children: [{ id: "a1", label: "A1" }, { id: "a2", label: "A2" }] },
      { id: "b", label: "B" },
    ];
    const flat = flattenChapters(chapters);
    expect(flat.map((f) => f.chapter.id)).toEqual(["a", "a1", "a2", "b"]);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
    expect(flat[3].depth).toBe(0);
  });

  it("handles arbitrary depth", () => {
    const chapters: Chapter[] = [
      { id: "a", label: "A", children: [{ id: "a1", label: "A1", children: [{ id: "a1x", label: "A1X" }] }] },
    ];
    const flat = flattenChapters(chapters);
    expect(flat.map((f) => f.chapter.id)).toEqual(["a", "a1", "a1x"]);
    expect(flat[2].depth).toBe(2);
  });

  it("returns empty for empty input", () => {
    expect(flattenChapters([])).toEqual([]);
  });
});

