import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // src/kit/server.tsx imports the client entries by the package's own name
    // (so the build keeps them external); tests resolve that name to src.
    // Exact matches: "./kit" must not swallow "./kit/server".
    alias: [
      { find: /^@sphynxoid\/stepwise$/, replacement: src("index.ts") },
      { find: /^@sphynxoid\/stepwise\/kit$/, replacement: src("kit/index.ts") },
    ],
  },
  test: {
    environment: "jsdom",
  },
});
