// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The ./core entry is the one copy of the pure code: server components and
// build scripts import it, and the client bundles import it at runtime. These
// checks keep that boundary from eroding one innocent import at a time.

const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const USE_CLIENT = /^\s*["']use client["']/;
const RUNTIME_REACT = /^import (?!type)[^;]*from ["']react["']/m;
const RELATIVE_IMPORT = /(?:import|export)[^;]*?from\s*["'](\.{1,2}\/[^"']+)["']/g;
// One relative import or re-export statement, from the start of its line;
// group 1 is set for `import type` / `export type`, which are erased at build
// time and so may name any module.
const RELATIVE_STATEMENT = /^(?:import|export)(\s+type\b)?[^;]*?from\s*["'](\.{1,2}\/[^"']+)["']/gm;
// Any way a built file can load React (react, react-dom, react/jsx-runtime):
// from, side-effect import, dynamic import, require.
const REACT_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'](?:react|react-dom)(?:\/[^"']*)?["']/;
const DIST_RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

function resolveSource(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Every source file reachable from `entry` through relative imports. */
function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(RELATIVE_IMPORT)) {
      const next = resolveSource(file, m[1]);
      if (next) queue.push(next);
    }
  }
  return [...seen];
}

function walkFiles(dir: string, keep: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkFiles(full, keep);
    return keep(full) ? [full] : [];
  });
}

describe("core boundary", () => {
  const coreFiles = () => importGraph(join(SRC, "core.ts"));

  it("core and everything it imports is free of 'use client' and runtime react imports", () => {
    const files = coreFiles();
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(USE_CLIENT.test(source), `${file} starts with "use client"`).toBe(false);
      expect(source.match(RUNTIME_REACT), `${file} imports react at runtime`).toBeNull();
    }
  });

  it("core's files declare no classes or unique symbols", () => {
    for (const file of coreFiles()) {
      const source = readFileSync(file, "utf8");
      expect(source.match(/\bclass\s+\w/), `${file} declares a class`).toBeNull();
      expect(source.match(/unique symbol/), `${file} declares a unique symbol`).toBeNull();
    }
  });

  it("client modules and the client barrels reach pure code only through ./core", () => {
    const clientFiles = walkFiles(
      SRC,
      (f) => /\.tsx?$/.test(f) && !f.includes("__tests__") && USE_CLIENT.test(readFileSync(f, "utf8"))
    );
    expect(clientFiles.length).toBeGreaterThan(0);
    // The barrels carry no directive but are bundled as client entries.
    const checked = [...clientFiles, join(SRC, "index.ts"), join(SRC, "experimental.ts")];
    // The pure set is core's own import graph, so a renamed or new pure
    // module is covered without a list to keep. Compared by resolved file,
    // not by specifier: src/kit/explainer.tsx is a client module that merely
    // shares a name with the pure src/explainer.ts.
    const core = join(SRC, "core.ts");
    const pureFiles = new Set(coreFiles().filter((f) => f !== core));
    expect(pureFiles.has(join(SRC, "simulation.ts"))).toBe(true);
    expect(pureFiles.has(join(SRC, "explainer.ts"))).toBe(true);
    for (const file of checked) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(RELATIVE_STATEMENT)) {
        if (m[1]) continue;
        const target = resolveSource(file, m[2]);
        expect(target && pureFiles.has(target), `${file} imports ${m[2]} directly`).toBeFalsy();
      }
    }
  });

  // kit/mdx is plain too, but it hands out client components: it must
  // reach them by the package's name (an external runtime import), never by a
  // relative path, which would bundle client code into a file with no
  // "use client". importGraph follows only relative imports, so a package-name
  // import correctly ends the walk.
  it("kit/mdx reaches client code only by the package's name", () => {
    const server = join(SRC, "kit", "mdx.tsx");
    const source = readFileSync(server, "utf8");
    expect(USE_CLIENT.test(source)).toBe(false);
    expect(source).toMatch(/from ["']@sphynxoid\/stepwise\/kit["']/);
    for (const file of importGraph(server)) {
      expect(USE_CLIENT.test(readFileSync(file, "utf8")), `${file} is a client module`).toBe(false);
    }
  });

  it.skipIf(!existsSync(join(DIST, "kit", "mdx.js")))("dist/kit/mdx.js imports the client entries", () => {
    const built = readFileSync(join(DIST, "kit", "mdx.js"), "utf8");
    expect(USE_CLIENT.test(built)).toBe(false);
    expect(built).toMatch(/from ["']@sphynxoid\/stepwise\/kit["']/);
    expect(built).toMatch(/from ["']@sphynxoid\/stepwise["']/);
    // No component source: the parts' hooks would show up if they were bundled.
    expect(built).not.toMatch(/useExplainer|data-stepwise/);
  });

  it.skipIf(!existsSync(join(DIST, "core.js")))("dist holds one copy of the pure code", () => {
    expect(USE_CLIENT.test(readFileSync(join(DIST, "core.js"), "utf8"))).toBe(false);
    const holders = walkFiles(DIST, (f) => f.endsWith(".js")).filter((f) =>
      readFileSync(f, "utf8").includes("function runSimulation(")
    );
    expect(holders).toHaveLength(1);
    expect(USE_CLIENT.test(readFileSync(holders[0], "utf8"))).toBe(false);
  });

  it.skipIf(!existsSync(join(DIST, "core.js")))("dist/core.js and every chunk it imports load no react", () => {
    const seen = new Set<string>();
    const queue = [join(DIST, "core.js")];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const built = readFileSync(file, "utf8");
      expect(built.match(REACT_IMPORT), `${file} imports react`).toBeNull();
      for (const m of built.matchAll(DIST_RELATIVE_IMPORT)) queue.push(resolve(dirname(file), m[1]));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
