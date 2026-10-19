// Accessibility: every screen, and the sheets and panels that open over
// them, checked with axe (WCAG 2.1 A and AA) in light and dark, at phone and
// desktop sizes. Only what's on screen is checked: screens in the
// background are hidden, as a screen reader finds them.
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.mjs";

// Listings to check, not just empty states: concerts (one a WXPN Welcomes
// show), videos, and an archived show's broadcasts.
const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EVENTS = ["Waxahatchee", "Friko / Hand Habits", "Big Thief"].map((title, i) => {
  const [year, month, d] = day(i).split("-");
  return {
    id: 100 + i,
    title,
    start_date_details: { year, month, day: d },
    venue: { venue: "Union Transfer", city: "Philadelphia" },
    categories: [
      { id: 5, name: "Philadelphia Area" },
      ...(i === 1 ? [{ id: 21, name: "WXPN Welcomes" }] : []),
    ],
    website: "https://example.com/tickets",
    url: `https://xpn.org/event/${i}`,
  };
});
const VIDEOS = Array.from({ length: 6 }, (_, i) => ({
  id: String(6400000000000 + i),
  name: `Artist ${i} - World Cafe | Studio Session`,
  duration: 600000,
  published_at: new Date(Date.now() - i * 86400000).toISOString(),
  tags: ["worldcafe"],
}));
test.beforeEach(async ({ page }) => {
  await page.route(/wp-json\/tribe\/events/, (route) =>
    json(route, { events: EVENTS, total: EVENTS.length, total_pages: 1 }),
  );
  await page.route(/wp-json\/acf\//, (route) => json(route, { _xpn_age_restriction: "21+" }));
  await page.route(/players\.brightcove\.net\/.*config\.json/, (route) =>
    json(route, { video_cloud: { policy_key: "k" } }),
  );
  await page.route(/edge\.api\.brightcove\.com/, (route) =>
    json(route, {
      videos: Number(new URL(route.request().url()).searchParams.get("offset")) ? [] : VIDEOS,
    }),
  );
  await page.route(/xpn\.org\/program\/sleepy-hollow\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: [4, 3]
        .map(
          (d) =>
            `<div data-track-url="https://media.xpn.org/archive/2026100${d}060000_sh.mp3" data-track-title="Sleepy Hollow - 10.0${d}.2026" data-track-guid="sh-${d}"></div>`,
        )
        .join(""),
    }),
  );
});

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
      await page.waitForTimeout(700);
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

// The concert listings above, in use.
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
  const count = page.locator(".day-aside [role=status]");
  const all = await count.textContent();
  await page.getByRole("button", { name: "WXPN Welcomes", exact: true }).click();
  await expect(page.getByRole("button", { name: "WXPN Welcomes", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(count).toHaveText(all);
});

test("a concert by an artist of a saved song is announced, and View shows only artists you like", async ({
  page,
  context,
}) => {
  // A saved song by Waxahatchee, who is on the calendar above.
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
  // Announced once: coming back doesn't announce it again.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByText("Waxahatchee at Union Transfer")).toHaveCount(0);
});
