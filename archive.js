// The audio archive: past episodes listeners can play on demand, read from
// the shows' podcast feeds (standard RSS with audio enclosures), so the
// station publishes nothing new for it. World Cafe's NPR podcast is the
// default feed; VITE_XPN_ARCHIVE_FEEDS lists others (see config.js).
//
//   - In the phone apps the feeds are read with native networking, which no
//     browser cross-origin rule applies to.
//   - In a browser a feed can only be read if its server allows it (CORS).
//     NPR's does not, so preview builds fall back to a snapshot of recent
//     episodes (samples.js); a production web build needs the feed served
//     with CORS or through a proxy on xpn.org.
// Audio plays in an <audio> element, which needs no CORS at all.
//
// An episode: { id, show, title, date, duration, audio, image, summary, page }
// where `show` is a show id from the catalog, `date` an ISO date, and
// `duration` seconds (or null).

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { useEffect, useSyncExternalStore } from "react";
import { ARCHIVE_FEEDS, SHOW_SAMPLES } from "./config.js";
import { decodeFeedText } from "./feed-text.js";
import { withTimeout } from "./net.js";
import { createStore, readJson, writeJson } from "./storage.js";

const PER_FEED = 40;

// "2247", "37:27" or "1:02:03" as seconds; null when missing or odd.
export function parseDuration(text) {
  const parts = String(text ?? "")
    .trim()
    .split(":");
  if (!parts[0] || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  return seconds > 0 ? seconds : null;
}

// "37 min", "1 hr 4 min", for a length in seconds.
export function lengthLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// "4:05", "1:02:03", for a playback position in seconds.
export function clockTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

const safeHttps = (value) => {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

// Feed text: CDATA unwrapped, tags removed, entities decoded, spaces tidied.
const plain = (value) =>
  decodeFeedText(
    String(value ?? "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

const escapeTag = (name) => name.replace(/[:]/g, "\\:");
const tagText = (xml, name) =>
  new RegExp(`<${escapeTag(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeTag(name)}>`, "i").exec(
    xml,
  )?.[1] ?? "";
const tagAttr = (xml, name, attr) =>
  decodeFeedText(
    new RegExp(`<${escapeTag(name)}\\b[^>]*\\s${attr}\\s*=\\s*"([^"]*)"`, "i").exec(xml)?.[1] ?? "",
  );

// A short, stable id from a feed's guid, for saving and resuming.
function shortHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// The first sentence or so of a description, for the episode sheet.
function summaryOf(text) {
  const s = plain(text);
  if (s.length <= 280) return s;
  const cut = s.slice(0, 280);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" ")))}…`;
}

// A podcast feed's episodes, newest first. A regular-expression reader rather
// than DOMParser, so it runs the same in tests and in every web view; podcast
// RSS is regular enough for it, and anything unusable is skipped.
export function parsePodcastFeed(xml, show) {
  const text = String(xml ?? "");
  const firstItem = text.search(/<item[\s>]/i);
  const channel = firstItem >= 0 ? text.slice(0, firstItem) : text;
  const channelImage =
    safeHttps(tagAttr(channel, "itunes:image", "href")) ||
    safeHttps(plain(tagText(tagText(channel, "image"), "url")));
  const items = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items
    .map((item) => {
      const audio = safeHttps(tagAttr(item, "enclosure", "url"));
      const type = tagAttr(item, "enclosure", "type");
      const title = plain(tagText(item, "title"));
      const at = Date.parse(plain(tagText(item, "pubDate")));
      if (!audio || !title || !Number.isFinite(at) || (type && !/^audio\//i.test(type))) {
        return null;
      }
      const guid = plain(tagText(item, "guid")) || audio;
      return {
        id: `${show}-${shortHash(guid)}`,
        show,
        title,
        date: new Date(at).toISOString(),
        duration: parseDuration(plain(tagText(item, "itunes:duration"))),
        audio,
        image: safeHttps(tagAttr(item, "itunes:image", "href")) || channelImage,
        summary: summaryOf(tagText(item, "description") || tagText(item, "itunes:summary")),
        page: safeHttps(plain(tagText(item, "link"))),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PER_FEED);
}

// Episodes from the cache or a snapshot, checked the same way as a feed's.
export function normalizeEpisodes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        typeof e.show === "string" &&
        safeHttps(e.audio) &&
        Number.isFinite(Date.parse(e.date)),
    )
    .map((e) => ({
      ...e,
      audio: safeHttps(e.audio),
      image: safeHttps(e.image),
      page: safeHttps(e.page),
      duration: Number.isFinite(e.duration) ? e.duration : null,
      summary: typeof e.summary === "string" ? e.summary : "",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function readFeed(url, signal) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      responseType: "text",
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Archive feed: HTTP ${response.status}`);
    }
    return String(response.data ?? "");
  }
  const response = await fetch(url, { signal: withTimeout(signal, 12000) });
  if (!response.ok) throw new Error(`Archive feed: HTTP ${response.status}`);
  return response.text();
}

// Resolves to { episodes, source } where source is "live" (from the feeds),
// "sample" (the preview's snapshot) or "error".
export async function fetchArchive(signal, feeds = ARCHIVE_FEEDS) {
  const results = await Promise.all(
    feeds.map((feed) =>
      readFeed(feed.url, signal).then(
        (xml) => parsePodcastFeed(xml, feed.show),
        () => null,
      ),
    ),
  );
  const loaded = results.filter(Boolean);
  if (loaded.length) {
    return {
      episodes: loaded.flat().sort((a, b) => b.date.localeCompare(a.date)),
      source: "live",
    };
  }
  if (SHOW_SAMPLES) {
    const { SAMPLE_ARCHIVE } = await import("./samples.js");
    return { episodes: normalizeEpisodes(SAMPLE_ARCHIVE), source: "sample" };
  }
  return { episodes: [], source: "error" };
}

// Shared by every screen that shows episodes: loaded once when first needed,
// refreshed when stale, and the last good list kept for offline use.
const CACHE_KEY = "xpn.archive.cache";
const STALE_MS = 60 * 60000;
const cached = readJson(CACHE_KEY, null);
const archiveStore = createStore({
  episodes: normalizeEpisodes(cached?.episodes),
  source: cached?.episodes?.length ? "cache" : "loading",
  loadedAt: 0,
});
let inflight = null;

export function loadArchive({ force = false } = {}) {
  const state = archiveStore.getSnapshot();
  if (!ARCHIVE_FEEDS.length || inflight) return inflight;
  if (!force && state.loadedAt && Date.now() - state.loadedAt < STALE_MS) return null;
  if (force && !state.episodes.length) archiveStore.set({ ...state, source: "loading" });
  inflight = fetchArchive()
    .then((result) => {
      if (result.source === "error" && archiveStore.getSnapshot().episodes.length) {
        // Keep the list on screen; it is only out of date.
        archiveStore.set((s) => ({ ...s, source: "cache", loadedAt: Date.now() }));
        return;
      }
      if (result.source === "live") writeJson(CACHE_KEY, { episodes: result.episodes });
      archiveStore.set({ ...result, loadedAt: Date.now() });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useArchive() {
  useEffect(() => {
    loadArchive();
    const onVisible = () => document.visibilityState === "visible" && loadArchive();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return useSyncExternalStore(archiveStore.subscribe, archiveStore.getSnapshot);
}

// One show's archive episodes.
export const episodesOf = (archive, showId) => archive.episodes.filter((e) => e.show === showId);
