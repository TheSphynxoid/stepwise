import { readFileSync } from "node:fs";
import path from "node:path";
import { SourcePanel } from "./source-panel";

// Server component: reads the demo's real source at build time (pages are
// statically prerendered), so the "View source" panel can never drift from
// the code that actually runs. `file` is relative to apps/demo.

const REPO = "TheSphynxoid/stepwise";
const BRANCH = "master";

export function ViewSource({ file }: { file: string }) {
  const source = readFileSync(path.join(process.cwd(), file), "utf8");
  const repoPath = `apps/demo/${file}`;
  return (
    <SourcePanel
      file={repoPath}
      // Empty lines would collapse to zero height inside CodeBlock.
      lines={source.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map((l) => l || " ")}
      githubUrl={`https://github.com/${REPO}/blob/${BRANCH}/${repoPath}`}
      // The root `demo` script builds the library before starting the demo,
      // since the demo imports it through dist.
      stackblitzUrl={`https://stackblitz.com/github/${REPO}?file=${encodeURIComponent(repoPath)}&startScript=demo`}
    />
  );
}
