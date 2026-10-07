import { useMemo, useSyncExternalStore } from "react";
import { createLocalStore, readJson, useLocalStore, writeJson } from "./storage.js";
import { webUrl } from "./text.js";

// Songs have no feed id, so artist + title is the identity. Letters and digits
// from any script count, so "봄날" and "작은 것들을 위한 시" by the same artist
// stay distinct; accents are folded, so "Beyoncé" and "Beyonce" match.
export function songId(song) {
  return `${song.artist || ""}|${song.title || ""}`
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim() !== "";

// --- What each saved item may hold ---------------------------------------
// Every field a screen reads, of the type it expects. Saved items come back
// from the device, where an older version, another tab or a hand edit may
// have left anything; each is rebuilt from these rules (unknown fields
// dropped, damaged optional ones emptied), or dropped when what identifies
// it is missing, so nothing stored can break a screen.

const text = (value, max = 600) => (typeof value === "string" ? value.slice(0, max) : "");
const texts = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, 50) : [];
const number = (value) => (Number.isFinite(value) ? value : null);
const savedAt = (value) => (Number.isFinite(value) ? value : 0);
const when = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "";
// A calendar day, "2026-10-07", that exists.
export function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : "";
}
// A web address, or a path to one of the app's own images ("/shows/x.jpg").
const image = (value) =>
  webUrl(value, { http: true }) ||
  (typeof value === "string" && /^\/?[\w-]+(\/[\w.-]+)+$/.test(value) ? value : "");
const link = (value) => webUrl(value, { http: true });
const clock = (value) => (typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "");

const SCHEMA = {
  songs: (i) =>
    isText(i.title) &&
    isText(i.artist) && {
      title: text(i.title, 300),
      artist: text(i.artist, 300),
      album: text(i.album, 300),
      img: image(i.img),
      date: calendarDay(i.date),
      time: clock(i.time),
    },
  shows: (i) =>
    isText(i.id) &&
    isText(i.name) && {
      id: i.id,
      name: text(i.name, 200),
      host: text(i.host, 200),
      img: image(i.img),
      desc: text(i.desc, 2000),
      page: link(i.page),
      times: texts(i.times),
      ...(isObject(i.tint) && typeof i.tint.light === "string" && typeof i.tint.dark === "string"
        ? { tint: { light: i.tint.light, dark: i.tint.dark } }
        : {}),
    },
  // No audio link: those run out, so playing reads a fresh one (archive.js).
  episodes: (i) =>
    isText(i.id) &&
    isText(i.title) && {
      id: i.id,
      show: text(i.show || i.showId, 100),
      showId: text(i.showId || i.show, 100),
      showName: text(i.showName, 200),
      title: text(i.title, 300),
      date: when(i.date),
      duration: number(i.duration),
      image: image(i.image),
      img: image(i.img || i.image),
      summary: text(i.summary, 1000),
      page: link(i.page),
      aired: text(i.aired, 40),
      feature: text(i.feature, 200),
    },
  concerts: (i) =>
    isText(i.id) &&
    isText(i.artist) &&
    calendarDay(i.date) && {
      id: i.id,
      artist: text(i.artist, 300),
      date: i.date,
      venue: text(i.venue, 200),
      city: text(i.city, 100),
      region: text(i.region, 100),
      regions: texts(i.regions),
      age: text(i.age, 40),
      xpnWelcomes: i.xpnWelcomes === true,
      freeAtNoon: i.freeAtNoon === true,
      ticketUrl: link(i.ticketUrl),
      pageUrl: link(i.pageUrl),
      image: link(i.image),
    },
  videos: (i) =>
    typeof i.id === "string" &&
    /^\d+$/.test(i.id) &&
    isText(i.name) && {
      id: i.id,
      name: text(i.name, 300),
      artist: text(i.artist, 300),
      detail: text(i.detail, 300),
      poster: link(i.poster),
      duration: number(i.duration),
      published: when(i.published),
      tags: texts(i.tags),
    },
};
const FAVORITE_TYPES = Object.keys(SCHEMA);

const keyFor = (type, item) => (type === "songs" ? songId(item) : item.id);

// One saved item as the rules allow it, or null. An item that needs no
// repair comes back as the same object.
const checked = new WeakSet();
function cleanItem(type, item) {
  if (!isObject(item)) return null;
  if (checked.has(item)) return item;
  const fields = SCHEMA[type](item);
  if (!fields) return null;
  const clean = { ...fields, savedAt: savedAt(item.savedAt) };
  const id = keyFor(type, clean);
  if (!id) return null;
  clean.id = id;
  const same =
    Object.keys(item).length === Object.keys(clean).length &&
    JSON.stringify(item) ===
      JSON.stringify(Object.fromEntries(Object.keys(item).map((k) => [k, clean[k]])));
  const result = same ? item : clean;
  checked.add(result);
  return result;
}

// Repairs a bucket. A bucket that needs no repair comes back as the same
// object, so saving a song doesn't hand every list of shows, episodes and
// concerts a new object (and re-render it).
function cleanBucket(type, bucket) {
  if (!isObject(bucket)) return {};
  const clean = {};
  let changed = false;
  for (const [key, item] of Object.entries(bucket)) {
    const repaired = cleanItem(type, item);
    if (!repaired) {
      changed = true;
      continue;
    }
    // Songs are re-keyed, which also carries over saves made under the older,
    // Latin-only id scheme.
    if (repaired !== item || repaired.id !== key) changed = true;
    clean[repaired.id] = repaired;
  }
  return changed ? clean : bucket;
}

// Original key, so favorites saved by earlier versions carry over.
const FAVORITES_KEY = "xpn.favorites.v1";
const favoritesStore = createLocalStore(FAVORITES_KEY, {}, (value) =>
  Object.fromEntries(FAVORITE_TYPES.map((type) => [type, cleanBucket(type, value?.[type])])),
);
// Whatever was repaired on reading is saved at once, so a damaged record (or
// an old episode's audio link) doesn't linger on the device.
if (JSON.stringify(readJson(FAVORITES_KEY, {})) !== JSON.stringify(favoritesStore.getSnapshot())) {
  writeJson(FAVORITES_KEY, favoritesStore.getSnapshot());
}

// For modules outside React (playlist sync): saved songs, newest first.
export const subscribeFavorites = favoritesStore.subscribe;
export const getSavedSongs = () =>
  Object.values(favoritesStore.getSnapshot().songs).sort(
    (a, b) => (b.savedAt || 0) - (a.savedAt || 0),
  );

// Saved items of one type, newest first.
export function useFavoriteItems(type) {
  const bucket = useLocalStore(favoritesStore)[type];
  return useMemo(
    () => Object.values(bucket).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)),
    [bucket],
  );
}

// Whether one item is saved. Subscribes to a boolean, so a heart button only
// re-renders when its own item changes, not when anything else is saved.
export function useIsFavorite(type, item) {
  const id = keyFor(type, item);
  return useSyncExternalStore(favoritesStore.subscribe, () =>
    Boolean(id && favoritesStore.getSnapshot()[type][id]),
  );
}

// The saved record for an item, if any (to put it back after an undo).
export const getFavorite = (type, item) =>
  favoritesStore.getSnapshot()[type][keyFor(type, item)] || null;

// Puts a removed record back exactly as it was, in its old place in the list.
export function restoreFavorite(type, record) {
  if (!record?.id) return;
  favoritesStore.set((current) => ({
    ...current,
    [type]: { ...current[type], [record.id]: record },
  }));
}

export function toggleFavorite(type, item) {
  const id = keyFor(type, item);
  if (!id) return;
  favoritesStore.set((current) => {
    const bucket = { ...current[type] };
    if (bucket[id]) delete bucket[id];
    else bucket[id] = { ...item, id, savedAt: Date.now() };
    return { ...current, [type]: bucket };
  });
}

// Earlier versions saved concerts as bare ids under their own key, so a save
// could only be shown while the same listing was in the feed. When a feed
// loads, any of those it still lists move into Favorites with their details.
const LEGACY_CONCERTS_KEY = "xpn.savedConcerts";
export function adoptLegacyConcerts(concerts) {
  const legacy = readJson(LEGACY_CONCERTS_KEY, []);
  if (!Array.isArray(legacy) || !legacy.length) return;
  const found = concerts.filter((c) => legacy.includes(c.id));
  if (!found.length) return;
  favoritesStore.set((current) => {
    const bucket = { ...current.concerts };
    for (const c of found) bucket[c.id] ||= { ...c, savedAt: Date.now() };
    return { ...current, concerts: bucket };
  });
  writeJson(
    LEGACY_CONCERTS_KEY,
    legacy.filter((id) => !found.some((c) => c.id === id)),
  );
}
