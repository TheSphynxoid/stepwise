import type { Chapter } from "./types";

export interface FlatChapter {
  chapter: Chapter;
  depth: number;
}

/** Depth-first flattening — reading order for prev/next and scroll tracking. */
export function flattenChapters(chapters: Chapter[], depth = 0): FlatChapter[] {
  return chapters.flatMap((chapter) => [
    { chapter, depth },
    ...(chapter.children ? flattenChapters(chapter.children, depth + 1) : []),
  ]);
}
