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
// both read live. The videos are the collections as fetch-video-fixtures.mjs
// saved them (the screens-fixtures branch, checked out at SCREENS_FIXTURES);
// the archive is that week's broadcasts, written here; everything else the
// app would fetch is answered here too.
import { chromium, webkit } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.SCREENS_BASE_URL || "http://127.0.0.1:4173/";
const OUT = process.env.SCREENS_OUT || "screens-out";
const NOW = new Date("2026-10-06T15:02:00-04:00");
const WEEK = { from: "2026-10-06", to: "2026-10-11" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
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

// The xpn.org archive that week, as each show's page lists its broadcasts
// (archive.js, parseArchivePage): dated ones by the day they aired, World
// Cafe's by who they feature. Every file is four hours of silence.
const ARCHIVE = {
  "sleepy-hollow": {
    name: "Sleepy Hollow",
    show: "sleepyhollow",
    dates: [
      "10.04",
      "10.03",
      "09.27",
      "09.26",
      "09.20",
      "09.19",
      "09.13",
      "09.12",
      "09.06",
      "09.05",
    ],
  },
  "land-of-the-lost": {
    name: "Land of the Lost",
    show: "landlost",
    dates: ["10.02", "09.25", "09.11", "09.04", "08.28", "08.21", "08.14", "08.07", "07.31"],
  },
  "funky-friday": {
    name: "Funky Friday",
    show: "funky",
    dates: ["10.02", "09.25", "09.18", "09.11", "09.04"],
  },
  "world-cafe": {
    name: "World Cafe",
    show: "worldcafe",
    features: [
      ["Waxahatchee in the studio", "0930"],
      ["Friko", "0924"],
      ["Julia Jacklin", "0916"],
    ],
  },
};
// As archive.js names episodes: the show, then a hash of the page's id.
function shortHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}
const archiveTracks = (slug) => {
  const { name, show, dates = [], features = [] } = ARCHIVE[slug];
  return [
    ...dates.map((day) => ({
      title: `${name} - ${day}.2026`,
      stamp: `2026${day.replace(".", "")}`,
    })),
    ...features.map(([who, day]) => ({ title: `${who} on ${name}`, stamp: `2026${day}` })),
  ].map((track) => ({ ...track, guid: `screens-${show}-${track.stamp}` }));
};
const archivePage = (slug) =>
  archiveTracks(slug)
    .map(
      ({ title, stamp, guid }) =>
        `<div data-track-url="https://xpn.org/wp-content/uploads/archive/${stamp}060000_${slug}.mp3"` +
        ` data-track-title="${title}" data-track-guid="${guid}"></div>`,
    )
    .join("\n");
const episodeId = (slug, index) =>
  `${ARCHIVE[slug].show}-${shortHash(archiveTracks(slug)[index].guid)}`;
// Four hours of silence as an MP3: one silent frame (MPEG-2.5 layer III,
// 8 kHz mono at 8 kbps: 72 bytes, 72 ms) over and over, 3 hr 52 min long,
// so an episode plays and tells its length as a broadcast's file would.
const EPISODE_AUDIO = (() => {
  const frame = Buffer.alloc(72);
  frame.set([0xff, 0xe3, 0x18, 0xc0]);
  return Buffer.concat(Array(193330).fill(frame));
})();

// The video collections, and each video's thumbnail, from SCREENS_FIXTURES
// (null without them: the video shots are then skipped).
const FIXTURES = process.env.SCREENS_FIXTURES || "screens-fixtures";
const VIDEOS = await readFile(`${FIXTURES}/videos.json`, "utf8")
  .then(JSON.parse)
  .catch(() => null);
const POSTERS = "https://cf-images.us-east-1.prod.boltdns.net/screens/";
const withPoster = (video) => ({ ...video, poster: `${POSTERS}${video.id}.jpg` });
const videoById = (id) =>
  withPoster(
    Object.values(VIDEOS || {})
      .flat()
      .find((video) => video.id === id) || { id },
  );
// A saved video as Favorites keeps it (videos.js, savedVideoItem).
const savedVideo = (id, savedAt) => {
  const video = videoById(id);
  const artist = video.custom_fields?.artist_performer || "";
  const detail = video.name
    .slice(artist.length)
    .replace(/^\s*(?:[-–—:|]|on\b)\s*/i, "")
    .replace(/\s*\|\s*/g, " · ");
  return {
    id,
    name: video.name,
    artist,
    detail,
    poster: video.poster,
    duration: Math.round(video.duration / 1000),
    published: video.published_at || "",
    tags: video.tags || [],
    savedAt,
  };
};
// A saved episode as Favorites keeps it (Archive.jsx, savedEpisodeItem).
const savedEpisode = (slug, index, title, extra) => ({
  id: episodeId(slug, index),
  show: ARCHIVE[slug].show,
  showId: ARCHIVE[slug].show,
  showName: ARCHIVE[slug].name,
  title,
  image: `/shows/${ARCHIVE[slug].show}.jpg`,
  ...extra,
});

// What's saved, as Favorites keeps it (favorites.js): the songs; World Cafe,
// followed; two Funky Friday broadcasts and a World Cafe session; three
// videos.
const favorites = () => ({
  shows: { worldcafe: { id: "worldcafe", name: "World Cafe", savedAt: +minutesAgo(90) } },
  episodes: Object.fromEntries(
    [
      savedEpisode("funky-friday", 0, "Friday, October 2", {
        date: "2026-10-02T20:00:00.000Z",
        aired: "4pm–7pm",
        savedAt: +minutesAgo(30),
      }),
      savedEpisode("funky-friday", 1, "Friday, September 25", {
        date: "2026-09-25T20:00:00.000Z",
        aired: "4pm–7pm",
        savedAt: +minutesAgo(31),
      }),
      savedEpisode("world-cafe", 0, "Waxahatchee in the studio", {
        date: "2026-09-30T18:00:00.000Z",
        duration: 3420,
        savedAt: +minutesAgo(60),
      }),
    ].map((episode) => [episode.id, episode]),
  ),
  videos: Object.fromEntries(
    ["6405196152112", "6405626990112", "6405198430112"].map((id, i) => [
      id,
      savedVideo(id, +minutesAgo(40 + i)),
    ]),
  ),
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
// Scrolls whatever holds `locator` (the page, or a sheet) to put it near
// the top, under the sheet's heading.
const scrollToTop = async (page, locator, gap = 96) => {
  await locator.evaluate((el, gap) => {
    el.scrollIntoView({ block: "start" });
    let box = el.parentElement;
    while (
      box &&
      !(
        box.scrollHeight > box.clientHeight &&
        /auto|scroll/.test(globalThis.getComputedStyle(box).overflowY)
      )
    )
      box = box.parentElement;
    (box || globalThis.document.scrollingElement).scrollBy(0, -gap);
  }, gap);
  await page.waitForTimeout(600);
};
// Shows › Archive, its broadcasts listed.
const openArchive = async (page) => {
  await page.goto(`${BASE}#/shows`);
  await page.getByLabel("Browse shows").getByRole("button", { name: "Archive" }).click();
  await page.locator(".archive-row button.archive-open").first().waitFor({ timeout: 10000 });
};
// An episode playing: its row tapped, then the mini player showing it.
const playEpisodeRow = async (page, index) => {
  await page.locator(".archive-row button.archive-open").nth(index).click();
  await page
    .locator('.player-bar[data-source="episode"][data-playing]')
    .waitFor({ timeout: 10000 });
  await page.waitForTimeout(2500);
};
const needVideos = () => {
  if (!VIDEOS) throw new Error(`no video fixtures in ${FIXTURES}`);
};
// The Videos tab, its collections loaded.
const openVideos = async (page) => {
  needVideos();
  await page.goto(`${BASE}#/videos`);
  await page.locator(".video-card img").first().waitFor({ timeout: 10000 });
};
const favoritesTab = async (page, tab) => {
  await page.goto(`${BASE}#/favorites`);
  await page.getByLabel("Favorites category").getByRole("button", { name: tab }).click();
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
  // Shows › Archive: each show's latest broadcasts.
  "phone-archive": async (page) => {
    await openArchive(page);
    await settle(page);
  },
  // The newest broadcast playing from its row, in the mini player too.
  "phone-episode-bar": async (page) => {
    await openArchive(page);
    await playEpisodeRow(page, 0);
    await settle(page);
  },
  // World Cafe's sheet, from the top.
  "phone-sheet": async (page) => {
    needVideos();
    await page.goto(`${BASE}#/shows/show/worldcafe`);
    await page
      .getByRole("dialog", { name: "World Cafe" })
      .locator(".video-card img")
      .first()
      .waitFor();
    await settle(page);
  },
  // World Cafe's sheet at its videos.
  "phone-sheet-videos": async (page) => {
    needVideos();
    await page.goto(`${BASE}#/shows/show/worldcafe`);
    const sheet = page.getByRole("dialog", { name: "World Cafe" });
    await sheet.locator(".video-card img").first().waitFor();
    await settle(page);
    await scrollToTop(page, sheet.getByRole("heading", { name: "Videos" }));
  },
  // Videos, World Cafe: the newest large, then the rest.
  "phone-videos": async (page) => {
    await openVideos(page);
    await settle(page);
  },
  // Videos, WXPN, scrolled to the list.
  "phone-videos-list": async (page) => {
    await openVideos(page);
    await page.getByRole("button", { name: "WXPN", exact: true }).click();
    await page.waitForTimeout(600);
    await settle(page);
    await scrollToTop(page, page.locator(".video-hero .video-text"), 120);
  },
  // Favorites › Shows: World Cafe followed, Funky Friday's saved broadcasts.
  "phone-fav-shows": async (page) => {
    await favoritesTab(page, "Shows");
    await page.locator(".saved-shows .archive-row").first().waitFor();
    await settle(page);
  },
  // Favorites › Videos.
  "phone-fav-videos": async (page) => {
    needVideos();
    await favoritesTab(page, "Videos");
    await page.locator(".saved-videos .video-card img").first().waitFor();
    await settle(page);
  },
  // Desktop: the archive with the second broadcast playing.
  "desk-archive": async (page) => {
    await openArchive(page);
    await playEpisodeRow(page, 1);
    await settle(page);
  },
  // Desktop: Videos.
  "desk-videos": async (page) => {
    await openVideos(page);
    await settle(page);
  },
  // Desktop: World Cafe's sheet over the schedule.
  "desk-sheet": async (page) => {
    needVideos();
    await page.goto(`${BASE}#/shows/show/worldcafe`);
    await page
      .getByRole("dialog", { name: "World Cafe" })
      .locator(".video-card img")
      .first()
      .waitFor();
    await settle(page);
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
        // No scrollbars in the desktop shots, as on a Mac.
        args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"],
        // A browser already on the machine (PLAYWRIGHT_CHROMIUM), else Playwright's own.
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
      });
// Phone shots at an iPhone's size; "desk-" shots in a laptop's window.
const DEVICES = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 },
};
const deviceOf = (name) => (name.startsWith("desk-") ? "desk" : "phone");
for (const [theme, device] of ["light", "dark"].flatMap((t) =>
  Object.keys(DEVICES).map((d) => [t, d]),
)) {
  const shots = wanted.filter((name) => deviceOf(name) === device);
  if (!shots.length) continue;
  const context = await browser.newContext({
    ...DEVICES[device],
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
  await context.route("**/*", async (route) => {
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
    if (url.hostname === "xpn.org" && url.pathname.startsWith("/program/")) {
      const slug = url.pathname.split("/")[2];
      if (!ARCHIVE[slug]) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        headers: CORS,
        body: archivePage(slug),
      });
    }
    if (url.hostname === "xpn.org" && url.pathname.startsWith("/wp-content/uploads/archive/")) {
      return route.fulfill({ status: 200, contentType: "audio/mpeg", body: EPISODE_AUDIO });
    }
    if (url.hostname === "players.brightcove.net" && url.pathname.endsWith("/config.json")) {
      return json(route, { video_cloud: { policy_key: "screens" } });
    }
    if (url.hostname === "edge.api.brightcove.com") {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS, body: "" });
      }
      const playlist = /\/playlists\/(\d+)/.exec(url.pathname)?.[1];
      const first = Number(url.searchParams.get("offset") || 0) === 0;
      const videos = first && VIDEOS?.[playlist] ? VIDEOS[playlist].map(withPoster) : [];
      return json(route, { videos });
    }
    if (url.href.startsWith(POSTERS)) {
      const poster = await readFile(`${FIXTURES}/${url.pathname.split("/").pop()}`).catch(
        () => null,
      );
      if (!poster) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, contentType: "image/jpeg", headers: CORS, body: poster });
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
  for (const name of shots) {
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
