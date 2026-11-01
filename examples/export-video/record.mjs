// Export a stepwise explainer as a GIF (and optionally PNG frames for an MP4).
//
//   node record.mjs <url> [options]
//
//   --selector <css>   element to capture (default: walk up from the Next
//                      button to the first box at least 240px tall, usually
//                      the whole demo column; pass a selector for a tight crop)
//   --out <file>       GIF path (default: explainer.gif)
//   --frames <dir>     also write every captured frame as a PNG
//   --hold <ms>        how long each step stays on screen (default: 700)
//   --tween <ms>       wait after Next for CSS transitions; also captures one
//                      in-between frame halfway (default: 300, 0 = no tween)
//   --width / --height viewport (default: 1280 x 900)
//   --dark             prefers-color-scheme: dark
//   --next <label>     accessible name of the Next button (default: "Next step")
//   --scrubber <label> accessible name of the scrubber (default: "Frames")
//
// How it stays deterministic: the page loads with reduced motion, so a
// stepwise player never autoplays. The script then walks the steps itself
// with the PlayerBar's Next button, reading progress off the scrubber's
// aria-valuenow / aria-valuemax. Simulations are pure and seeded, so the same
// URL (including a #in=…&frame=… link) records the same clip every time.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    selector: { type: "string" },
    out: { type: "string", default: "explainer.gif" },
    frames: { type: "string" },
    hold: { type: "string", default: "700" },
    tween: { type: "string", default: "300" },
    width: { type: "string", default: "1280" },
    height: { type: "string", default: "900" },
    dark: { type: "boolean", default: false },
    next: { type: "string", default: "Next step" },
    scrubber: { type: "string", default: "Frames" },
  },
});
const url = positionals[0];
if (!url) {
  console.error("usage: node record.mjs <url> [--selector css] [--out file.gif] [--frames dir]");
  process.exit(1);
}
const hold = Number(opt.hold);
const tween = Number(opt.tween);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
const page = await browser.newPage({
  viewport: { width: Number(opt.width), height: Number(opt.height) },
  colorScheme: opt.dark ? "dark" : "light",
  reducedMotion: "reduce",
});
await page.goto(url);
await page.waitForLoadState("networkidle");

for (const [role, name, flag] of [["button", opt.next, "--next"], ["slider", opt.scrubber, "--scrubber"]]) {
  if ((await page.getByRole(role, { name, exact: true }).count()) === 0) {
    console.error(`No ${role} named "${name}" on the page. Custom PlayerBar labels? Pass ${flag} "<its aria-label>".`);
    process.exit(1);
  }
}
if (!opt.selector) {
  // Mark the player's card: the PlayerBar sits inside the visual it drives.
  const found = await page.getByRole("button", { name: opt.next, exact: true }).first().evaluate((el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.getBoundingClientRect().height >= 240) return n.setAttribute("data-record-target", ""), true;
    }
    return false;
  });
  if (!found) throw new Error("No player card found; pass --selector");
}
const target = page.locator(opt.selector ?? "[data-record-target]").first();
await target.scrollIntoViewIfNeeded();
// The controls are found on the whole page, so the capture can be just the
// visual (the PlayerBar is often its sibling, not its child).
const next = page.getByRole("button", { name: opt.next, exact: true }).first();
const scrubber = page.getByRole("slider", { name: opt.scrubber }).first();
const at = async () => Number(await scrubber.getAttribute("aria-valuenow"));
const total = async () => Number(await scrubber.getAttribute("aria-valuemax"));

// Every shot is cropped to the size of the first one, so a card that grows
// or shrinks by a pixel doesn't break the GIF.
const gif = GIFEncoder();
if (opt.frames) mkdirSync(opt.frames, { recursive: true });
let size = null;
let count = 0;
async function shot(delay) {
  const box = await target.boundingBox();
  size ??= { width: Math.round(box.width), height: Math.round(box.height) };
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, ...size }, animations: "allow" });
  if (opt.frames) writeFileSync(join(opt.frames, `${String(count).padStart(4, "0")}.png`), buf);
  const png = PNG.sync.read(buf);
  const palette = quantize(png.data, 256);
  gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
  count++;
}

// A player that hasn't started shows frame 0 of its trace; Next starts it.
await shot(hold);
const last = await total();
while ((await at()) < last) {
  await next.dispatchEvent("click"); // no hover or focus ring in the capture
  if (tween > 0) {
    await page.waitForTimeout(tween / 2);
    await shot(tween / 2);
    await page.waitForTimeout(tween / 2);
  }
  await shot((await at()) >= last ? hold * 3 : hold);
}

gif.finish();
writeFileSync(opt.out, gif.bytes());
console.log(`${opt.out}: ${last} steps, ${count} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
await browser.close();
