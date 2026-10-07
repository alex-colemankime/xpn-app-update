// The audio archive: past broadcasts listeners can play on demand. xpn.org
// already lists each archived show's recent broadcasts on its show page (from
// StreamGuys), so the app reads them from there and the station publishes
// nothing new; a podcast feed (standard RSS with audio enclosures) works as a
// source too. The sources are in config.js (VITE_XPN_ARCHIVE_FEEDS).
//
//   - xpn.org's pages allow cross-origin reads, so the browser preview loads
//     the real archive; the phone apps read with native networking anyway.
//   - The audio links on xpn.org are signed, so they are always taken fresh
//     from the page, never stored in the app.
// Audio plays in an <audio> element, which needs no CORS at all.
//
// An episode: { id, show, title, date, duration, audio, image, summary, page,
// aired, feature } where `show` is a show id from the catalog, `date` an ISO
// time (when it aired, as near as is known), `duration` seconds (or null
// until the file reports it), `aired` the slot it filled ("6am–10am") and
// `feature` who it was about, when the archive names someone.

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { useEveryShow } from "./hooks/useEveryShow.js";
import { ARCHIVE_FEEDS } from "./config.js";
import { SHOWS } from "./catalog.js";
import { decodeEntities, plainText, webUrl } from "./text.js";
import { withTimeout } from "./net.js";
import { createStore, readJson, writeJson } from "./storage.js";
import { clockLabel, easternParts, easternToEpoch, parseDuration } from "./time.js";

const PER_FEED = 40;

// Feed text: CDATA unwrapped, then as plain text.
const plain = (value) =>
  plainText(String(value ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));

const escapeTag = (name) => name.replace(/[:]/g, "\\:");
const tagText = (xml, name) =>
  new RegExp(`<${escapeTag(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeTag(name)}>`, "i").exec(
    xml,
  )?.[1] ?? "";
const tagAttr = (xml, name, attr) =>
  decodeEntities(
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
    webUrl(tagAttr(channel, "itunes:image", "href")) ||
    webUrl(plain(tagText(tagText(channel, "image"), "url")));
  const items = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items
    .map((item) => {
      const audio = webUrl(tagAttr(item, "enclosure", "url"));
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
        image: webUrl(tagAttr(item, "itunes:image", "href")) || channelImage,
        summary: summaryOf(tagText(item, "description") || tagText(item, "itunes:summary")),
        page: webUrl(plain(tagText(item, "link"))),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PER_FEED);
}

// A show page's archive on xpn.org: one element per broadcast, carrying
//   data-track-url    the audio (signed)
//   data-track-title  "Sleepy Hollow - 10.04.2026", "… - 08.28.26 (Tim Curry)"
//                     or a feature's title, "Friko on World Cafe"
//   data-track-guid   a stable id
// A dated title becomes the day it aired ("Sunday, October 4"), placed in the
// show's slot that day; a feature keeps its name, dated by the file's upload
// stamp (20261002065218_…). The same broadcast listed twice appears once.
const BROADCAST_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});
const pad2 = (n) => String(n).padStart(2, "0");
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageAttr = (tag, name) =>
  decodeEntities(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? "");

function validDay(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function parseArchivePage(html, { show, name = "", schedule = [], page = "" }) {
  const tags =
    String(html ?? "").match(/<[a-z]+\b[^>]*\sdata-track-url\s*=\s*"[^"]*"[^>]*>/gi) || [];
  const seen = new Set();
  const episodes = [];
  for (const tag of tags) {
    const audio = webUrl(pageAttr(tag, "data-track-url"));
    const raw = plain(pageAttr(tag, "data-track-title"));
    if (!audio || !raw) continue;
    const dated = /^(.*?)\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\s*(?:\((.+)\))?\s*$/.exec(
      raw,
    );
    const stamp = /\/(\d{4})(\d{2})(\d{2})\d{6}_[^/]*$/.exec(new URL(audio).pathname);
    const [y, m, d] = dated
      ? [
          Number(dated[4].length === 2 ? `20${dated[4]}` : dated[4]),
          Number(dated[2]),
          Number(dated[3]),
        ]
      : stamp
        ? [Number(stamp[1]), Number(stamp[2]), Number(stamp[3])]
        : [];
    if (!y || !validDay(y, m, d)) continue;
    const day = `${y}-${pad2(m)}-${pad2(d)}`;
    const weekday = easternParts(new Date(`${day}T16:00:00Z`)).day;
    const slot = schedule.find((s) => s.days?.includes(weekday));
    const at = (slot && easternToEpoch(day, slot.start)) ?? Date.parse(`${day}T16:00:00Z`);
    const title = dated
      ? BROADCAST_DAY.format(new Date(`${day}T12:00:00Z`))
      : raw.replace(new RegExp(`\\s*on\\s*${escapeRegExp(name)}\\s*$`, "i"), "").trim() || raw;
    const feature = dated ? plain(dated[5] || "") : "";
    const key = `${title}|${feature}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const guid = pageAttr(tag, "data-track-guid") || audio.split("?")[0];
    episodes.push({
      id: `${show}-${shortHash(guid)}`,
      show,
      title,
      feature,
      date: new Date(at).toISOString(),
      duration: null,
      audio,
      image: "",
      summary: "",
      page,
      aired: dated && slot ? `${clockLabel(slot.start)}–${clockLabel(slot.end)}` : "",
    });
  }
  return episodes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, PER_FEED);
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
        webUrl(e.audio) &&
        Number.isFinite(Date.parse(e.date)),
    )
    .map((e) => ({
      ...e,
      audio: webUrl(e.audio),
      image: webUrl(e.image),
      page: webUrl(e.page),
      duration: Number.isFinite(e.duration) ? e.duration : null,
      summary: typeof e.summary === "string" ? e.summary : "",
      aired: typeof e.aired === "string" ? e.aired : "",
      feature: typeof e.feature === "string" ? e.feature : "",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function readSource(url, signal) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      responseType: "text",
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Archive: HTTP ${response.status}`);
    }
    return String(response.data ?? "");
  }
  const response = await fetch(url, { signal: withTimeout(signal, 12000) });
  if (!response.ok) throw new Error(`Archive: HTTP ${response.status}`);
  return response.text();
}

// One source's episodes: a podcast feed, or an xpn.org show page. The show's
// own artwork stands for each episode (the archive's is a generic image).
export function parseSource(text, show) {
  const info = SHOWS[show] || {};
  const episodes = /<rss[\s>]/i.test(text)
    ? parsePodcastFeed(text, show)
    : parseArchivePage(text, { show, name: info.name, schedule: info.schedule, page: "" });
  return episodes.map((e) => ({ ...e, image: e.image || info.img || "" }));
}

// Resolves to { episodes, source } where source is "live" or "error" (when
// no source could be read at all).
async function fetchArchive(signal, feeds = ARCHIVE_FEEDS) {
  const results = await Promise.all(
    feeds.map((feed) =>
      readSource(feed.url, signal).then(
        (text) => parseSource(text, feed.show),
        () => null,
      ),
    ),
  );
  const loaded = results.filter(Boolean);
  if (!loaded.length) return { episodes: [], source: "error" };
  return {
    episodes: loaded.flat().sort((a, b) => b.date.localeCompare(a.date)),
    source: "live",
  };
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
  useEveryShow(loadArchive, []);
  return useSyncExternalStore(archiveStore.subscribe, archiveStore.getSnapshot);
}

// One show's archive episodes.
export const episodesOf = (archive, showId) => archive.episodes.filter((e) => e.show === showId);
