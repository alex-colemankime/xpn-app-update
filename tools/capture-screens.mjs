// Retakes screenshots for the screens page (design/screens) from the built
// app: phone size, light and dark, at the moment the page shows (a Tuesday
// afternoon in October, World Cafe on the air), with the same song on the
// air and the same saved songs as the other shots. Writes PNGs to
// screens-out/; the Screens workflow (.github/workflows/screens.yml) runs
// it and publishes them, and they go into design/screens/img as WebP.
// Nothing here ships in the app.
//
//   node tools/capture-screens.mjs [shot ...]   (every shot when none named)
//
// Needs the app built as the preview is (VITE_SHOW_SAMPLES=true) and served
// at SCREENS_BASE_URL, and Playwright's Chromium. Songs' artwork comes from
// Apple's catalog and the concert calendar is xpn.org's own for that week,
// both read live; everything else the app would fetch is answered here.
import { chromium, webkit } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.SCREENS_BASE_URL || "http://127.0.0.1:4173/";
const OUT = process.env.SCREENS_OUT || "screens-out";
const NOW = new Date("2026-10-06T15:02:00-04:00");
const WEEK = { from: "2026-10-06", to: "2026-10-11" };
const CORS = { "access-control-allow-origin": "*" };
const SILENCE = await readFile(new URL("../tests/e2e/fixtures/silence.mp3", import.meta.url));

// The song on the air, then the rest of the saved songs, newest first.
const SONGS = [
  { title: "First Day Of My Life", artist: "Bright Eyes", album: "I'm Wide Awake, It's Morning" },
  { title: "Billy Came Back", artist: "This is Lorelei", album: "Holo Boy" },
  { title: "I Don't Have the Heart", artist: "Sharp Pins", album: "Radio DDR" },
  { title: "Just One of the Guys", artist: "Jenny Lewis", album: "The Voyager" },
  { title: "Cut Your Hair", artist: "Pavement", album: "Crooked Rain, Crooked Rain" },
];
const [ON_AIR] = SONGS;
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
// Where the app is told each song's artwork is; answered from ART below.
const artUrl = (song) => `https://i.scdn.co/image/screens-${slug(song.title)}`;

// A song's album artwork: from SCREENS_ART (a folder of <title slug>.jpg,
// for working offline), else from Apple's catalog; or null.
async function artwork(song) {
  if (process.env.SCREENS_ART) {
    return readFile(`${process.env.SCREENS_ART}/${slug(song.title)}.jpg`).catch(() => null);
  }
  try {
    const term = encodeURIComponent(`${song.artist} ${song.title}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=15&country=US`,
    );
    const { results = [] } = await response.json();
    const same = (a, b) => slug(a || "") === slug(b);
    const hit =
      results.find((r) => same(r.trackName, song.title) && same(r.artistName, song.artist)) ||
      results.find((r) => same(r.trackName, song.title)) ||
      results.find((r) => same(r.artistName, song.artist));
    if (!hit?.artworkUrl100) return null;
    const image = await fetch(hit.artworkUrl100.replace("100x100bb", "600x600bb"));
    return image.ok ? Buffer.from(await image.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// That week on xpn.org's concert calendar, every page (none offline).
async function concerts() {
  const events = [];
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({
      per_page: "50",
      start_date: WEEK.from,
      end_date: `${WEEK.to} 23:59:59`,
      page: String(page),
    });
    const response = await fetch(`https://xpn.org/wp-json/tribe/events/v1/events?${params}`).catch(
      () => null,
    );
    if (!response?.ok) break;
    const data = await response.json();
    events.push(...(data.events || []));
    if (page >= Number(data.total_pages || 1)) break;
  }
  return events;
}

// Eastern wall-clock time as the station's playlist writes it.
const easternStamp = (date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/New_York",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
const minutesAgo = (n) => new Date(NOW.getTime() - n * 60000);

// The station's playlist: the song on air two minutes ago, then the rest.
const playlist = () =>
  SONGS.map((song, i) => ({
    artist: song.artist,
    song: song.title,
    album: song.album,
    image: artUrl(song),
    timeslice: easternStamp(minutesAgo(2 + i * 4)),
  }));

// The saved songs, as Favorites keeps them (favorites.js).
const favorites = () => ({
  songs: Object.fromEntries(
    SONGS.map((song, i) => {
      const [date, time] = easternStamp(minutesAgo(2 + i * 4)).split(" ");
      const id = slug(`${song.artist} ${song.title}`);
      return [
        id,
        { ...song, id, img: artUrl(song), date, time: time.slice(0, 5), savedAt: +minutesAgo(i) },
      ];
    }),
  ),
});

const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });

// Fonts in, artwork colors worked out, nothing still loading or moving.
async function settle(page) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator(".player-bar[data-tinted]")
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(800);
}
const scrollToEnd = async (page) => {
  await page.evaluate(() =>
    globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(600);
};
// The station playing, as the mini player shows it ("Live").
// Audio doesn't always start in a headless browser: then the shot shows the
// station paused, and the notes say so.
async function playStation(page) {
  try {
    await page.locator(".player-bar .player-play").click({ timeout: 5000 });
    await page.locator('.player-bar .live-badge[data-state="live"]').waitFor({ timeout: 10000 });
  } catch {
    note("The station didn't start playing; that shot shows it paused.");
  }
}

// Each shot: how to get there. Named as on the screens page (data-shot).
const SHOTS = {
  // Favorites › Songs, with the station playing.
  "phone-favorites": async (page) => {
    await page.goto(`${BASE}#/favorites`);
    await page.locator(".track-row").first().waitFor();
    await settle(page);
    await page.locator(".track-row[data-tinted]").first().waitFor({ timeout: 5000 });
    await playStation(page);
    await page.waitForTimeout(400);
  },
  // Concerts with Region & more open, two filters chosen.
  "phone-concert-filters": async (page) => {
    await page.goto(`${BASE}#/concerts`);
    await page.locator(".concert-row").first().waitFor({ timeout: 20000 });
    await page.locator(".concert-refine summary").click();
    await page.getByRole("button", { name: "Philadelphia Area", exact: true }).click();
    await page.getByRole("button", { name: "WXPN Welcomes", exact: true }).click();
    await settle(page);
  },
  // Settings, scrolled to the end: the social accounts and the links under them.
  "phone-stay-connected": async (page) => {
    await page.goto(`${BASE}#/settings`);
    await page.getByRole("heading", { name: "Stay connected" }).waitFor();
    await settle(page);
    await scrollToEnd(page);
  },
  // Concerts, scrolled to the end of the week's listings.
  "phone-concerts-end": async (page) => {
    await page.goto(`${BASE}#/concerts`);
    await page.locator(".concert-row").first().waitFor({ timeout: 20000 });
    await settle(page);
    await scrollToEnd(page);
  },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
const unknown = wanted.filter((name) => !SHOTS[name]);
if (unknown.length) throw new Error(`No such shot: ${unknown.join(", ")}`);

const [events, ...arts] = await Promise.all([concerts(), ...SONGS.map(artwork)]);
const ART = new Map(SONGS.map((song, i) => [artUrl(song), arts[i]]));
await mkdir(OUT, { recursive: true });
// What went into the shots, beside them (CI logs aren't always to hand).
const notes = [];
const note = (line) => {
  console.log(line);
  notes.push(line);
};
note(`Concerts that week: ${events.length}`);
SONGS.forEach((song, i) => note(`Artwork for ${song.title}: ${arts[i]?.length || "none"}`));

// Chromium, or with SCREENS_BROWSER=webkit, WebKit (Safari's engine, to see
// how the iPhone app draws what Chromium might draw differently).
const browser =
  process.env.SCREENS_BROWSER === "webkit"
    ? await webkit.launch()
    : await chromium.launch({
        args: ["--autoplay-policy=no-user-gesture-required"],
        // A browser already on the machine (PLAYWRIGHT_CHROMIUM), else Playwright's own.
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
      });
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  await context.addInitScript(
    ({ appearance, saved }) => {
      const store = globalThis.localStorage;
      store.setItem("xpn.onboarded", "true");
      store.setItem("xpn.appearance", JSON.stringify(appearance));
      store.setItem("xpn.favorites.v1", JSON.stringify(saved));
      // The member drive banner is a shot of its own (phone-drive).
      store.setItem("xpn.updates.dismissed", JSON.stringify(["sample-fall-drive"]));
    },
    { appearance: theme, saved: favorites() },
  );
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(BASE).origin) return route.continue();
    if (/\/json\/\d{4}-\d\d-\d\d\.json$/.test(url.pathname)) return json(route, playlist());
    if (/nowplaying/i.test(url.pathname)) {
      const { title, artist } = ON_AIR;
      return json(route, [{ song: title, artist, duration: "05:00", image: artUrl(ON_AIR) }]);
    }
    if (ART.get(url.href)) {
      return route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        headers: CORS,
        body: ART.get(url.href),
      });
    }
    if (/\.xpn\.org$/.test(url.hostname) && /mp3|nopreroll/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: "audio/mpeg", body: SILENCE });
    }
    if (url.hostname === "xpn.org" && url.pathname.includes("/tribe/events/")) {
      return json(route, { events, total: events.length, total_pages: 1 });
    }
    // Age limits, read live like the calendar.
    if (url.hostname === "xpn.org" && url.pathname.includes("/wp-json/acf/")) {
      return route.continue();
    }
    return route.fulfill({ status: 404, body: "" });
  });
  for (const name of wanted) {
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);
    try {
      await SHOTS[name](page);
      const file = `${OUT}/${name}-${theme}.png`;
      await writeFile(file, await page.screenshot({ animations: "disabled", caret: "hide" }));
      note(`Wrote ${file}`);
    } catch (error) {
      // One shot that can't be taken doesn't cost the rest; it's noted.
      note(`Couldn't take ${name} (${theme}): ${error.message.split("\n")[0]}`);
      await page.screenshot({ path: `${OUT}/failed-${name}-${theme}.png` }).catch(() => {});
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
await writeFile(`${OUT}/notes.txt`, `${notes.join("\n")}\n`);
