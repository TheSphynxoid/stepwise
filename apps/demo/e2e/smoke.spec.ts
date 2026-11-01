import { expect, test, type Page } from "@playwright/test";

// Smoke suite for the demo site. Besides "does it render", it guards the
// failure that cost the most debugging so far: Tailwind not generating CSS
// for the library's classes (wrong @source path), which leaves every
// library-rendered element unstyled while the host page looks fine.

const ROUTES = ["/", "/simulate", "/live", "/player", "/compare", "/lesson", "/tour", "/discovery", "/glossary", "/scroll", "/minimal", "/docs"];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

for (const route of ROUTES) {
  test(`${route} loads without console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(route);
    expect(res?.ok()).toBe(true);
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("/eviction redirects to /player", async ({ page }) => {
  await page.goto("/eviction");
  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByRole("heading", { name: "Watch the algorithm swap" })).toBeVisible();
});

test("library classes are styled: the tour card is a fixed, centered card", async ({ page }) => {
  await page.goto("/tour");
  await page.getByRole("button", { name: "Start tour" }).click();
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  const box = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { position: getComputedStyle(el).position, center: r.left + r.width / 2, bottom: r.bottom, width: r.width };
  });
  const vp = page.viewportSize()!;
  // `fixed` alone proves little - Tailwind also matches the bare word in
  // demo prose. Placement needs the library-only utilities: bottom-6,
  // left-1/2 + -translate-x-1/2 and w-[min(92vw,26rem)].
  expect(box.position).toBe("fixed");
  expect(Math.abs(box.center - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.bottom - (vp.height - 24))).toBeLessThan(2);
  expect(Math.round(box.width)).toBe(Math.round(Math.min(vp.width * 0.92, 416)));
});

test("player advances on its own and by keyboard", async ({ page }) => {
  await page.goto("/player");
  const scrubber = page.getByRole("slider", { name: "Frames" });
  await expect(scrubber).toBeVisible();
  // autoPlay: the frame moves without input.
  await expect.poll(async () => Number(await scrubber.getAttribute("aria-valuenow")), { timeout: 5000 }).toBeGreaterThan(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  // Reduced motion: autoPlay lands on frame 1 and stays paused...
  await expect(scrubber).toHaveAttribute("aria-valuenow", "1");
  // ...until the user steps.
  await page.keyboard.press("ArrowRight");
  await expect(scrubber).toHaveAttribute("aria-valuenow", "2");
});

test("tour opens, spotlights and advances", async ({ page }) => {
  await page.goto("/tour");
  await page.getByRole("button", { name: "Start tour" }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByText("Create a repository")).toBeVisible();
  await card.getByRole("button", { name: "Next" }).click();
  await expect(card.getByText("Stage your changes")).toBeVisible();
  await card.getByRole("button", { name: "End tour" }).click();
  await expect(card).toBeHidden();
});

test("glossary tooltip opens via keyboard", async ({ page }) => {
  await page.goto("/glossary");
  const term = page.locator("[aria-expanded]").first();
  await term.focus();
  await page.keyboard.press("Enter");
  const tip = page.getByRole("tooltip").first();
  await expect(tip).toBeVisible();
  expect(await tip.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
  await page.keyboard.press("Escape");
  await expect(term).toHaveAttribute("aria-expanded", "false");
});

test("lesson composes: scrolling seeks the player, the tour drives the cursor readout", async ({ page }) => {
  await page.goto("/lesson");
  const frame = page.locator('[data-cursor="frame"]');
  const tourCursor = page.locator('[data-cursor="tour"]');
  await expect(frame).toHaveText(/^1\/\d+$/);

  // Scroll to the last chapter: the paused player seeks to the final frame.
  await page.locator("#path").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.getElementById("path")!;
    window.scrollBy(0, el.getBoundingClientRect().top - window.innerHeight / 3);
  });
  await expect.poll(async () => {
    const [cur, total] = (await frame.innerText()).split("/").map(Number);
    return cur === total;
  }).toBe(true);

  await expect(tourCursor).toHaveText("-");
  await page.getByRole("button", { name: /Take the \d+-step tour/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(tourCursor).toHaveText(/^1\/\d+$/);
});

test("compare: one player drives both tracks; alignment changes the timeline", async ({ page }) => {
  await page.goto("/compare");
  const scrubber = page.getByRole("slider", { name: "Frames" });
  await expect(scrubber).toBeVisible();
  const holdTotal = Number(await scrubber.getAttribute("aria-valuemax"));
  await expect.poll(async () => Number(await scrubber.getAttribute("aria-valuenow")), { timeout: 5000 }).toBeGreaterThan(1);

  await page.getByRole("radio", { name: "Align by pass" }).click();
  await expect(page.getByRole("radio", { name: "Align by pass" })).toHaveAttribute("aria-checked", "true");
  // Waiting at sync points can only lengthen the timeline, never shorten it.
  await expect.poll(async () => Number(await scrubber.getAttribute("aria-valuemax"))).toBeGreaterThanOrEqual(holdTotal);
});

test("simulate: a shared link replays the exact frame, and edits keep the playhead on the same step", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/simulate#frame=16&in=6.12.8.1.9.3.6");
  const key = page.getByTestId("sim-key");
  await expect(key).toContainText("key c4.4");
  await expect(page.getByTestId("sim-label")).toHaveText("compare a[3]=12 with a[4]=9");

  // Lower the second input a lot: the trace changes length, the step stays.
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Decrease input 2" }).click();
  await expect(page.getByTestId("sim-input").nth(1)).toHaveText("4");
  await expect(key).toContainText("key c4.4");
  await expect(page).toHaveURL(/in=6.4.8.1.9.3.6/);
});

test("simulate: predict mode holds at a checkpoint and grades the guess", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/simulate");
  await page.getByRole("switch", { name: /Predict mode/ }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const checkpoint = page.getByTestId("checkpoint");
  await expect(checkpoint).toBeVisible({ timeout: 5000 });
  // Default input 5, 2, …: the first comparison is 5 vs 2, which swaps.
  await expect(page.getByTestId("sim-label")).toHaveText("compare a[0]=5 with a[1]=2");
  await checkpoint.getByRole("radio", { name: "No, keep" }).click();
  await checkpoint.getByRole("button", { name: "Check" }).click();
  await expect(checkpoint).toContainText("Not quite");
  await checkpoint.getByRole("radio", { name: "Yes, swap" }).click();
  await checkpoint.getByRole("button", { name: "Check" }).click();
  await expect(checkpoint).toContainText("Right");
  await checkpoint.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("sim-label")).not.toHaveText("compare a[0]=5 with a[1]=2");
});

test("live: follows the edge, a reader who scrubs back stays put, Go live returns", async ({ page }) => {
  await page.goto("/live");
  const bar = page.locator("[data-stepwise]").filter({ has: page.getByRole("slider") }).last();
  await expect(bar.getByRole("status")).toHaveText("Live");
  // Events keep arriving and playing in.
  await expect(page.getByTestId("live-count")).not.toHaveText(/^1\//, { timeout: 5000 });

  await page.getByRole("list", { name: "Event log" }).getByRole("button").first().click();
  await expect(page.getByTestId("live-label")).toHaveText("fetch sources");
  await page.getByRole("button", { name: /Burst/ }).click();
  const goLive = bar.getByRole("button", { name: /Go live/ });
  await expect(goLive).toBeVisible();
  await expect(page.getByTestId("live-label")).toHaveText("fetch sources");

  await goLive.click();
  await expect(bar.getByRole("status")).toHaveText("Live");
  await expect(page.getByTestId("live-label")).not.toHaveText("fetch sources");
});
