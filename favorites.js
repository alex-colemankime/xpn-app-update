import { useMemo, useSyncExternalStore } from "react";
import { createLocalStore, readJson, useLocalStore, writeJson } from "./storage.js";

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

// What each saved item needs to be shown. Anything else (from a damaged or
// hand-edited store) is dropped rather than allowed to break a screen.
const VALID = {
  songs: (item) => isText(item.title) && isText(item.artist),
  shows: (item) => isText(item.id) && isText(item.name),
  episodes: (item) => isText(item.id) && isText(item.title),
  concerts: (item) => isText(item.id) && isText(item.artist) && isText(item.date),
  videos: (item) => isText(item.id) && isText(item.name),
};
export const FAVORITE_TYPES = Object.keys(VALID);

const keyFor = (type, item) => (type === "songs" ? songId(item) : item.id);

// Repairs a bucket. A bucket that needs no repair comes back as the same
// object, so saving a song doesn't hand every list of shows, episodes and
// concerts a new object (and re-render it).
function cleanBucket(type, bucket) {
  if (!isObject(bucket)) return {};
  const clean = {};
  let changed = false;
  for (const [key, item] of Object.entries(bucket)) {
    if (!isObject(item) || !VALID[type](item)) {
      changed = true;
      continue;
    }
    // Songs are re-keyed, which also carries over saves made under the older,
    // Latin-only id scheme.
    const id = keyFor(type, item);
    if (!id) {
      changed = true;
      continue;
    }
    if (id !== key || item.id !== id) changed = true;
    clean[id] = item.id === id ? item : { ...item, id };
  }
  return changed ? clean : bucket;
}

// Original key, so favorites saved by earlier versions carry over.
const favoritesStore = createLocalStore("xpn.favorites.v1", {}, (value) =>
  Object.fromEntries(FAVORITE_TYPES.map((type) => [type, cleanBucket(type, value?.[type])])),
);

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
