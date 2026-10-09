// The outside world for end-to-end tests: the station's song feed, its
// streams (a few seconds of silence), and every other service answered as
// empty or unavailable, so tests are fast, repeatable and offline.
import { readFileSync } from "node:fs";
import { test as base } from "@playwright/test";

const SILENCE = readFileSync(new URL("./fixtures/silence.mp3", import.meta.url));

export const SONGS = [
  ["Right Back to It", "Waxahatchee"],
  ["Billy Came Back", "This is Lorelei"],
  ["Cut Your Hair", "Pavement"],
];

// Eastern date and time, as the station's playlist files write them.
function eastern(ms) {
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

const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });

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
export { expect } from "@playwright/test";
