// Touch gestures on a phone: press and hold for a menu, pull a sheet down to
// close it, flick the mini player up, swipe the schedule's days, pull down
// to refresh. Each has a button too; these check the gestures themselves.
import { test, expect } from "./fixtures.mjs";

test.skip(({ isMobile }) => !isMobile, "touch only");

// A touch along `points` ([x, y] pairs) on the element `selector` finds,
// `holdMs` after it lands before it moves, and `stepMs` between moves.
const touch = (page, selector, points, { holdMs = 0, stepMs = 16 } = {}) =>
  page.evaluate(
    async ({ selector, points, holdMs, stepMs }) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.checkVisibility());
      const at = ([x, y]) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const send = (type, p) =>
        el.dispatchEvent(
          new TouchEvent(type, {
            touches: type === "touchend" ? [] : [at(p)],
            changedTouches: [at(p)],
            bubbles: true,
            cancelable: true,
          }),
        );
      send("touchstart", points[0]);
      await wait(holdMs);
      for (const p of points.slice(1)) {
        await wait(stepMs);
        send("touchmove", p);
      }
      send("touchend", points[points.length - 1]);
    },
    { selector, points, holdMs, stepMs },
  );

test("press and hold a show in the schedule for its menu", async ({ page }) => {
  await page.goto("/#/shows");
  await touch(page, ".schedule-row", [[200, 400]], { holdMs: 600 });
  const menu = page.locator(".hold-menu");
  await expect(menu).toBeVisible();
  // The lift that ended the hold didn't also open the show.
  await expect(
    page.getByRole("dialog", { name: /./ }).filter({ hasText: "Hosted by" }),
  ).toHaveCount(0);
  await menu.getByRole("button", { name: "Follow show" }).click();
  await expect(menu).toBeHidden();
  // A tap still opens the show, as before.
  await page.locator(".schedule-row").first().click();
  await expect(page.locator(".detail-dialog")).toBeVisible();
});

test("a show's sheet closes when pulled down, and stays for a nudge", async ({ page }) => {
  await page.goto("/#/shows/show/worldcafe");
  const sheet = page.getByRole("dialog", { name: "World Cafe" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  const down = (by) =>
    touch(
      page,
      ".detail-dialog .dialog-header",
      Array.from({ length: 8 }, (_, i) => [200, 300 + (by * i) / 7]),
      { stepMs: 40 },
    );
  await down(30);
  await page.waitForTimeout(500);
  await expect(sheet).toBeVisible();
  await down(320);
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/shows$/);
});

test("a flick up on the mini player opens Listen", async ({ page }) => {
  await page.goto("/#/shows");
  await touch(page, ".player-bar", [
    [200, 760],
    [200, 740],
    [200, 700],
  ]);
  await expect(page).toHaveURL(/#\/listen$/);
});

test("a swipe across the schedule turns the day", async ({ page }) => {
  await page.goto("/#/shows");
  const days = page.getByRole("group", { name: "Schedule day" });
  const pressed = () => days.locator('[aria-pressed="true"]').getAttribute("aria-label");
  // Start on Monday, so there is a day either side to go to.
  await days.getByRole("button", { name: /^Tuesday/ }).click();
  await touch(page, ".schedule-row", [
    [300, 400],
    [120, 400],
  ]);
  expect(await pressed()).toMatch(/^Wednesday/);
  await touch(page, ".schedule-row", [
    [120, 400],
    [300, 400],
  ]);
  expect(await pressed()).toMatch(/^Tuesday/);
  // Before Monday, the swipe goes on to the tab before: All shows.
  await days.getByRole("button", { name: /^Monday/ }).click();
  await touch(page, ".schedule-row", [
    [120, 400],
    [300, 400],
  ]);
  await expect(
    page.getByLabel("Browse shows").getByRole("button", { name: "All shows" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("pulling down at the top of Listen reads the songs again", async ({ page }) => {
  await page.goto("/#/listen");
  await expect(page.locator(".recent-panel")).toBeVisible();
  let reads = 0;
  page.on("request", (r) => {
    if (/playlist\/json|nowplaying\//.test(r.url())) reads++;
  });
  await touch(
    page,
    'section[aria-label="Listen live"] .listen-heading',
    Array.from({ length: 10 }, (_, i) => [200, 150 + i * 22]),
  );
  const spinner = page.locator('section[aria-label="Listen live"] .pull-refresh');
  await expect(spinner).toHaveAttribute("data-state", "loading");
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(spinner).not.toHaveAttribute("data-state", /./);
});
