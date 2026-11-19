"use client";

import { GlossaryProvider, Term, GlossaryAppendix, type GlossaryEntry } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

// Definitions can use <Term> themselves: hover "bucket", then "hash" inside it.
const ENTRIES: GlossaryEntry[] = [
  { id: "hash", term: "Hash", definition: "A number computed from a key, the same every time for the same key." },
  { id: "bucket", term: "Bucket", definition: <>A slot in the table, picked by the key&apos;s <Term id="hash">hash</Term>.</> },
  { id: "collision", term: "Collision", definition: <>Two keys landing in the same <Term id="bucket">bucket</Term>.</> },
];

export function HashGlossary() {
  const { theme } = useSiteTheme(); // demo-only
  return (
    <GlossaryProvider
      entries={ENTRIES}
      theme={theme} // demo-only
    >
      <p className="text-sm leading-relaxed">
        A hash table stores each key in a <Term id="bucket">bucket</Term>. When two keys meet in one, that&apos;s a{" "}
        <Term id="collision">collision</Term>, and the table has to keep both.
      </p>
      <GlossaryAppendix columns={1} className="mt-4" />
    </GlossaryProvider>
  );
}
