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
