// Records the README / social media from a running demo (build + `next start`
// first). Outputs into ../../docs/assets:
//   hero.gif     - the landing hero's quicksort player, one full run
//   social.png   - 1280x640 GitHub social preview (Settings → Social preview)
//   og.png       - 1200x630 OpenGraph card, also copied to app/opengraph-image.png
//
//   node scripts/record-media.mjs [baseUrl]    (default http://localhost:3141)
//   PW_CHANNEL=msedge picks the installed Edge instead of bundled Chromium.

import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;

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
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("stepwise.demo.theme", "dark"));
  await page.goto(base + "/");
  await page.waitForLoadState("networkidle");
  const card = page.locator(".sw-card-glow").first();
  const slider = card.getByRole("slider", { name: "Frames" });
  const next = card.getByRole("button", { name: "Next step" });
  const total = Number(await slider.getAttribute("aria-valuemax"));

  const gif = GIFEncoder();
  let frames = 0;
  const shot = async (delay) => {
    const png = PNG.sync.read(await card.screenshot({ animations: "allow" }));
    const palette = quantize(png.data, 128);
    gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
    frames++;
  };
  await shot(900);
  for (let i = 1; i < total; i++) {
    await next.dispatchEvent("click");
    await page.waitForTimeout(110);
    await shot(110);
    await page.waitForTimeout(250);
    await shot(i === total - 1 ? 2500 : 420);
  }
  gif.finish();
  writeFileSync(join(out, "hero.gif"), gif.bytes());
  console.log(`hero.gif: ${frames} frames over ${total} steps, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
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
