import { expect, test, type Page } from "@playwright/test";

// Smoke suite for the demo site. Besides "does it render", it guards the
// failure that cost the most debugging so far: Tailwind not generating CSS
// for the library's classes (wrong @source path), which leaves every
// library-rendered element unstyled while the host page looks fine.

const ROUTES = ["/", "/player", "/lesson", "/tour", "/discovery", "/glossary", "/scroll", "/minimal", "/docs"];

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
