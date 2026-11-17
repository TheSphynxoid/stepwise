import type { StepwiseStep } from "@sphynxoid/stepwise/core";
import { BAD_COMMIT, COMMITS } from "./tidepool";

// The CI feed for §09: one build per commit, as a timeline that grows while
// the reader watches. Builds from the bad commit on fail at the unit stage
// (the boundary test from §02 is in the suite); the last build is the fix.

export type Stage = { name: "lint" | "unit" | "api" | "e2e"; status: "passed" | "failed" | "skipped" };
export type Build = StepwiseStep<{
  n: number;
  commit: number;
  sha: string;
  msg: string;
  status: "passed" | "failed";
  stages: Stage[];
  minutes: number;
}>;

const stagesFor = (bad: boolean): Stage[] => [
  { name: "lint", status: "passed" },
  { name: "unit", status: bad ? "failed" : "passed" },
  { name: "api", status: bad ? "skipped" : "passed" },
  { name: "e2e", status: bad ? "skipped" : "passed" },
];

const build = (n: number, commit: number, sha: string, msg: string, bad: boolean): Build => ({
  key: `build.${n}`,
  tone: bad ? "bad" : "good",
  label: `#${n} ${sha} ${msg}: ${bad ? "failed at unit" : "passed"}`,
  n,
  commit,
  sha,
  msg,
  status: bad ? "failed" : "passed",
  stages: stagesFor(bad),
  minutes: bad ? 2 : 9,
});

export const BUILDS: Build[] = [
  ...COMMITS.map((c, i) => build(i + 1, i, c.sha, c.msg, i >= BAD_COMMIT)),
  build(COMMITS.length + 1, COMMITS.length, "f1x0a9e", "fix: child price below 12 again (bisected to simplify age checks)", false),
];

/** Builds already in the feed when the page loads; the rest stream in. */
export const INITIAL_BUILDS = 8;
export const BUILD_EVERY_MS = 1400;
