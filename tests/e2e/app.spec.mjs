// The main journeys, in the built app: listen, change station, save a song
// and find it again, open a show, change a setting, follow a link.
import { test, expect, SONGS, eastern } from "./fixtures.mjs";

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

test("a double tap on the artwork hearts the song, and never unhearts it", async ({ page }) => {
  await page.goto("/");
  const song = SONGS[0][0];
  const heart = page
    .locator(".now-song-actions")
    .getByRole("button", { name: new RegExp(`Save ${song}`) });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await page.locator(".now-art").dblclick();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.locator(".now-art").dblclick();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/favorites");
  await expect(page.getByRole("region", { name: "Favorites" }).getByText(song)).toBeVisible();
});

test("each screen keeps its place, and its tab again goes to the top", async ({ page }) => {
  await page.goto("/#/shows");
  const nav = page.getByRole("navigation");
  // All shows, which is long every day of the week (today's schedule can be
  // too short to scroll 400px on a weekend).
  await page.getByLabel("Browse shows").getByRole("button", { name: "All shows" }).click();
  await expect(page.locator(".show-card").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
  await nav.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await nav.getByRole("button", { name: "Shows", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
  await nav.getByRole("button", { name: "Shows", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // Back (the browser's, or Android's) returns to where the screen was too.
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
  await nav.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
});

test("a show opens, can be followed, and closes", async ({ page }) => {
  await page.goto("/#/shows");
  // Shows opens on today's schedule; every show is under All shows.
  await page.getByLabel("Browse shows").getByRole("button", { name: "All shows" }).click();
  await page
    .getByRole("button", { name: /World Cafe/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "World Cafe" });
  await expect(sheet.locator(".show-hosts")).toContainText("with Raina Douris");
  await sheet.getByRole("button", { name: /Follow show/ }).click();
  await expect(sheet.getByRole("button", { name: /Following/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("Shows opens on the schedule", async ({ page }) => {
  await page.goto("/#/shows");
  await expect(
    page.getByLabel("Browse shows").getByRole("button", { name: "Schedule" }),
  ).toHaveAttribute("aria-pressed", "true");
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
  await expect(
    settings
      .getByRole("heading", { name: "Settings", level: 1 })
      .or(settings.getByText("This screen didn’t load")),
  ).toBeVisible();
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
  // Months are shortened AP style in a row ("Oct. 2"), so the date fits.
  await expect(group.getByText("Funky Friday for Oct. 2")).toBeVisible();
  await expect(group.getByText("Not following")).toBeVisible();
  const follow = group.getByRole("button", { name: "Follow Funky Friday" });
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByText("Not following")).toBeHidden();
});

test("an archive episode plays from its row, and pauses from it", async ({ page }) => {
  // Sleepy Hollow's page on xpn.org lists one broadcast (archive.js); the
  // other shows' pages are unavailable.
  await page.route(/xpn\.org\/program\/sleepy-hollow\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: '<div data-track-url="https://media.xpn.org/archive/20261004060000_sh.mp3" data-track-title="Sleepy Hollow - 10.04.2026" data-track-guid="sh-1004"></div>',
    }),
  );
  await page.goto("/#/shows");
  await page.getByLabel("Browse shows").getByRole("button", { name: "Archive" }).click();
  const episode = "Sleepy Hollow, Sunday, Oct\\. 4";
  await page.getByRole("button", { name: new RegExp(`^Play ${episode}`) }).click();
  await expect(page.getByRole("contentinfo", { name: "Archive player" })).toBeVisible();
  const pause = page.getByRole("button", { name: new RegExp(`^Pause ${episode}`) });
  await pause.click();
  await expect(pause).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(`^(Resume|Play) ${episode}`) }),
  ).toBeVisible();
});

test("concerts switched off by the station fetch no listings", async ({ page, context }) => {
  await context.addInitScript(() =>
    localStorage.setItem("xpn.remote-config", JSON.stringify({ off: ["concerts"] })),
  );
  let listings = 0;
  page.on("request", (r) => /wp-json\/tribe\/events/.test(r.url()) && listings++);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Shows$/ }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(listings).toBe(0);
  await expect(page.getByRole("button", { name: /^Concerts$/ })).toHaveCount(0);
});

test("Listen's page takes each song's color, and lets it go on leaving", async ({ page }) => {
  let color = "#c82828";
  const cors = { "access-control-allow-origin": "*" };
  await page.route(/playlist\/json\/\d{4}/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cors,
      body: JSON.stringify([
        {
          song: `Song ${color}`,
          artist: "Artist",
          album: "",
          image: `https://art.example/${color.slice(1)}.svg`,
          timeslice: eastern(Date.now() - 30000),
        },
      ]),
    }),
  );
  await page.route(/art\.example/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: cors,
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#${
        route
          .request()
          .url()
          .match(/(\w{6})\.svg/)[1]
      }"/></svg>`,
    }),
  );
  const page_ = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  await page.goto("/#/listen");
  await expect(page.locator(".now-info h2")).toHaveText("Song #c82828");
  await expect.poll(page_).not.toBe("#f5f5f3");
  const red = await page_();
  // A new song (as pressing play asks for one) brings its own color.
  color = "#1e5ac8";
  await page.evaluate(() => window.dispatchEvent(new Event("wxpn:refresh-playlist")));
  await expect(page.locator(".now-info h2")).toHaveText("Song #1e5ac8");
  await expect.poll(page_).not.toBe(red);
  await page.evaluate(() => {
    location.hash = "#/favorites";
  });
  await expect.poll(page_).toBe("#f5f5f3");
});

test("Favorites changes in place, without leaving the tab", async ({ page }) => {
  await page.goto("/#/listen");
  const main = page.locator("main");
  await main
    .getByRole("button", { name: `Save ${SONGS[1][0]}` })
    .first()
    .click();
  await page.evaluate(() => {
    location.hash = "#/favorites";
  });
  const favorites = page.getByRole("region", { name: "Favorites" });
  const row = favorites.locator(".track-row", { hasText: SONGS[1][0] });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Save ${SONGS[1][0]}` }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
});

test("a song hearted in Recently played is in Favorites at once, after a visit there", async ({
  page,
}) => {
  await page.goto("/#/listen");
  const nav = page.getByRole("navigation").first();
  const tab = (name) =>
    nav.getByRole("link", { name }).or(nav.getByRole("button", { name })).first();
  const recent = page.locator(".recent-panel");
  await expect(recent.getByText(SONGS[1][0])).toBeVisible();
  // Favorites seen once, so it is kept behind the other tabs.
  await tab("Favorites").click();
  await tab(/Listen/).click();
  await recent.getByRole("button", { name: `Save ${SONGS[1][0]}` }).click();
  await tab("Favorites").click();
  await expect(
    page.getByRole("region", { name: "Favorites" }).locator(".track-row", { hasText: SONGS[1][0] }),
  ).toBeVisible();
});

test("a notice whose drag is cancelled still takes the first tap on Undo", async ({ page }) => {
  await page.goto("/#/listen");
  await page
    .locator("main")
    .getByRole("button", { name: `Save ${SONGS[1][0]}` })
    .first()
    .click();
  await page.evaluate(() => {
    location.hash = "#/favorites";
  });
  const favorites = page.getByRole("region", { name: "Favorites" });
  const row = favorites.locator(".track-row", { hasText: SONGS[1][0] });
  await row.getByRole("button", { name: `Save ${SONGS[1][0]}` }).click();
  await expect(row).toHaveCount(0);
  const toast = page.locator(".toast").first();
  await expect(toast).toBeVisible();
  // A drag down on the notice that the system cancels partway.
  await toast.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const at = (type, dy) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          clientX: box.left + 20,
          clientY: box.top + 10 + dy,
          bubbles: true,
          cancelable: true,
        }),
      );
    at("pointerdown", 0);
    at("pointermove", 12);
    at("pointermove", 20);
    at("pointercancel", 20);
  });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
});

test("Favorites shows every saved song, and comes back where it was", async ({ page, context }) => {
  // Twelve saved songs, every one shown.
  await context.addInitScript(() => {
    const songs = {};
    for (let i = 1; i <= 12; i++) {
      const id = `artist-${i}--song-${i}`;
      songs[id] = { id, title: `Song ${i}`, artist: `Artist ${i}`, savedAt: 1000 + i };
    }
    localStorage.setItem("xpn.favorites.v1", JSON.stringify({ songs }));
  });
  await page.goto("/#/favorites");
  const nav = page.getByRole("navigation");
  const tab = (name) => nav.getByRole("button", { name, exact: true });
  const rows = page.getByRole("region", { name: "Favorites" }).locator(".saved-songs > .track-row");
  await expect(rows).toHaveCount(12);
  // Near the end of the list, where the place may not exist yet as the
  // screen comes back. Not the very end: the page's last few pixels can
  // settle differently from one browser to another.
  await rows.nth(9).scrollIntoViewIfNeeded();
  const place = await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight - window.innerHeight - 40 });
    return Math.round(window.scrollY);
  });
  expect(place).toBeGreaterThan(0);
  await tab("Shows").click();
  await tab("Favorites").click();
  await expect(rows).toHaveCount(12);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(place);
});

test("Listen's song has the whole width, and its keys fit one row on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const controls = page.locator(".now-controls");
  await expect(controls.getByRole("button", { name: /^Save / })).toBeVisible();
  await expect(controls.getByRole("button", { name: /^More for / })).toBeVisible();
  // Nothing in the row spills past it, and the title has the row to itself.
  const fits = await page.evaluate(() => {
    const row = document.querySelector(".now-controls").getBoundingClientRect();
    const keys = [...document.querySelectorAll(".now-controls button")];
    const title = document.querySelector(".now-info h2").getBoundingClientRect();
    const art = document.querySelector(".now-art").getBoundingClientRect();
    return {
      inRow: keys.every((k) => k.getBoundingClientRect().right <= row.right + 0.5),
      oneRow: new Set(keys.map((k) => Math.round(k.getBoundingClientRect().top))).size === 1,
      titleWidth: title.width >= art.width - 1,
    };
  });
  expect(fits).toEqual({ inRow: true, oneRow: true, titleWidth: true });
});

// A show's hosts open their sheets; a host's shows open theirs, and Back
// steps back through them.
test("hosts and their shows open each other, and Back returns", async ({ page }) => {
  await page.goto("/#/shows/show/worldcafe");
  const show = page.getByRole("dialog", { name: "World Cafe" });
  await show.getByRole("button", { name: "Raina Douris" }).click();
  const host = page.getByRole("dialog", { name: "Raina Douris" });
  await expect(host).toBeVisible();
  await expect(host.locator(".host-bio p").first()).not.toBeEmpty();
  await host.getByRole("button", { name: /^Conversations from the World Cafe/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Conversations from the World Cafe" }),
  ).toBeVisible();
  await page.goBack();
  await expect(host).toBeVisible();
  await page.goBack();
  await expect(show).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the Hosts view finds a host by a show of theirs", async ({ page }) => {
  await page.goto("/#/shows");
  await page.getByLabel("Browse shows").getByRole("button", { name: "Hosts" }).click();
  await page.getByPlaceholder("Find a host or show").fill("echoes");
  await expect(page.locator(".host-card")).toHaveCount(1);
  await page.locator(".host-card").click();
  await expect(page.getByRole("dialog", { name: "John Diliberto" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
