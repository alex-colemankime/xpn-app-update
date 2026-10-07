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

import { useEffect, useSyncExternalStore } from "react";
import { VIDEO_ACCOUNT, VIDEO_PLAYER, VIDEO_SECTIONS } from "./config.js";
import { withTimeout } from "./net.js";
import { createStore, readJson, writeJson } from "./storage.js";

const API = "https://edge.api.brightcove.com/playback/v1/accounts";
const PLAYERS = "https://players.brightcove.net";
export const PAGE_SIZE = 48;

const clean = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const safeHttps = (value) => {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
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
  const full = clean(name);
  let artist = clean(performer);
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
  const name = clean(raw.name);
  if (!/^\d+$/.test(id) || !name) return null;
  const { artist, detail } = splitTitle(name, raw.custom_fields?.artist_performer);
  const published = Date.parse(raw.published_at || raw.created_at || "");
  return {
    id,
    name,
    artist,
    detail,
    description: clean(raw.long_description || raw.description).slice(0, 600),
    duration: Number(raw.duration) > 0 ? Math.round(Number(raw.duration) / 1000) : null,
    poster: safeHttps(raw.poster) || safeHttps(raw.thumbnail),
    published: Number.isFinite(published) ? new Date(published).toISOString() : null,
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => clean(t).toLowerCase()).filter(Boolean)
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
  `${PLAYERS}/${account}/${player}_default/index.html?videoId=${encodeURIComponent(id)}` +
  "&autoplay=play&playsinline=true&applicationId=wxpn-app";

// Searching what has loaded: artist, title, description and tags.
export function matchVideos(videos, query) {
  const q = clean(query).toLowerCase();
  if (!q) return videos;
  return videos.filter((v) =>
    `${v.artist} ${v.detail} ${v.description} ${v.tags.join(" ")}`.toLowerCase().includes(q),
  );
}

// ---- Loading -------------------------------------------------------------

let policyKey = "";
async function getPolicyKey(signal) {
  if (policyKey) return policyKey;
  const response = await fetch(`${PLAYERS}/${VIDEO_ACCOUNT}/${VIDEO_PLAYER}_default/config.json`, {
    signal: withTimeout(signal),
  });
  if (!response.ok) throw new Error(`Videos: player config HTTP ${response.status}`);
  const key = (await response.json())?.video_cloud?.policy_key;
  if (!key) throw new Error("Videos: the player has no policy key");
  policyKey = key;
  return key;
}

async function fetchPlaylist(playlist, offset = 0, signal) {
  const key = await getPolicyKey(signal);
  const response = await fetch(
    `${API}/${VIDEO_ACCOUNT}/playlists/${playlist}?limit=${PAGE_SIZE}&offset=${offset}`,
    { headers: { Accept: `application/json;pk=${key}` }, signal: withTimeout(signal) },
  );
  // A key the player has since replaced: read it again next time.
  if (response.status === 401 || response.status === 403) policyKey = "";
  if (!response.ok) throw new Error(`Videos: playlist HTTP ${response.status}`);
  return parsePlaylist(await response.json());
}

// One video, for a watch page opened from a link to a video no list holds.
export async function fetchVideo(id, signal) {
  const key = await getPolicyKey(signal);
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
// last good lists are kept for a moment offline.
const CACHE_KEY = "xpn.videos.cache";
const STALE_MS = 30 * 60000;
const cached = readJson(CACHE_KEY, null);
const fromCache = (playlist) =>
  (Array.isArray(cached?.[playlist]) ? cached[playlist] : []).filter(
    (v) => v && typeof v.id === "string" && typeof v.name === "string" && Array.isArray(v.tags),
  );
const videoStore = createStore({
  sections: VIDEO_SECTIONS.map((s) => ({ ...s, videos: fromCache(s.playlist), more: true })),
  section: VIDEO_SECTIONS[0]?.label || "",
  status: VIDEO_SECTIONS.some((s) => fromCache(s.playlist).length) ? "cache" : "loading",
  loadedAt: 0,
});
let inflight = null;

export function loadVideos({ force = false } = {}) {
  const state = videoStore.getSnapshot();
  if (!VIDEO_SECTIONS.length || inflight) return inflight;
  if (!force && state.loadedAt && Date.now() - state.loadedAt < STALE_MS) return null;
  if (force && !state.sections.some((s) => s.videos.length)) {
    videoStore.set({ ...state, status: "loading" });
  }
  inflight = Promise.all(
    VIDEO_SECTIONS.map((s) =>
      fetchPlaylist(s.playlist).then(
        (videos) => ({ ...s, videos, more: videos.length === PAGE_SIZE }),
        () => null,
      ),
    ),
  )
    .then((results) => {
      const loaded = results.filter(Boolean);
      if (!loaded.length) {
        videoStore.set((s) => ({ ...s, status: "error", loadedAt: Date.now() }));
        return;
      }
      writeJson(CACHE_KEY, Object.fromEntries(loaded.map((s) => [s.playlist, s.videos])));
      videoStore.set((s) => ({
        ...s,
        sections: s.sections.map((old) => loaded.find((n) => n.playlist === old.playlist) || old),
        status: "live",
        loadedAt: Date.now(),
      }));
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// The next page of one section.
const loadingMore = new Set();
export function loadMoreVideos(playlist) {
  const section = videoStore.getSnapshot().sections.find((s) => s.playlist === playlist);
  if (!section?.more || loadingMore.has(playlist)) return;
  loadingMore.add(playlist);
  fetchPlaylist(playlist, section.videos.length)
    .then(
      (page) =>
        videoStore.set((s) => ({
          ...s,
          sections: s.sections.map((old) => {
            if (old.playlist !== playlist) return old;
            const ids = new Set(old.videos.map((v) => v.id));
            return {
              ...old,
              videos: [...old.videos, ...page.filter((v) => !ids.has(v.id))],
              more: page.length === PAGE_SIZE,
            };
          }),
        })),
      () => {},
    )
    .finally(() => loadingMore.delete(playlist));
}

export const chooseVideoSection = (label) => videoStore.set((s) => ({ ...s, section: label }));

export function useVideos() {
  useEffect(() => {
    loadVideos();
    const onVisible = () => document.visibilityState === "visible" && loadVideos();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
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
