// The Concerts screen in use: the calendar's days and sheets, quick
// filters, alerts for artists the listener likes, and a concert's own link.
import { test, expect, routeListings, settle } from "./fixtures.mjs";

test.beforeEach(({ page }) => routeListings(page));

test("concerts are grouped by day, and a concert's sheet has its tickets", async ({ page }) => {
  await page.goto("/#/concerts");
  const first = page.locator(".concert-day").first();
  await expect(first.getByRole("heading")).toBeVisible();
  await first.locator(".concert-open").first().click();
  const sheet = page.locator(".concert-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Tickets" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add to calendar" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // A quick filter narrows the list, and Clear lets it go.
  const count = page.locator("#concert-results");
  const all = await count.textContent();
  await page.getByRole("button", { name: "WXPN Welcomes", exact: true }).click();
  await expect(page.getByRole("button", { name: "WXPN Welcomes", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(count).toHaveText(all);
  // A search that leaves none is announced too.
  await page.getByPlaceholder("Artist or venue").fill("no such band zzz");
  await expect(page.getByText("No concerts match")).toBeVisible();
  await expect(count).toHaveText(/^0 of \d+ concerts$/);
});

test("a concert by an artist of a saved song is announced, and View shows only artists you like", async ({
  page,
  context,
}) => {
  // A saved song by Waxahatchee, who is on the calendar (fixtures.mjs, EVENTS).
  await context.addInitScript(() => {
    const id = "waxahatchee--right-back-to-it";
    localStorage.setItem(
      "xpn.favorites.v1",
      JSON.stringify({
        songs: { [id]: { id, title: "Right Back to It", artist: "Waxahatchee", savedAt: 1 } },
      }),
    );
  });
  await page.goto("/");
  const notice = page.getByText("Waxahatchee at Union Transfer");
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "View" }).click();
  await expect(page).toHaveURL(/#\/concerts/);
  await expect(page.locator(".concert-row")).toHaveCount(1);
  await expect(page.locator(".concert-row")).toContainText("Waxahatchee");
  await expect(page.getByRole("button", { name: /^Filters 1 in use/ })).toBeVisible();
  // Announced once: coming back doesn't announce it again, even once the
  // calendar has loaded and is on screen.
  const calendar = page.waitForResponse(/wp-json\/tribe\/events/);
  await page.reload();
  await calendar;
  await expect(page.locator(".concert-row").first()).toBeVisible();
  await settle(page);
  await expect(page.getByText("Waxahatchee at Union Transfer")).toHaveCount(0);
});

test("an alert's View lets go of filters left from before", async ({ page, context }) => {
  await context.addInitScript(() => {
    const id = "waxahatchee--right-back-to-it";
    localStorage.setItem(
      "xpn.favorites.v1",
      JSON.stringify({
        songs: { [id]: { id, title: "Right Back to It", artist: "Waxahatchee", savedAt: 1 } },
      }),
    );
  });
  await page.goto("/#/concerts");
  const view = page.getByRole("button", { name: "View" });
  await expect(view).toBeVisible();
  // A search from before that hides every concert.
  await page.getByPlaceholder("Artist or venue").fill("no such band zzz");
  await expect(page.getByText("No concerts match")).toBeVisible();
  await view.click();
  await expect(page.getByPlaceholder("Artist or venue")).toHaveValue("");
  await expect(page.locator(".concert-row")).toHaveCount(1);
  await expect(page.locator(".concert-row")).toContainText("Waxahatchee");
});

test("Back closes a concert's sheet and stays on Concerts; its link opens it again", async ({
  page,
}) => {
  await page.goto("/#/listen");
  await page.goto("/#/concerts");
  await page.locator(".concert-day .concert-open").first().click();
  const sheet = page.locator(".concert-sheet");
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/#\/concerts\/concert\//);
  const link = page.url();
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/concerts$/);
  await page.goto(link);
  await expect(sheet).toBeVisible();
});

test("a concert's link opens its sheet over any screen, once", async ({ page }) => {
  await page.goto("/#/concerts");
  await page.locator(".concert-day .concert-open").first().click();
  const id = page.url().split("/concert/")[1];
  await page.goto(`/#/listen/concert/${id}`);
  await expect(page.locator(".concert-sheet")).toHaveCount(1);
  await expect(page.locator(".concert-sheet")).toBeVisible();
});
