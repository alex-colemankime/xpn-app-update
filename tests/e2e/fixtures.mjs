// The outside world for end-to-end tests: the station's song feed, its
// streams (a few seconds of silence), and every other service answered as
// empty or unavailable, so tests are fast, repeatable and offline.
import { readFileSync } from "node:fs";
import { test as base, expect } from "@playwright/test";

const SILENCE = readFileSync(new URL("./fixtures/silence.mp3", import.meta.url));

export const SONGS = [
  ["Right Back to It", "Waxahatchee"],
  ["Billy Came Back", "This is Lorelei"],
  ["Cut Your Hair", "Pavement"],
];

// Eastern date and time, as the station's playlist files write them.
export function eastern(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });

// Listings to show, not just empty states: concerts (one a WXPN Welcomes
// show), videos, and an archived show's broadcasts.
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export const EVENTS = ["Waxahatchee", "Friko / Hand Habits", "Big Thief"].map((title, i) => {
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
export const VIDEOS = Array.from({ length: 6 }, (_, i) => ({
  id: String(6400000000000 + i),
  name: `Artist ${i} - World Cafe | Studio Session`,
  duration: 600000,
  published_at: new Date(Date.now() - i * 86400000).toISOString(),
  tags: ["worldcafe"],
}));

// Answers the concert calendar, videos and Sleepy Hollow's archive with the
// listings above (in place of the empty answers every test gets).
export async function routeListings(page) {
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
}

// Lets the page render what it has been given (two animation frames, so
// React's effects have run), then waits until nothing in `locator` (by
// default the whole page) is mid-animation or mid-transition. Endless
// animations, such as a loading spinner, and finished ones held at their end
// don't count.
export async function settle(page, locator = page.locator("html")) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await expect
    .poll(() =>
      locator.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter(
              (a) =>
                a.playState === "running" && a.effect?.getComputedTiming().endTime !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
}

export const test = base.extend({
  page: async ({ page, context }, use) => {
    // First launch is over: no welcome.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("xpn.onboarded", "true");
      } catch {
        /* storage off: the welcome would show */
      }
    });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const url = route.request().url();
      if (/playlist\/json\/\d{4}-\d\d-\d\d\.json|xpn2\/json\/\d{4}-\d\d-\d\d\.json/.test(url)) {
        const now = Date.now();
        return json(
          route,
          SONGS.map(([song, artist], i) => ({
            song,
            artist,
            album: "",
            image: "",
            timeslice: eastern(now - (i + 1) * 4 * 60000),
          })),
        );
      }
      if (/nowplaying\/.*\.json/.test(url)) {
        const [song, artist] = SONGS[0];
        return json(route, [{ song, artist, duration: "03:30", image: "" }]);
      }
      if (/\.xpn\.org\/.*(mp3|nopreroll)/.test(url)) {
        return route.fulfill({ status: 200, contentType: "audio/mpeg", body: SILENCE });
      }
      if (/wp-json\/tribe\/events/.test(url)) return json(route, { events: [], total: 0 });
      return route.fulfill({ status: 404, body: "" });
    });
    await use(page);
  },
});
export { expect };
