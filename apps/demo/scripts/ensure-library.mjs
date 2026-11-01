// Builds the library before the demo starts, when it needs it. The demo
// imports @sphynxoid/stepwise through the package `exports`, i.e. through
// packages/stepwise/dist, so without a build a fresh clone (StackBlitz, a
// new contributor running `npm run dev`) fails with "Module not found", and
// an old build silently serves stale code.
//
// Rebuilds when dist is missing or anything under src (or the build config)
// is newer than it; otherwise does nothing, so Vercel and CI, which build
// the library just before the demo, don't build it twice. Runs as the
// demo's predev/prebuild step.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lib = join(here, "../../../packages/stepwise");
const built = join(lib, "dist/index.js");

function newestMtime(path) {
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  let newest = 0;
  for (const name of readdirSync(path)) {
    if (name === "__tests__") continue;
    newest = Math.max(newest, newestMtime(join(path, name)));
  }
  return newest;
}

let reason = null;
if (!existsSync(built)) {
  reason = "no build yet";
} else {
  const inputs = ["src", "package.json", "tsup.config.ts"].map((p) => join(lib, p)).filter(existsSync);
  const newest = Math.max(...inputs.map(newestMtime));
  if (newest > statSync(built).mtimeMs) reason = "sources changed since the last build";
}

if (reason) {
  console.log(`[ensure-library] building @sphynxoid/stepwise (${reason})`);
  const r = spawnSync("npm", ["run", "build"], { cwd: lib, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.log("[ensure-library] @sphynxoid/stepwise build is up to date");
}
