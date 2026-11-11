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

const PURE = ["simulation", "walk", "graph", "reanchor", "create-trace", "diff-traces", "evaluate", "flatten", "align-tracks", "explainer"];

const USE_CLIENT = /^\s*["']use client["']/;
const RUNTIME_REACT = /^import (?!type)[^;]*from ["']react["']/m;
const RELATIVE_IMPORT = /(?:import|export)[^;]*?from\s*["'](\.{1,2}\/[^"']+)["']/g;

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

  it("client modules reach pure code only through ./core", () => {
    const clientFiles = walkFiles(
      SRC,
      (f) => /\.tsx?$/.test(f) && !f.includes("__tests__") && USE_CLIENT.test(readFileSync(f, "utf8"))
    );
    expect(clientFiles.length).toBeGreaterThan(0);
    // Compared by resolved file, not by specifier: src/kit/explainer.tsx is a
    // client module that merely shares a name with the pure src/explainer.ts.
    const pureFiles = new Set(PURE.map((name) => resolveSource(join(SRC, "core.ts"), `./${name}`)));
    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(RELATIVE_IMPORT)) {
        const target = resolveSource(file, m[1]);
        expect(target && pureFiles.has(target), `${file} imports ${m[1]} directly`).toBeFalsy();
      }
    }
  });

  it.skipIf(!existsSync(join(DIST, "core.js")))("dist holds one copy of the pure code", () => {
    expect(USE_CLIENT.test(readFileSync(join(DIST, "core.js"), "utf8"))).toBe(false);
    const holders = walkFiles(DIST, (f) => f.endsWith(".js")).filter((f) =>
      readFileSync(f, "utf8").includes("function runSimulation(")
    );
    expect(holders).toHaveLength(1);
    expect(USE_CLIENT.test(readFileSync(holders[0], "utf8"))).toBe(false);
  });
});
