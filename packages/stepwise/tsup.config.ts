import { defineConfig, type Options } from "tsup";

// esbuild is tsup's dependency, not ours: take its plugin type through tsup.
type Plugin = NonNullable<Options["esbuildPlugins"]>[number];

// Two builds share dist/:
//
// - client: one entry per public client subpath. The root barrel
//   (src/index.ts) must stay free of adapter imports so optional peers (gsap,
//   driver.js) are never pulled in by `import { … } from "@sphynxoid/stepwise"`;
//   adapters are separate entries behind the ./adapters/* export subpaths.
//   esbuild strips per-file "use client" directives while bundling, so they
//   come back as a banner: everything here is hooks or client components.
// - plain: ./core, the pure half, with NO banner so server components and
//   build scripts can call it.
//
// The hinge keeps exactly one copy of the pure code: client sources import it
// only through ./core, and this plugin turns that import into a runtime
// import of dist/core.js instead of bundling it again.

const coreHinge: Plugin = {
  name: "core-hinge",
  setup(build) {
    // Client bundles import the pure code at runtime instead of containing
    // it. Chunks and entries that may import core all sit in dist/ root.
    build.onResolve({ filter: /^\.\.?\/core$/ }, (args) =>
      args.importer ? { path: "./core.js", external: true } : undefined
    );
  },
};

const shared = {
  format: ["esm" as const],
  dts: true,
  external: ["react", "react-dom", "driver.js", "gsap"],
  // Both configs write into dist/, so neither may wipe it: `npm run clean`
  // runs once before tsup instead.
  clean: false,
  sourcemap: true,
  target: "es2020",
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      experimental: "src/experimental.ts",
      // In dist/ root like every client entry: the core hinge emits "./core.js".
      kit: "src/kit/index.ts",
      "adapters/gsap": "src/adapters/gsap.ts",
      "adapters/driver-js": "src/adapters/driver-js.ts",
      "adapters/scroll": "src/adapters/scroll.ts",
    },
    banner: { js: `"use client";` },
    esbuildPlugins: [coreHinge],
  },
  {
    ...shared,
    // kit/mdx shares the pure code with core: esm splitting puts it in
    // one chunk both import, so it still exists once in dist.
    entry: { core: "src/core.ts", "kit/mdx": "src/kit/mdx.tsx" },
    // kit/mdx imports the client entries by the package's name. Kept
    // external, that is a runtime import of the client bundles; resolved
    // (tsconfig paths would send it to src), it would bundle client code
    // into a file with no "use client".
    external: [...shared.external, /^@sphynxoid\/stepwise/],
  },
]);
