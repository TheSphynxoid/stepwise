import { expect, test, type Page } from "@playwright/test";

// Smoke suite for the demo site. Besides "does it render", it guards the
// failure that cost the most debugging so far: Tailwind not generating CSS
// for the library's classes (wrong @source path), which leaves every
// library-rendered element unstyled while the host page looks fine.

const ROUTES = ["/", "/simulate", "/kit", "/llm", "/qa", "/live", "/automaton", "/adventure", "/player", "/compare", "/lesson", "/tour", "/discovery", "/glossary", "/scroll", "/minimal", "/docs", "/guide"];

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

test("simulate predict: stepping stops at a question; a miss reveals the answer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/simulate");
  await page.getByRole("switch", { name: /Predict mode/ }).click();
  // Default input 5, 2, …: the first comparison (frame 1) is a question, and Next stops there.
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next step" }).click();
  const checkpoint = page.getByTestId("checkpoint");
  await expect(checkpoint).toBeVisible();
  await expect(page.getByTestId("sim-label")).toHaveText("compare a[0]=5 with a[1]=2");

  // 5 vs 2 swaps: "keep" is a miss, and with no retries it settles and shows the answer.
  await checkpoint.getByRole("button", { name: "No, keep" }).click();
  await expect(checkpoint).toContainText("Not quite");
  await expect(checkpoint).toContainText("Answer: swap");
  await expect(page.getByTestId("sim-score")).toHaveText("0/1 right");
  await checkpoint.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("sim-label")).not.toHaveText("compare a[0]=5 with a[1]=2");
});

test("/kit: the first frame is in the server HTML", async ({ browser, baseURL }) => {
  // No JavaScript: whatever shows is the server-rendered HTML. (Client
  // components are server-rendered with or without `precomputed`; this
  // pins that the page's first frame is there.)
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    const res = await page.goto("/kit");
    expect(res?.ok()).toBe(true);
    const first = page.locator('[data-explainer="a"]');
    await expect(first.locator("p[aria-live]").first()).toHaveText("start: looking for 34 between lo=0 and hi=6");
    await expect(first.getByRole("img", { name: /^Array 3, 9, 14, 25, 34, 47, 61/ })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("/kit: two explainers keep separate links and keys", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kit");
  const a = page.locator('[data-explainer="a"]');
  const b = page.locator('[data-explainer="b"]');
  const narrationA = a.locator("p[aria-live]").first();
  const narrationB = b.locator("p[aria-live]").first();
  const sliderB = b.getByRole("slider", { name: "Frames" });

  // Stepping the second writes only its own key into the hash.
  await b.getByRole("button", { name: "Next step" }).click();
  await expect(narrationB).toHaveText("compare a[3]=25 with target 61");
  await expect(page).toHaveURL(/b\.frame=/);
  expect(page.url()).not.toContain("a.frame=");
  await expect(narrationA).toHaveText("start: looking for 34 between lo=0 and hi=6");

  // A click claims the keyboard: ArrowRight then moves the first, not the second.
  const bFrame = await sliderB.getAttribute("aria-valuenow");
  await narrationA.click();
  await page.keyboard.press("ArrowRight");
  await expect(narrationA).toHaveText("compare a[3]=25 with target 34");
  await expect(narrationB).toHaveText("compare a[3]=25 with target 61");
  await expect(sliderB).toHaveAttribute("aria-valuenow", bFrame!);
  await expect(page).toHaveURL(/a\.frame=/);
});

test("/kit: editing the target re-runs at once and shows on the start frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kit");
  const a = page.locator('[data-explainer="a"]');
  const narration = a.locator("p[aria-live]").first();
  const target = a.getByRole("spinbutton", { name: "Target" });
  await expect(narration).toHaveText("start: looking for 34 between lo=0 and hi=6");

  // The spinner arrows (ArrowUp here) change the value with no Enter and no
  // blur: the run must follow, and the paused start frame must show it.
  await target.click();
  await target.press("ArrowUp");
  await expect(narration).toHaveText("start: looking for 35 between lo=0 and hi=6");
  await expect(page).toHaveURL(/a\.in=3\.9\.14\.25\.34\.47\.61~35/);

  // Typing applies as soon as the draft is a valid value, and keeps the focus.
  await target.fill("9");
  await expect(narration).toHaveText("start: looking for 9 between lo=0 and hi=6");
  await expect(target).toBeFocused();

  // An empty or out-of-range draft changes nothing; leaving the field restores the value.
  await target.fill("");
  await expect(narration).toHaveText("start: looking for 9 between lo=0 and hi=6");
  await narration.click();
  await expect(target).toHaveValue("9");
});

test("/kit: predict loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kit");
  const b = page.locator('[data-explainer="b"]');
  const predictSwitch = b.getByRole("switch", { name: /Predict mode/ });
  // The `predict` prop starts it on; the reader can still turn it off.
  await expect(predictSwitch).toHaveAttribute("aria-checked", "true");
  await b.getByRole("button", { name: "Play", exact: true }).click();

  // Target 61 in 3 9 14 25 34 47 61: the first probe is a[3]=25, so the search goes right.
  const narration = b.locator("p[aria-live]").first();
  const question = b.getByRole("radiogroup", { name: "Your prediction" });
  await expect(question).toBeVisible({ timeout: 5000 });
  await expect(narration).toHaveText("compare a[3]=25 with target 61");
  await expect(b).toContainText("Will the search go left, right, or stop?");
  // A miss settles (no retries by default): the answer is revealed, then Continue moves on.
  await question.getByRole("radio", { name: "Left" }).click();
  await b.getByRole("button", { name: "Check" }).click();
  await expect(b).toContainText("Not quite");
  await expect(b.locator("[data-reveal]")).toContainText("Answer: Right");
  await expect(b.getByRole("button", { name: "Check" })).toHaveCount(0);
  await b.getByRole("button", { name: "Continue" }).click();
  await expect(narration).not.toHaveText("compare a[3]=25 with target 61");
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

test("/guide: the examples run, the code shown leaves out the site's theme wiring, the nav follows the scroll", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/guide");
  const live = page.getByTestId("guide-live");
  await expect(live.first()).toBeVisible();
  // The first player steps forward on Next.
  const first = live.first();
  await expect(first.getByText("Start: three numbers, out of order")).toBeVisible();
  // Frame 0 is on screen before playback, so one Next shows frame 1.
  await first.getByRole("button", { name: "Next step" }).click();
  await expect(first.getByText("Swap 3 and 1")).toBeVisible();
  // The source under it is the real file, minus the demo-only lines.
  const main = page.locator("main");
  await expect(main).toContainText("useTrace(frames)");
  await expect(main).not.toContainText("demo-only");
  await expect(main).not.toContainText("useSiteTheme");
  // The kit explainer's first frame comes from the server.
  await expect(page.locator("#kit")).toContainText("Start");
  // The table of contents is useChapters: scrolling to a section marks it.
  await page.locator("#mistakes").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  await expect(page.getByRole("navigation", { name: "Chapters" }).getByRole("button", { name: /Common mistakes/ })).toHaveAttribute("aria-current", "true");
});

test("/guide predict example: stepping stops at the question", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/guide");
  const ex = page.locator("#ask").getByTestId("guide-live").first();
  // Input 3, 1, 4, 2: frame 1 compares 3 and 1, and Next can't pass it unanswered.
  for (let i = 0; i < 3; i++) await ex.getByRole("button", { name: "Next step" }).click();
  await expect(ex.getByText("Compare 3 and 1")).toBeVisible();
  await ex.getByRole("button", { name: "keep" }).click();
  await expect(ex.getByRole("status")).toContainText("swap");
  await ex.getByRole("button", { name: "Continue" }).click();
  await expect(ex.getByText("Swapped")).toBeVisible();
});

test("adventure: a choice branches, going back and choosing again keeps the old path in history", async ({ page }) => {
  await page.goto("/adventure");
  const adv = page.getByTestId("adventure");
  const current = adv.getByTestId("adv-current");
  const next = adv.getByRole("button", { name: "Next", exact: true });
  const commands = adv.getByRole("group", { name: "Your command" });
  await next.click();
  await expect(commands).toBeVisible();
  // A question blocks Next until it's answered.
  await expect(next).toBeDisabled();
  await commands.getByRole("button", { name: "read the logbook" }).click();
  await expect(current).toContainText("Lens cracked");

  // Back to the question, another command: a new future, the old one kept.
  await adv.getByRole("button", { name: "Back", exact: true }).click();
  await commands.getByRole("button", { name: "climb the stairs" }).click();
  await expect(current).toContainText("lamp room");
  const history = page.getByTestId("adv-history");
  await expect(history).toContainText("read the logbook");

  // The typed command: any text, woven into the story.
  await next.click();
  await adv.getByRole("textbox", { name: "Your reply" }).fill("Gull Rock");
  await adv.getByRole("button", { name: "Say it" }).click();
  await expect(current).toContainText("Gull Rock");

  // To the end and Start over: every kept path is still listed.
  await next.click();
  await commands.getByRole("button", { name: "keep the beam steady" }).click();
  await expect(current).toContainText("Morning");
  await adv.getByRole("button", { name: "Start over" }).click();
  await expect(current).toContainText("Dusk");
  const kept = history.getByRole("listitem");
  await expect(kept.filter({ hasText: "read the logbook" })).toHaveCount(1);
  await expect(kept.filter({ hasText: "climb the stairs" })).toHaveCount(1);

  // An old path can be taken again; the one left is kept in its place.
  await kept.filter({ hasText: "read the logbook" }).getByRole("button", { name: /Take this path/ }).click();
  await next.click();
  await expect(commands.getByRole("button", { name: "read the logbook" })).toHaveAttribute("aria-pressed", "true");
  await next.click();
  await expect(current).toContainText("Lens cracked");
  await expect(history).toContainText("climb the stairs");
});

test("AI docs: /llms.txt indexes, /llms-full.txt carries the guide and the API reference", async ({ request }) => {
  const index = await request.get("/llms.txt");
  expect(index.ok()).toBe(true);
  expect(await index.text()).toContain("/llms-full.txt");
  const full = await (await request.get("/llms-full.txt")).text();
  expect(full).toContain("guide for AI assistants");
  expect(full).toContain("### useSimulation");
  expect(full).toContain("syncInput");
});

test("hero: clicking a bar mid-run re-runs the sort and keeps the player's step", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.locator(".sw-card-glow").first();
  const slider = card.getByRole("slider", { name: "Frames" });
  for (let i = 0; i < 6; i++) await card.getByRole("button", { name: "Next step" }).click();
  const frame = await slider.getAttribute("aria-valuenow");
  await card.getByRole("button", { name: /^Bar / }).nth(7).click();
  await expect(card.getByTestId("hero-status")).toContainText("re-ran from your edit");
  await expect(slider).toHaveAttribute("aria-valuenow", frame!);
});

test("automaton: the typed word is read to accept or reject, and an edit re-reads it", async ({ page }) => {
  await page.goto("/automaton#w=110");
  await expect(page.getByTestId("verdict")).toHaveText("accepted", { timeout: 10_000 }); // 6
  await page.getByLabel("Binary word").fill("111"); // 7
  await expect(page.getByTestId("verdict")).toHaveText("rejected", { timeout: 10_000 });
  await expect(page.getByTestId("run-label")).toHaveText("'1': r0 → r1");
});

test("automaton: a wrong pick takes a detour, a new answer cuts it off, links replay the walk", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Word "1", answer r0 (wrong: '1' in r0 leads to r1), linked on the question.
  await page.goto("/automaton#w=1&p=0&g=1");
  await expect(page.getByTestId("quiz-label")).toHaveText("Read '1' in r0: which state next?");
  await expect(page.getByTestId("quiz-score")).toHaveText("1 answered · 1 detour");
  const choices = page.getByTestId("quiz-choices");
  await expect(choices.getByRole("button", { name: /^r0/ })).toHaveAttribute("aria-pressed", "true");

  await choices.getByRole("button", { name: /^r1/ }).click();
  await expect(page.getByTestId("quiz-score")).toHaveText("1 answered · 0 detours");
  await expect(page.getByTestId("quiz-label")).toHaveText("'1' read: now in r1");
  await expect(page).toHaveURL(/p=1/);
});

// ── /llm: the kit at lesson scale ─────────────────────────────────────────

/** Turn predict mode off (if the explainer has it) and jump to the last frame. */
async function toEnd(page: Page, id: string) {
  const root = page.locator(`[data-explainer="${id}"]`);
  const toggle = root.getByRole("switch", { name: "Predict before each reveal" });
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-checked")) === "true") await toggle.click();
  const slider = root.getByRole("slider", { name: "Frames" });
  await slider.focus();
  await page.keyboard.press("End");
  return root;
}

test("/llm: the first tokenizer frame is in the server HTML", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    const res = await page.goto("/llm");
    expect(res?.ok()).toBe(true);
    await expect(page.locator('[data-explainer="tok"] p[aria-live]').first()).toHaveText('Split "the cats jumped" into tokens, reading left to right.');
  } finally {
    await context.close();
  }
});

test("/llm: typing re-tokenizes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/llm");
  const tok = page.locator('[data-explainer="tok"]');
  await tok.getByLabel("Text to tokenize").fill("dogs ran");
  await toEnd(page, "tok");
  await expect(tok.locator("p[aria-live]").first()).toContainText("3 tokens");
  await expect(tok.getByRole("img")).toHaveAttribute("aria-label", /: dog, s, ran$/);
  await expect(page).toHaveURL(/tok\.in=dogs_ran/);
});

test("/llm: closed-book and retrieval answers differ", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/llm");
  const closed = await toEnd(page, "closed");
  await expect(closed.getByTestId("rag-answer")).toContainText("seven");
  const rag = await toEnd(page, "rag");
  await expect(rag.getByTestId("rag-answer")).toContainText("five");
});

test("/llm: with predict on, answering and stepping reaches the RAG answer", async ({ page }) => {
  // Guards step data named like a prompt: only an object `prompt` is a question.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/llm");
  const rag = page.locator('[data-explainer="rag"]');
  await expect(rag.getByRole("switch", { name: "Predict before each reveal" })).toHaveAttribute("aria-checked", "true");
  const slider = rag.getByRole("slider", { name: "Frames" });
  const question = rag.getByRole("radiogroup", { name: "Your prediction" });
  let answered = 0;
  for (let i = 0; i < 10 && !(await rag.getByTestId("rag-answer").isVisible()); i++) {
    if (await question.isVisible()) {
      await question.getByRole("radio").first().click();
      await rag.getByRole("button", { name: "Check" }).click();
      const go = rag.getByRole("button", { name: "Continue" });
      if (await go.isVisible()) await go.click();
      answered++;
    } else {
      await slider.focus();
      await page.keyboard.press("End");
      await expect(question.or(rag.getByTestId("rag-answer"))).toBeVisible();
    }
  }
  expect(answered).toBeGreaterThan(0);
  await expect(rag.getByTestId("rag-answer")).toContainText("five");
});

test("/llm: nprobe 1 misses the tie question, 3 finds it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/llm");
  const idx = await toEnd(page, "idx");
  await expect(idx.getByTestId("index-verdict")).toHaveText("missed the true best");
  await idx.getByRole("group", { name: "nprobe" }).getByRole("button", { name: "3" }).click();
  await toEnd(page, "idx");
  await expect(idx.getByTestId("index-verdict")).toHaveText("found the true best");
});

// ── /qa: the QA engineer interview lesson ─────────────────────────────────

/** The intro tour starts on a first visit; tests that aren't about it start as returning readers. */
async function gotoQa(page: Page, hash = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("stepwise-qa", JSON.stringify(["qa-intro"])));
  await page.goto(`/qa${hash}`);
}

test("/qa: the intro tour shows once, and never over a deep link", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/qa#bnd.frame=2");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog", { name: /Guided tour/ })).toHaveCount(0);
  await page.goto("/qa");
  await expect(page.getByRole("dialog", { name: /Guided tour/ })).toBeVisible();
  await page.getByRole("button", { name: "End tour" }).click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog", { name: /Guided tour/ })).toHaveCount(0);
});

test("/qa: the first frame is in the server HTML", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    const res = await page.goto("/qa");
    expect(res?.ok()).toBe(true);
    await expect(page.locator('[data-explainer="think"] p[aria-live]').first()).toHaveText('"How would you test the booking form?"');
  } finally {
    await context.close();
  }
});

test("/qa: one probe per partition misses the bug, boundary probes catch it, links replay", async ({ page }) => {
  await gotoQa(page);
  const bnd = await toEnd(page, "bnd");
  await expect(bnd.getByTestId("bnd-verdict")).toContainText("not found");
  await bnd.getByRole("button", { name: "boundaries" }).click();
  await toEnd(page, "bnd");
  await expect(bnd.getByTestId("bnd-verdict")).toContainText("caught");
  await expect(page).toHaveURL(/bnd\.in=-1_0_11_12/);

  // A fresh load: a same-tab hash change re-reads the frame but not the input (see docs/KIT-FEEDBACK.md).
  await page.goto("about:blank");
  // With predict on, a link can't skip a question: it lands on the first unanswered one (probe 11).
  await gotoQa(page, "#bnd.in=11_12&bnd.frame=4");
  const linked = page.locator('[data-explainer="bnd"]');
  await expect(linked.locator("p[aria-live]").first()).toContainText("Age 11: the child partition");
  await expect(linked.getByRole("radiogroup", { name: "Your prediction" })).toBeVisible();
  // Predict off, the linked input plays through to the bug.
  await toEnd(page, "bnd");
  await expect(linked.locator("p[aria-live]").first()).toContainText("bug");
});

test("/qa: the weak suite lets mutants survive at 100% coverage, the strong suite kills them", async ({ page }) => {
  await gotoQa(page);
  const mut = await toEnd(page, "mut");
  await expect(mut.getByTestId("mut-coverage")).toContainText("100% lines");
  await expect(mut.getByTestId("mut-score")).toHaveText("1/7 killed");
  await mut.getByRole("group", { name: "Suite" }).getByRole("button", { name: "strong" }).click();
  await toEnd(page, "mut");
  await expect(mut.getByTestId("mut-score")).toHaveText("7/7 killed");
});

test("/qa: playing the tester, hold then refund finds the illegal transition; the path is linkable", async ({ page }) => {
  await gotoQa(page);
  const life = page.getByTestId("qa-life");
  const act = (name: string) => life.getByRole("group", { name: "Next action" }).getByRole("button", { name, exact: true }).click();
  await act("pay");
  await expect(life.getByTestId("qa-life-log")).toContainText("refused");
  await act("hold");
  await act("refund");
  await expect(life.getByTestId("qa-life-found")).toBeVisible();
  await expect(page).toHaveURL(/life\.path=/);
  const url = page.url();
  // A different answer at an earlier choice cuts off the future.
  await life.getByRole("slider", { name: "Frames" }).focus();
  await page.keyboard.press("Home");
  await act("cancel");
  await expect(life.getByTestId("qa-life-found")).toHaveCount(0);

  await page.goto("about:blank");
  await gotoQa(page, url.slice(url.indexOf("#")));
  await expect(page.getByTestId("qa-life").getByTestId("qa-life-found")).toBeVisible();
});

test("/qa: one player drives the pyramid's three levels; each catches the bug at its own cost", async ({ page }) => {
  await gotoQa(page);
  const pyr = page.getByTestId("qa-pyramid");
  await pyr.getByRole("slider", { name: "Frames" }).focus();
  await page.keyboard.press("End");
  for (const level of ["unit", "api", "ui"]) await expect(pyr.getByTestId(`pyr-${level}`)).toContainText("FAIL");
  await expect(pyr.getByTestId("pyr-ui")).toContainText("2410 ms");
});

test("/qa: the shipped API fails three checks, the spec API none", async ({ page }) => {
  await gotoQa(page);
  const api = await toEnd(page, "api");
  await expect(api.getByTestId("api-summary")).toHaveText("3/6 pass");
  await api.getByRole("group", { name: "API" }).getByRole("button", { name: "spec" }).click();
  await toEnd(page, "api");
  await expect(api.getByTestId("api-summary")).toHaveText("6/6 pass");
});

test("/qa: a fixed sleep is flaky, an explicit wait with a stable selector is not", async ({ page }) => {
  await gotoQa(page);
  const fl = await toEnd(page, "flaky");
  await expect(fl.getByTestId("flaky-rate")).not.toHaveText("100% pass");
  await fl.getByRole("group", { name: "Wait" }).getByRole("button", { name: "wait" }).click();
  await fl.getByRole("group", { name: "Selector" }).getByRole("button", { name: "stable" }).click();
  await toEnd(page, "flaky");
  await expect(fl.getByTestId("flaky-rate")).toHaveText("100% pass");
  await expect(page).toHaveURL(/flaky\.in=wait_stable_12_7/);
});

test("/qa: the CI feed streams builds live; bisect finds the bad commit", async ({ page }) => {
  // Motion on: following the live edge is autoplay, which reduced motion pauses.
  await page.addInitScript(() => localStorage.setItem("stepwise-qa", JSON.stringify(["qa-intro"])));
  await page.goto("/qa");
  const ci = page.getByTestId("qa-ci");
  await expect(ci.getByRole("status")).toHaveText("Live");
  const first = await ci.getByTestId("ci-count").textContent();
  await expect(ci.getByTestId("ci-count")).not.toHaveText(first!, { timeout: 5000 });
  const bis = await toEnd(page, "bisect");
  await expect(bis.locator("p[aria-live]").first()).toContainText("simplify age checks");
});

test("/qa: shrinking the crash payload leaves qty and code", async ({ page }) => {
  await gotoQa(page);
  const sh = await toEnd(page, "shrink");
  await expect(sh.getByTestId("shrink-kept")).toHaveText("qty, code");
});

test("/qa: the drill reveals answers and remembers what you know across reloads", async ({ page }) => {
  await gotoQa(page);
  const drill = page.getByTestId("qa-drill");
  await expect(drill.getByTestId("drill-progress")).toHaveText(/^0\//);
  await drill.getByRole("button", { name: "Show answer" }).click();
  await expect(drill.getByTestId("drill-answer")).toBeVisible();
  await drill.getByRole("button", { name: "I knew it" }).click();
  await expect(drill.getByTestId("drill-progress")).toHaveText(/^1\//);
  await page.reload();
  await expect(page.getByTestId("qa-drill").getByTestId("drill-progress")).toHaveText(/^1\//);
  await page.getByTestId("qa-drill").getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("qa-drill").getByTestId("drill-progress")).toHaveText(/^0\//);
});
