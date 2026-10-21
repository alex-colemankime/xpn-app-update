// Accessibility: every screen, and the sheets and panels that open over
// them, checked with axe (WCAG 2.1 A and AA) in light and dark, at phone and
// desktop sizes. Only what's on screen is checked: screens in the
// background are hidden, as a screen reader finds them.
import AxeBuilder from "@axe-core/playwright";
import { test, expect, routeListings, settle } from "./fixtures.mjs";

// Listings to check, not just empty states (fixtures.mjs).
test.beforeEach(({ page }) => routeListings(page));

const VIEWS = {
  listen: async (page) => {
    await page.goto("/#/listen");
    await expect(page.locator(".now-info h2")).toBeVisible();
  },
  favorites: async (page) => {
    await page.goto("/#/favorites");
    await expect(page.getByRole("region", { name: "Favorites" })).toBeVisible();
  },
  "shows, schedule": async (page) => {
    await page.goto("/#/shows");
    await expect(page.locator(".schedule-row").first()).toBeVisible();
  },
  "shows, all": async (page) => {
    await page.goto("/#/shows");
    await page.getByLabel("Browse shows").getByRole("button", { name: "All shows" }).click();
    await expect(page.locator(".show-card").first()).toBeVisible();
  },
  "a show's sheet": async (page) => {
    await page.goto("/#/shows/show/worldcafe");
    await expect(page.getByRole("dialog", { name: "World Cafe" })).toBeVisible();
  },
  "shows, hosts": async (page) => {
    await page.goto("/#/shows");
    await page.getByLabel("Browse shows").getByRole("button", { name: "Hosts" }).click();
    await expect(page.locator(".host-card").first()).toBeVisible();
  },
  "a host's sheet": async (page) => {
    await page.goto("/#/shows/host/dan-reed");
    await expect(page.getByRole("dialog", { name: "Dan Reed" })).toBeVisible();
  },
  "shows, archive": async (page) => {
    await page.goto("/#/shows");
    await page.getByLabel("Browse shows").getByRole("button", { name: "Archive" }).click();
    await expect(page.locator(".archive-row").first()).toBeVisible();
  },
  videos: async (page) => {
    await page.goto("/#/videos");
    await expect(page.locator(".video-card").first()).toBeVisible();
  },
  concerts: async (page) => {
    await page.goto("/#/concerts");
    await expect(page.locator(".concert-row").first()).toBeVisible();
  },
  "concerts, filter open": async (page) => {
    await page.goto("/#/concerts");
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.locator(".range-calendar")).toBeVisible();
  },
  "concerts, a chip and Filters on": async (page) => {
    await page.goto("/#/concerts");
    await page.getByRole("button", { name: "WXPN Welcomes", exact: true }).click();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("button", { name: "Philadelphia Area", exact: true }).click();
    await page.getByRole("button", { name: /^Show \d+ concert/ }).click();
    await expect(page.getByRole("button", { name: /^Filters 1 in use/ })).toBeVisible();
  },
  "a concert's sheet": async (page) => {
    await page.goto("/#/concerts");
    await page.locator(".concert-open").first().click();
    await expect(page.locator(".concert-sheet")).toBeVisible();
  },
  "a song's sheet": async (page) => {
    await page.goto("/");
    await page.locator(".recent-panel .track-open").first().click();
    await expect(page.locator(".hold-menu")).toBeVisible();
  },
  "settings, alarm on": async (page) => {
    await page.goto("/#/settings");
    await page.getByRole("switch", { name: "Radio alarm" }).click();
    await expect(page.getByText("Wake up to")).toBeVisible();
  },
};

for (const theme of ["light", "dark"]) {
  for (const [name, open] of Object.entries(VIEWS)) {
    test(`no accessibility problems: ${name}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await open(page);
      // Let fades and the artwork's colors settle.
      await settle(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const found = violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n` +
          v.nodes
            .slice(0, 4)
            .map((n) => `  ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1] || ""}`)
            .join("\n"),
      );
      expect(found, found.join("\n\n")).toEqual([]);
    });
  }
}
