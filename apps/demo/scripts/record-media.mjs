// Records the README / social media from a running demo (build + `next start`
// first). Outputs into ../../docs/assets:
//   hero.gif     - the landing hero's quicksort player, one full run, with
//                  two bars edited mid-run (the sort re-runs, keeps its step)
//   social.png   - 1280x640 GitHub social preview (Settings → Social preview)
//   og.png       - 1200x630 OpenGraph card, also copied to app/opengraph-image.png
//
//   node scripts/record-media.mjs [baseUrl]    (default http://localhost:3141)
//   PW_CHANNEL=msedge picks the installed Edge instead of bundled Chromium.

import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { gifRecorder, recordClick } from "./record-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../docs/assets");
const base = process.argv[2] ?? "http://localhost:3141";

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });

async function open(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("stepwise.demo.theme", "dark"));
  await page.goto(base + "/");
  await page.waitForLoadState("networkidle");
  return page;
}

// ── hero.gif ────────────────────────────────────────────────────────────────
// Deterministic: reduced motion parks autoPlay on frame 1, then we step with
// the PlayerBar's own Next button and grab a few shots across each 300ms
// bar transition. dispatchEvent avoids hover/focus rings in the capture.
// Partway through, two bars are clicked (the hero's point: edit the input
// while it plays): a marker shows where, the bar jumps, the sort re-runs and
// the player keeps its step.
const EDIT_AT = 9; // step after which the bars are edited
const EDIT_BARS = [7, 2]; // positions of the clicked bars

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("stepwise.demo.theme", "dark"));
  await page.goto(base + "/");
  await page.waitForLoadState("networkidle");
  const card = page.locator(".sw-card-glow").first();
  const slider = card.getByRole("slider", { name: "Frames" });
  const next = card.getByRole("button", { name: "Next step" });
  const bars = card.getByRole("button", { name: /^Bar / });
  const total = async () => Number(await slider.getAttribute("aria-valuemax"));
  const at = async () => Number(await slider.getAttribute("aria-valuenow"));

  const rec = gifRecorder(card, "hero");
  await rec.shot(900);
  let step = 1;
  while ((await at()) < (await total())) {
    await next.dispatchEvent("click");
    await page.waitForTimeout(110);
    await rec.shot(110);
    await page.waitForTimeout(250);
    const last = (await at()) >= (await total());
    await rec.shot(last ? 2500 : 420);
    if (step++ === EDIT_AT) {
      for (const pos of EDIT_BARS) await recordClick(page, rec, bars.nth(pos), { yFraction: 0.6 });
      await rec.shot(900);
    }
  }
  console.log(`hero.gif: ${step - 1} steps, ${rec.save(join(out, "hero.gif"))}`);
  await page.close();
}

// ── social.png / og.png: the landing's first screen ─────────────────────────
for (const [name, viewport] of [
  ["social.png", { width: 1280, height: 640 }],
  ["og.png", { width: 1200, height: 630 }],
]) {
  const page = await open(viewport);
  // Let the hero play a few frames so the bars show a mid-sort state.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(out, name) });
  console.log(name);
  await page.close();
}
copyFileSync(join(out, "og.png"), join(here, "../app/opengraph-image.png"));

await browser.close();
