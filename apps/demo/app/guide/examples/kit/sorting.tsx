// sorting.tsx: what a page or an MDX file imports. No "use client": it runs
// the definition on the server, so the first frame is in the HTML and a
// definition that throws fails the build instead of the page.
import { precomputed } from "@sphynxoid/stepwise/kit/mdx";
import { sorting } from "./sorting.explainer";
import { SortingClient } from "./sorting-player";
import { ThemedSortingClient } from "./sorting-player"; // demo-only

export const Sorting = precomputed(sorting, SortingClient);
export const ThemedSorting = precomputed(sorting, ThemedSortingClient); // demo-only
