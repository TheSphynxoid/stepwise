import { defineConfig, devices } from "@playwright/test";

// Smoke tests against the production build (`npm run build` first).
// CI uses Playwright's bundled Chromium; on a machine with only Edge
// installed, run with PW_CHANNEL=msedge.
const PORT = Number(process.env.PW_PORT ?? 3123);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse: a stale server serves stale CSS and fakes failures.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
