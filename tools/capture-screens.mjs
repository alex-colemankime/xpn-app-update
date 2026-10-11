// Retakes screenshots for the screens page (design/screens) from the built
// app: phone size, light and dark, at the moment the page shows (a Tuesday
// afternoon in October, World Cafe on the air) and with the same song
// playing as the other shots. Writes PNGs to screens-out/; the Screens
// workflow (.github/workflows/screens.yml) runs it and uploads them, and
// they go into design/screens/img as WebP. Nothing here ships in the app.
//
//   node tools/capture-screens.mjs [shot ...]   (every shot when none named)
//
// Needs the app built as the preview is (VITE_SHOW_SAMPLES=true) and served
// at SCREENS_BASE_URL, and Playwright's Chromium. The concert calendar is
// xpn.org's own for that week, read live; everything else the app would
// fetch is answered here.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.SCREENS_BASE_URL || "http://127.0.0.1:4173/";
const OUT = process.env.SCREENS_OUT || "screens-out";
const NOW = new Date("2026-10-06T15:02:00-04:00");
const WEEK = { from: "2026-10-06", to: "2026-10-11" };

const SONG = {
  title: "First Day Of My Life",
  artist: "Bright Eyes",
  album: "I'm Wide Awake, It's Morning",
};
const ART = "https://i.scdn.co/image/screens-first-day-of-my-life";
const CORS = { "access-control-allow-origin": "*" };

// The album's artwork, from Apple's catalog; without it the song shows the
// station's mark.
async function artwork() {
  try {
    const term = encodeURIComponent(`${SONG.artist} ${SONG.title}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=10&country=US`,
    );
    const { results = [] } = await response.json();
    const hit = results.find((r) => /first day of my life/i.test(r.trackName || ""));
    if (!hit?.artworkUrl100) return null;
    const image = await fetch(hit.artworkUrl100.replace("100x100bb", "600x600bb"));
    return image.ok ? Buffer.from(await image.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// That week on xpn.org's concert calendar, every page.
async function concerts() {
  const events = [];
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({
      per_page: "50",
      start_date: WEEK.from,
      end_date: `${WEEK.to} 23:59:59`,
      page: String(page),
    });
    const response = await fetch(`https://xpn.org/wp-json/tribe/events/v1/events?${params}`);
    if (!response.ok) break;
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

function playlist() {
  const minutesAgo = (n) => easternStamp(new Date(NOW.getTime() - n * 60000));
  return [
    {
      artist: SONG.artist,
      song: SONG.title,
      album: SONG.album,
      image: ART,
      timeslice: minutesAgo(2),
    },
    {
      artist: "Waxahatchee",
      song: "Right Back to It",
      album: "Tigers Blood",
      image: "",
      timeslice: minutesAgo(7),
    },
    {
      artist: "Pavement",
      song: "Cut Your Hair",
      album: "Crooked Rain, Crooked Rain",
      image: "",
      timeslice: minutesAgo(11),
    },
  ];
}

const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });

// Fonts in, artwork color worked out, nothing still loading or moving.
async function settle(page) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator(".player-bar[data-tinted]")
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(600);
}
const scrollToEnd = async (page) => {
  await page.evaluate(() =>
    globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(600);
};

// Each shot: how to get there. Named as on the screens page (data-shot).
const SHOTS = {
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

const [art, events] = await Promise.all([artwork(), concerts()]);
await mkdir(OUT, { recursive: true });
// What went into the shots, beside them (CI logs aren't always to hand).
const notes = [
  `Artwork: ${art ? `${art.length} bytes` : "none"}; concerts that week: ${events.length}`,
];
const note = (line) => {
  console.log(line);
  notes.push(line);
};
console.log(notes[0]);
const browser = await chromium.launch();
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
  await context.addInitScript((appearance) => {
    globalThis.localStorage.setItem("xpn.onboarded", "true");
    globalThis.localStorage.setItem("xpn.appearance", JSON.stringify(appearance));
  }, theme);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(BASE).origin) return route.continue();
    if (/\/json\/\d{4}-\d\d-\d\d\.json$/.test(url.pathname)) return json(route, playlist());
    if (/nowplaying/i.test(url.pathname)) {
      return json(route, [
        { song: SONG.title, artist: SONG.artist, duration: "05:00", image: ART },
      ]);
    }
    if (url.href === ART && art) {
      return route.fulfill({ status: 200, contentType: "image/jpeg", headers: CORS, body: art });
    }
    if (url.hostname === "xpn.org" && url.pathname.includes("/tribe/events/")) {
      return json(route, { events, total: events.length, total_pages: 1 });
    }
    // Age limits, read live like the calendar.
    if (url.hostname === "xpn.org" && url.pathname.includes("/wp-json/acf/"))
      return route.continue();
    return route.fulfill({ status: 404, body: "" });
  });
  for (const name of wanted) {
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);
    await SHOTS[name](page);
    const file = `${OUT}/${name}-${theme}.png`;
    await writeFile(file, await page.screenshot({ animations: "disabled", caret: "hide" }));
    note(`Wrote ${file}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
await writeFile(`${OUT}/notes.txt`, `${notes.join("\n")}\n`);
