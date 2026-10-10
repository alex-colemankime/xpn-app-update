// Videos: Brightcove playlists (config.js), one per section of the Videos
// tab, read with Brightcove's Playback API, the public interface its players
// use, and played in the account's own Brightcove Player, so plays are
// counted in Brightcove Analytics (as "wxpn-app").
//
//   - The Playback API needs the player's policy key, which Brightcove serves
//     to every page that embeds the player; the app reads it from the
//     player's config rather than building one in.
//   - Streams are HLS and DASH only, which the Brightcove Player plays on
//     every platform, so the app never handles them itself.
//
// A video: { id, name, artist, detail, description, duration, poster,
// published, tags } where `artist` and `detail` are the name split for
// display ("Julia Jacklin" / "World Cafe · Studio Session & Interview"),
// `duration` seconds and `published` an ISO time.

import { useSyncExternalStore } from "react";
import { publicAsset } from "./assets.js";
import { useEveryShow } from "./hooks/useEveryShow.js";
import { VIDEO_ACCOUNT, VIDEO_PLAYER, VIDEO_SECTIONS } from "./config.js";
import { withTimeout } from "./net.js";
import { createStore, readJson, writeJson } from "./storage.js";
import { oneLine, webUrl } from "./text.js";

const API = "https://edge.api.brightcove.com/playback/v1/accounts";
const PLAYERS = "https://players.brightcove.net";
const PAGE_SIZE = 48;

const startsWithWord = (text, word) =>
  word &&
  text.toLowerCase().startsWith(word.toLowerCase()) &&
  /^\W?$/.test(text[word.length] || "");
// After the artist: " - ", ": ", " on " or " | ".
const SEPARATOR = /^\s*(?:[-–—:|]|on\b)\s*/i;

// A video's name as an artist and what it is. Names are written several
// ways: "Artist - What", "Artist on World Cafe | Session", sometimes with the
// artist twice ("Old 97's - Old 97's - World Cafe"). The station's own name
// is not an artist.
export function splitTitle(name, performer = "") {
  const full = oneLine(name);
  let artist = oneLine(performer);
  let rest = full;
  if (artist && startsWithWord(full, artist)) {
    rest = full.slice(artist.length).replace(SEPARATOR, "");
  } else {
    const on = /^(.+?)\s+on\s+(World Cafe\b.*)$/i.exec(full);
    const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(full);
    if (on) [, artist, rest] = on;
    else if (dash) [, artist, rest] = dash;
    else if (!artist) return { artist: "", detail: full };
  }
  if (startsWithWord(rest, artist) && SEPARATOR.test(rest.slice(artist.length))) {
    rest = rest.slice(artist.length).replace(SEPARATOR, "");
  }
  const detail = rest.replace(/\s*\|\s*/g, " · ").trim();
  if (/^wxpn$/i.test(artist)) {
    return { artist: "", detail: detail.replace(/^["“](.+)["”]$/, "$1") };
  }
  return detail ? { artist, detail } : { artist: "", detail: artist || full };
}

// One video from the Playback API, or null when it can't be shown.
export function normalizeVideo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "");
  const name = oneLine(raw.name);
  if (!/^\d+$/.test(id) || !name) return null;
  const { artist, detail } = splitTitle(name, raw.custom_fields?.artist_performer);
  const published = Date.parse(raw.published_at || raw.created_at || "");
  return {
    id,
    name,
    artist,
    detail,
    description: oneLine(raw.long_description || raw.description).slice(0, 600),
    duration: Number(raw.duration) > 0 ? Math.round(Number(raw.duration) / 1000) : null,
    poster: webUrl(raw.poster) || webUrl(raw.thumbnail),
    published: Number.isFinite(published) ? new Date(published).toISOString() : null,
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => oneLine(t).toLowerCase()).filter(Boolean)
      : [],
  };
}

// A playlist's videos, in its order, each once.
export function parsePlaylist(json) {
  const seen = new Set();
  return (Array.isArray(json?.videos) ? json.videos : [])
    .map(normalizeVideo)
    .filter((v) => v && !seen.has(v.id) && seen.add(v.id));
}

// Where the account's player plays one video: starting at once (with sound
// when the browser allows it, else waiting for a tap), inline on phones, and
// counted as the app in Brightcove Analytics.
export const playerUrl = (id, { account = VIDEO_ACCOUNT, player = VIDEO_PLAYER } = {}) =>
  `${PLAYERS}/${account}/${player}_default/index.html?${new URLSearchParams({
    videoId: id,
    autoplay: "play",
    playsinline: "true",
    applicationId: "wxpn-app",
  })}`;

// The same player in the app's own frame (public/video-player.html), which
// hides the title and description the player draws over the video. It
// falls back to playerUrl if the player can't start there.
export const framedPlayerUrl = (id) =>
  publicAsset(
    `video-player.html?${new URLSearchParams({ account: VIDEO_ACCOUNT, player: VIDEO_PLAYER, video: id })}`,
  );

// Searching what has loaded: artist, title, description and tags.
export function matchVideos(videos, query) {
  const q = oneLine(query).toLowerCase();
  if (!q) return videos;
  return videos.filter((v) =>
    `${v.artist} ${v.detail} ${v.description} ${v.tags.join(" ")}`.toLowerCase().includes(q),
  );
}

// ---- Loading -------------------------------------------------------------

// The player's policy key, read once and shared: every collection loading
// at the same moment waits on the same request. A failed read is forgotten,
// so the next load tries again.
let policyKey = null;
function getPolicyKey() {
  policyKey ??= (async () => {
    const response = await fetch(
      `${PLAYERS}/${VIDEO_ACCOUNT}/${VIDEO_PLAYER}_default/config.json`,
      { signal: withTimeout() },
    );
    if (!response.ok) throw new Error(`Videos: player config HTTP ${response.status}`);
    const key = (await response.json())?.video_cloud?.policy_key;
    if (!key) throw new Error("Videos: the player has no policy key");
    return key;
  })().catch((error) => {
    policyKey = null;
    throw error;
  });
  return policyKey;
}

async function fetchPlaylist(playlist, offset = 0) {
  const key = await getPolicyKey();
  const response = await fetch(
    `${API}/${VIDEO_ACCOUNT}/playlists/${playlist}?limit=${PAGE_SIZE}&offset=${offset}`,
    { headers: { Accept: `application/json;pk=${key}` }, signal: withTimeout() },
  );
  // A key the player has since replaced: read it again next time.
  if (response.status === 401 || response.status === 403) policyKey = null;
  if (!response.ok) throw new Error(`Videos: playlist HTTP ${response.status}`);
  const json = await response.json();
  // `count`: how many entries the server sent, before duplicates and
  // unusable ones are dropped. Whether there's another page, and where it
  // starts, go by that, not by what's left to show.
  return {
    videos: parsePlaylist(json),
    count: Array.isArray(json?.videos) ? json.videos.length : 0,
  };
}

// One video, for a watch page opened from a link to a video no list holds.
export async function fetchVideo(id, signal) {
  const key = await getPolicyKey();
  const response = await fetch(`${API}/${VIDEO_ACCOUNT}/videos/${encodeURIComponent(id)}`, {
    headers: { Accept: `application/json;pk=${key}` },
    signal: withTimeout(signal),
  });
  if (!response.ok) throw new Error(`Videos: video HTTP ${response.status}`);
  const video = normalizeVideo(await response.json());
  if (!video) throw new Error("Videos: unusable video");
  return video;
}

// Where a video is in the lists: the video and its section, or nulls.
export function findVideo(sections, id) {
  for (const section of sections) {
    const video = section.videos.find((v) => v.id === id);
    if (video) return { video, section };
  }
  return { video: null, section: null };
}

// Every section's first page, shared by the Videos tab and show pages; the
// last good lists are kept for a moment offline. Each section keeps its own
// state, so one failing collection shows its own error and retry while the
// others play on:
//   status      "loading" | "live" | "cache" (an earlier list, not refreshed)
//               | "error" (nothing to show)
//   more        whether Brightcove has further pages
//   moreFailed  the last further page couldn't be loaded
//   offset      where the next page starts in Brightcove's list (counted
//               as asked for, apart from the videos shown, which drop
//               repeats)
// A load that failed anywhere is tried again soon rather than after the
// usual wait.
const CACHE_KEY = "xpn.videos.cache";
const STALE_MS = 30 * 60000;
const RETRY_MS = 2 * 60000;
const cached = readJson(CACHE_KEY, null);
const fromCache = (playlist) =>
  (Array.isArray(cached?.[playlist]) ? cached[playlist] : []).filter(
    (v) => v && typeof v.id === "string" && typeof v.name === "string" && Array.isArray(v.tags),
  );
const videoStore = createStore({
  sections: VIDEO_SECTIONS.map((s) => {
    const videos = fromCache(s.playlist);
    return {
      ...s,
      videos,
      more: true,
      moreFailed: false,
      offset: videos.length,
      status: videos.length ? "cache" : "loading",
    };
  }),
  section: VIDEO_SECTIONS[0]?.label || "",
  loadedAt: 0,
  complete: false,
});
let inflight = null;

const updateSection = (playlist, change) =>
  videoStore.set((s) => ({
    ...s,
    sections: s.sections.map((old) =>
      old.playlist === playlist ? { ...old, ...change(old) } : old,
    ),
  }));

export function loadVideos({ force = false } = {}) {
  const state = videoStore.getSnapshot();
  if (!VIDEO_SECTIONS.length || inflight) return inflight;
  const wait = state.complete ? STALE_MS : RETRY_MS;
  if (!force && state.loadedAt && Date.now() - state.loadedAt < wait) return null;
  if (force) {
    videoStore.set({
      ...state,
      sections: state.sections.map((s) => (s.videos.length ? s : { ...s, status: "loading" })),
    });
  }
  inflight = Promise.allSettled(VIDEO_SECTIONS.map((s) => fetchPlaylist(s.playlist)))
    .then((results) => {
      // Each section's fresh first page, or null where it couldn't be read.
      const fresh = new Map(VIDEO_SECTIONS.map((s, i) => [s.playlist, results[i].value ?? null]));
      videoStore.set((s) => ({
        ...s,
        sections: s.sections.map((old) => {
          const got = fresh.get(old.playlist);
          const videos = got?.videos;
          if (videos && old.status === "live" && old.offset > got.count) {
            // The listener has opened further pages: the fresh first page
            // leads, and what they had loaded follows, so the list neither
            // shrinks under them nor loses its place for the next page.
            const ids = new Set(videos.map((v) => v.id));
            return {
              ...old,
              videos: [...videos, ...old.videos.filter((v) => !ids.has(v.id))],
              status: "live",
            };
          }
          if (videos) {
            return {
              ...old,
              videos,
              more: got.count === PAGE_SIZE,
              moreFailed: false,
              offset: got.count,
              status: "live",
            };
          }
          return { ...old, status: old.videos.length ? "cache" : "error" };
        }),
        loadedAt: Date.now(),
        complete: results.every((r) => r.status === "fulfilled"),
      }));
      if (results.some((r) => r.status === "fulfilled")) {
        const { sections } = videoStore.getSnapshot();
        writeJson(CACHE_KEY, Object.fromEntries(sections.map((s) => [s.playlist, s.videos])));
      }
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// The next page of one section. A page that fails is marked, so the screen
// can say so and offer it again. A page that arrives after the list was
// replaced from somewhere else (it no longer starts where the list ends) is
// let go rather than appended with a gap before it.
const loadingMore = new Set();
export function loadMoreVideos(playlist) {
  const section = videoStore.getSnapshot().sections.find((s) => s.playlist === playlist);
  if (!section?.more || loadingMore.has(playlist)) return null;
  loadingMore.add(playlist);
  updateSection(playlist, () => ({ moreFailed: false }));
  const from = section.offset;
  return fetchPlaylist(playlist, from)
    .then(
      (page) =>
        updateSection(playlist, (old) => {
          if (old.offset !== from) return {};
          const ids = new Set(old.videos.map((v) => v.id));
          return {
            videos: [...old.videos, ...page.videos.filter((v) => !ids.has(v.id))],
            more: page.count === PAGE_SIZE,
            offset: from + page.count,
          };
        }),
      () => updateSection(playlist, () => ({ moreFailed: true })),
    )
    .finally(() => loadingMore.delete(playlist));
}

// The videos as they stand (the tests read it; screens use useVideos).
export const getVideos = () => videoStore.getSnapshot();

export const chooseVideoSection = (label) => videoStore.set((s) => ({ ...s, section: label }));

export function useVideos() {
  useEveryShow(loadVideos, []);
  return useSyncExternalStore(videoStore.subscribe, videoStore.getSnapshot);
}

// What Favorites keeps of a video: enough to list it and open it again.
export const savedVideoItem = (video) => ({
  id: video.id,
  name: video.name,
  artist: video.artist,
  detail: video.detail,
  poster: video.poster,
  duration: video.duration,
  published: video.published,
  tags: video.tags,
});
