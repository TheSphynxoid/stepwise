import type { MDXComponents } from "mdx/types";
import { stepwiseComponents } from "@sphynxoid/stepwise/kit/mdx";

// Every article gets the glossary and the explainer parts without importing them.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...stepwiseComponents, ...components };
}
