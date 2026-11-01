// Records the short launch clips (for Reddit / HN / social posts) from a
// running demo (build + `next start` first). Outputs into ../../launch/clips,
// which is gitignored: these are post attachments, not repo media.
//   simulate-edit.gif     edit an input mid-run, the playhead keeps its step
//   simulate-predict.gif  predict mode: a checkpoint, a wrong and a right guess
//   live.gif              a stream playing in, scrub back, burst, Go live
//
//   node scripts/record-clips.mjs [baseUrl]    (default http://localhost:3141)
//   PW_CHANNEL=msedge picks the installed Edge instead of bundled Chromium.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { gifRecorder, recordClick } from "./record-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../launch/clips");
const base = process.argv[2] ?? "http://localhost:3141";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });

/** Dark page; reduced motion keeps autoplay parked so steps are deterministic. */
async function open(route, { reducedMotion = "reduce" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1400 }, colorScheme: "dark", reducedMotion });
  await page.addInitScript(() => localStorage.setItem("stepwise.demo.theme", "dark"));
  await page.goto(base + route);
  await page.waitForLoadState("networkidle");
  return page;
}

/** A fixed region from the demo's first card down `height` px (constant frame size). */
async function region(page, height) {
  // No scrolling (the viewport is tall enough), so the card's box is in page
  // coordinates too, which is what a screenshot clip expects.
  const box = await page.locator("main .rounded-xl").first().boundingBox();
  const clip = { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height };
  return () => page.screenshot({ clip, animations: "allow" });
}

async function step(page, rec, n, { hold = 420 } = {}) {
  const next = page.getByRole("button", { name: "Next step" });
  for (let i = 0; i < n; i++) {
    await next.dispatchEvent("click");
    await page.waitForTimeout(320);
    await rec.shot(hold);
  }
}

// ── simulate-edit.gif ─────────────────────────────────────────────────────────
{
  const page = await open("/simulate");
  const rec = gifRecorder(await region(page, 520), "simulate-edit");
  await rec.shot(1000);
  await step(page, rec, 7);
  const up = page.getByRole("button", { name: "Increase input 2" });
  for (let i = 0; i < 4; i++) await recordClick(page, rec, up, { before: 260, after: 520 });
  await rec.shot(900);
  await step(page, rec, 8);
  await rec.shot(1600);
  console.log(`simulate-edit.gif: ${rec.save(join(out, "simulate-edit.gif"))}`);
  await page.close();
}

// ── simulate-predict.gif ──────────────────────────────────────────────────────
{
  const page = await open("/simulate");
  const rec = gifRecorder(await region(page, 680), "simulate-predict");
  await rec.shot(800);
  await recordClick(page, rec, page.getByRole("switch", { name: /Predict mode/ }));
  await recordClick(page, rec, page.getByRole("button", { name: "Play", exact: true }), { after: 400 });
  const checkpoint = page.getByTestId("checkpoint");
  for (let i = 0; i < 20 && !(await checkpoint.isVisible()); i++) {
    await page.waitForTimeout(350);
    await rec.shot(350);
  }
  await rec.shot(1400);
  await recordClick(page, rec, checkpoint.getByRole("radio", { name: "No, keep" }));
  await recordClick(page, rec, checkpoint.getByRole("button", { name: "Check" }), { after: 1800 });
  await recordClick(page, rec, checkpoint.getByRole("radio", { name: "Yes, swap" }));
  await recordClick(page, rec, checkpoint.getByRole("button", { name: "Check" }), { after: 1600 });
  await recordClick(page, rec, checkpoint.getByRole("button", { name: "Continue" }), { after: 400 });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(350);
    await rec.shot(350);
  }
  console.log(`simulate-predict.gif: ${rec.save(join(out, "simulate-predict.gif"))}`);
  await page.close();
}

// ── live.gif (real time: the stream has its own clock) ────────────────────────
{
  const page = await open("/live", { reducedMotion: "no-preference" });
  const rec = gifRecorder(await region(page, 520), "live");
  const tick = async (ms) => {
    for (let t = 0; t < ms; t += 400) {
      await page.waitForTimeout(400);
      await rec.shot(400);
    }
  };
  await tick(4800);
  await recordClick(page, rec, page.getByRole("list", { name: "Event log" }).getByRole("button").nth(1), { after: 600 });
  await tick(1600);
  await recordClick(page, rec, page.getByRole("button", { name: /Burst/ }), { after: 600 });
  await tick(2000);
  await recordClick(page, rec, page.getByRole("button", { name: /Go live/ }), { after: 500 });
  await tick(3600);
  console.log(`live.gif: ${rec.save(join(out, "live.gif"))}`);
  await page.close();
}

await browser.close();
