import { Term, type GlossaryEntry } from "@sphynxoid/stepwise";

/**
 * The three flagged terms of the article. The appendix at the end of the page
 * collects exactly these provider entries, so this list is the source of truth.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "sorted-array",
    term: "sorted array",
    definition: (
      <>
        An array whose values are in ascending order from index 0 onward.
        Sorting is what lets a scan skip whole regions: because a{" "}
        <Term id="sorted-array">sorted array</Term> places larger values to the
        right, a probe that is smaller than your target proves that target can
        only be to the probe&apos;s right — the basis of every{" "}
        <Term id="logarithmic-time">logarithmic-time</Term> halving in binary
        search.
      </>
    ),
  },
  {
    id: "logarithmic-time",
    term: "logarithmic time",
    definition: (
      <>
        A runtime of the form O(log n): each additional input element buys at
        most one more step. Binary search achieves it by halving the element
        count every time it narrows the window — 7 elements need ~3 comparisons,
        1,000,000 need ~20 — provided the input is a{" "}
        <Term id="sorted-array">sorted array</Term>.
      </>
    ),
  },
  {
    id: "invariant",
    term: "invariant",
    definition: (
      <>
        A statement that holds true before and after every step of a loop.
        Binary search&apos;s <Term id="invariant">invariant</Term>: &ldquo;if
        the target is in the array at all, it lies between <code>lo</code> and{" "}
        <code>hi</code>&rdquo;. Every move the search makes preserves that
        statement, which is precisely why dodging half of a{" "}
        <Term id="sorted-array">sorted array</Term> never risks losing the
        solution.
      </>
    ),
  },
];
