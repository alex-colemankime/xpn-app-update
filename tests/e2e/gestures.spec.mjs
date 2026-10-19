// Touch gestures on a phone: press and hold for a menu, pull a sheet down to
// close it, pull down to refresh. Each has a button too; these check the gestures themselves.
import { test, expect } from "./fixtures.mjs";

test.skip(({ isMobile }) => !isMobile, "touch only");

// A touch along `points` ([x, y] pairs) on the element `selector` finds,
// `holdMs` after it lands before it moves, `stepMs` between moves, and
// `restMs` held still after the last move before it lifts. `end` is how the
// touch ends: "touchend", or "touchcancel" when the system takes it away.
const touch = (
  page,
  selector,
  points,
  { holdMs = 0, stepMs = 16, restMs = 0, end = "touchend" } = {},
) =>
  page.evaluate(
    async ({ selector, points, holdMs, stepMs, restMs, end }) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.checkVisibility());
      const at = ([x, y]) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const send = (type, p) =>
        el.dispatchEvent(
          new TouchEvent(type, {
            touches: type === "touchend" || type === "touchcancel" ? [] : [at(p)],
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
      await wait(restMs);
      send(end, points[points.length - 1]);
    },
    { selector, points, holdMs, stepMs, restMs, end },
  );

test("press and hold a show in the schedule for its menu", async ({ page }) => {
  await page.goto("/#/shows");
  await touch(page, ".schedule-row", [[200, 400]], { holdMs: 600 });
  const menu = page.locator(".hold-menu");
  await expect(menu).toBeVisible();
  // The lift that ended the hold didn't also open the show.
  await expect(page.locator("dialog .show-detail-hero")).toHaveCount(0);
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

test("a sheet pulled down whose touch is cancelled settles back open", async ({ page }) => {
  await page.goto("/#/shows/show/worldcafe");
  const sheet = page.getByRole("dialog", { name: "World Cafe" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  await touch(
    page,
    ".detail-dialog .dialog-header",
    Array.from({ length: 8 }, (_, i) => [200, 300 + (320 * i) / 7]),
    { stepMs: 40, end: "touchcancel" },
  );
  await page.waitForTimeout(600);
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/#\/shows\/show\/worldcafe$/);
  // Back in place, not left hanging partway down.
  expect(await sheet.evaluate((el) => el.style.translate)).toBe("");
});

test("a sideways drag across the schedule leaves the day and the view alone", async ({ page }) => {
  // Days and views are chosen by their keys only: a swipe that decided when
  // the finger lifted never followed it, so it is gone.
  await page.goto("/#/shows");
  const days = page.getByRole("group", { name: "Schedule day" });
  // Monday is today in the tests' clock, so its key reads "Today, Monday".
  await days.getByRole("button", { name: /Monday/ }).click();
  await touch(page, ".schedule-row", [
    [120, 400],
    [300, 400],
  ]);
  await expect(days.getByRole("button", { name: /Monday/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByLabel("Browse shows").getByRole("button", { name: "Schedule" }),
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

test("a song's row opens its sheet, about the song and with no offer to connect", async ({
  page,
}) => {
  await page.goto("/");
  const row = page.locator(".recent-panel .track-open").first();
  await row.click();
  const sheet = page.locator(".hold-menu");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Save to Favorites" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Open in Spotify" })).toHaveAttribute(
    "href",
    /^https:\/\/open\.spotify\.com\/search\//,
  );
  await expect(sheet.getByRole("link", { name: "Open in Apple Music" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Share song" })).toBeVisible();
  await expect(sheet.getByText(/Connect/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("a sheet pulled down quickly, then held still before letting go, settles back", async ({
  page,
}) => {
  await page.goto("/#/shows/show/worldcafe");
  const sheet = page.getByRole("dialog", { name: "World Cafe" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  // 100px in about 100ms (a throw, were it let go then), then a second still.
  await touch(
    page,
    ".detail-dialog .dialog-header",
    Array.from({ length: 7 }, (_, i) => [200, 300 + (100 * i) / 6]),
    { stepMs: 16, restMs: 1000 },
  );
  await page.waitForTimeout(700);
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/#\/shows\/show\/worldcafe$/);
});

test("a tap on a song sheet's shade closes it, and does nothing to what is under it", async ({
  page,
}) => {
  await page.goto("/");
  const xpn2 = page.getByLabel("Radio station").getByRole("button", { name: "XPN2" });
  await expect(xpn2).toHaveAttribute("aria-pressed", "false");
  // The song's sheet from Listen's "···", which leaves the screen where it is.
  await page
    .getByRole("button", { name: /^More for / })
    .first()
    .click();
  const sheet = page.locator(".hold-menu");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  // XPN2, at the top of the screen, is under the shade: tapping there only
  // closes the sheet; the station stays as it was.
  const box = await xpn2.boundingBox();
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan((await sheet.boundingBox()).y);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(sheet).toBeHidden();
  await page.waitForTimeout(300);
  await expect(xpn2).toHaveAttribute("aria-pressed", "false");
});
