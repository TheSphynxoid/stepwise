import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  external: ["react", "react-dom", "driver.js", "gsap"],
  clean: true,
  sourcemap: true,
  target: "es2020",
});
