import { defineConfig } from "tsup";

// One entry per public subpath. The root barrel (src/index.ts) must stay free
// of adapter imports so optional peers (gsap, driver.js) are never pulled in
// by `import { … } from "@sphynxoid/stepwise"` — adapters are separate chunks
// behind the ./adapters/* export subpaths.
export default defineConfig({
  entry: ["src/index.ts", "src/adapters/gsap.ts", "src/adapters/driver-js.ts", "src/adapters/scroll.ts"],
  format: ["esm"],
  dts: true,
  external: ["react", "react-dom", "driver.js", "gsap"],
  clean: true,
  sourcemap: true,
  target: "es2020",
  // esbuild strips per-file "use client" directives while bundling; restore
  // them as a banner so React Server Components can import the package.
  // Everything exported here is hooks or client components — the whole
  // package is a client module.
  banner: { js: `"use client";` },
});
