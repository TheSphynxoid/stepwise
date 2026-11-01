// Shared by record-media.mjs (README media) and record-clips.mjs (launch
// clips): a GIF recorder over Playwright screenshots, and a click marker,
// since a GIF has no mouse pointer.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Frames from screenshots of `target`: a locator, or a function returning a
 * Playwright screenshot buffer (for clipped regions).
 */
export function gifRecorder(target, name = "clip") {
  const gif = GIFEncoder();
  let frames = 0;
  // DUMP_FRAMES=<dir> also writes every frame as a PNG, to review a GIF
  // frame by frame.
  const dump = process.env.DUMP_FRAMES;
  if (dump) mkdirSync(dump, { recursive: true });
  return {
    async shot(delay) {
      const buf = typeof target === "function" ? await target() : await target.screenshot({ animations: "allow" });
      if (dump) writeFileSync(join(dump, `${name}-${String(frames).padStart(3, "0")}.png`), buf);
      const png = PNG.sync.read(buf);
      const palette = quantize(png.data, 128);
      gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
      frames++;
    },
    save(path) {
      gif.finish();
      writeFileSync(path, gif.bytes());
      return `${frames} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`;
    },
  };
}

/** A click marker over an element (at `yFraction` of its height). */
export async function showClick(page, locator, yFraction = 0.5) {
  const box = await locator.boundingBox();
  await page.evaluate(({ x, y }) => {
    const d = document.createElement("div");
    d.id = "sw-record-click";
    Object.assign(d.style, {
      position: "fixed", left: `${x - 13}px`, top: `${y - 13}px`, width: "26px", height: "26px",
      borderRadius: "50%", border: "2px solid rgba(255,255,255,.9)", background: "rgba(106,162,255,.45)",
      boxShadow: "0 0 0 6px rgba(106,162,255,.18)", zIndex: "9999", pointerEvents: "none",
    });
    document.body.appendChild(d);
  }, { x: box.x + box.width / 2, y: box.y + box.height * yFraction });
}

export const hideClick = (page) => page.evaluate(() => document.getElementById("sw-record-click")?.remove());

/** Marker on, shot, click, settle, shot, marker off. */
export async function recordClick(page, rec, locator, { yFraction = 0.5, settle = 260, before = 350, after = 700 } = {}) {
  await showClick(page, locator, yFraction);
  await rec.shot(before);
  await locator.dispatchEvent("click");
  await page.waitForTimeout(settle);
  await rec.shot(after);
  await hideClick(page);
}
