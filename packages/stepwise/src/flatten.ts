import type { Chapter } from "./types";

export interface FlatChapter {
  chapter: Chapter;
  depth: number;
  /** Index of this entry's top-level ancestor within the flat list (itself at depth 0). */
  rootIndex: number;
  /** Index of the immediate parent within the flat list; -1 at depth 0. */
  parentIndex: number;
}

/** Depth-first flattening — reading order for prev/next and scroll tracking. */
export function flattenChapters(chapters: Chapter[], depth = 0): FlatChapter[] {
  const out: FlatChapter[] = [];
  const walk = (list: Chapter[], depth: number, parentIndex: number, rootIndex: number) => {
    for (const chapter of list) {
      const index = out.length;
      const effectiveRoot = depth === 0 ? index : rootIndex;
      out.push({ chapter, depth, rootIndex: effectiveRoot, parentIndex });
      if (chapter.children?.length) walk(chapter.children, depth + 1, index, effectiveRoot);
    }
  };
  walk(chapters, depth, -1, -1);
  return out;
}
