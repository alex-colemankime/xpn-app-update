// The main journeys, in the built app: listen, change station, save a song
// and find it again, open a show, change a setting, follow a link.
import { test, expect, SONGS } from "./fixtures.mjs";

test("Listen plays the station and shows what played", async ({ page }) => {
  await page.goto("/");
  const main = page.locator("main");
  await expect(main.getByText(SONGS[1][0])).toBeVisible();
  await main.getByRole("button", { name: /Listen live/ }).click();
  await expect(main.getByRole("button", { name: /^Pause/ })).toBeVisible();
  await main.getByRole("button", { name: /^Pause/ }).click();
  await expect(main.getByRole("button", { name: /Listen live/ })).toBeVisible();
});

test("changing station", async ({ page }) => {
  await page.goto("/");
  // The station keys are toggle buttons (aria-pressed).
  const xpn2 = page.getByRole("button", { name: "XPN2", exact: true }).first();
  await xpn2.click();
  await expect(xpn2).toHaveAttribute("aria-pressed", "true");
});

test("a saved song is in Favorites", async ({ page }) => {
  await page.goto("/");
  const song = SONGS[2][0];
  await page
    .locator("main")
    .getByRole("button", { name: new RegExp(`Save ${song}`) })
    .first()
    .click();
  await page.goto("/#/favorites");
  // Screens not in front stay in the page, hidden; look only at Favorites.
  await expect(page.getByRole("region", { name: "Favorites" }).getByText(song)).toBeVisible();
});

test("a show opens, can be followed, and closes", async ({ page }) => {
  await page.goto("/#/shows");
  await page
    .getByRole("button", { name: /World Cafe/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "World Cafe" });
  await expect(sheet.getByText("Hosted by")).toBeVisible();
  await sheet.getByRole("button", { name: /Follow show/ }).click();
  await expect(sheet.getByRole("button", { name: /Following/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("a link to a show opens its sheet", async ({ page }) => {
  await page.goto("/#/shows/show/funky");
  await expect(page.getByRole("dialog", { name: "Funky Friday" })).toBeVisible();
});

test("the dark theme is kept", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("no errors on any screen", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const screen of ["listen", "favorites", "shows", "videos", "concerts", "settings"]) {
    await page.goto(`/#/${screen}`);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("the station can switch a feature off and on again", async ({ page }) => {
  let off = ["videos"];
  // Page routes take priority over the fixtures' catch-all.
  await page.route(/\/updates\.json/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ updates: [], config: { off } }),
    }),
  );
  await page.goto("/");
  const videosTab = page.getByRole("button", { name: /^Videos$/ });
  await expect(page.getByRole("button", { name: /^Shows$/ }).first()).toBeVisible();
  await expect(videosTab).toHaveCount(0);
  // Switched back on: the next check (here, coming back to the app) brings it back.
  off = [];
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(videosTab.first()).toBeVisible();
});

test("going offline says so, and coming back clears it", async ({ page, context }) => {
  await page.goto("/");
  const notice = page.getByRole("status").filter({ hasText: "You’re offline" });
  // Straight away, while the other screens are still loading in the
  // background: their loads wait for the connection rather than failing.
  await context.setOffline(true);
  await expect(notice).toBeVisible();
  await context.setOffline(false);
  await expect(notice).toBeHidden();
  // A screen whose code the drop cut off either loads now or says so on its
  // own; the app around it, and the player, carry on.
  await page.goto("/#/settings");
  const settings = page.getByRole("region", { name: "Settings" });
  await expect(settings.getByText(/^Privacy$|This screen didn’t load/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo", { name: "Radio player" })).toBeVisible();
});

test("a show with a saved episode can be followed from Favorites", async ({ page, context }) => {
  await context.addInitScript(() => {
    const episode = {
      id: "f1",
      show: "funky",
      showId: "funky",
      showName: "Funky Friday",
      title: "Funky Friday for October 2",
      date: "2026-10-02T22:00:00-04:00",
      savedAt: 1,
    };
    localStorage.setItem("xpn.favorites.v1", JSON.stringify({ episodes: { f1: episode } }));
  });
  await page.goto("/#/favorites");
  const favorites = page.getByRole("region", { name: "Favorites" });
  await favorites.getByRole("button", { name: "Shows", exact: true }).click();
  const group = favorites.getByRole("region", { name: "Funky Friday" });
  await expect(group.getByText("Funky Friday for October 2")).toBeVisible();
  await expect(group.getByText("Not following")).toBeVisible();
  const follow = group.getByRole("button", { name: "Follow Funky Friday" });
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByText("Not following")).toBeHidden();
});
