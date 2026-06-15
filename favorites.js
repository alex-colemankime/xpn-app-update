import { useCallback, useMemo } from "react";
import { createLocalStore, useLocalStore } from "./storage.js";

const FAVORITES_KEY = "xpn.favorites.v1";
const EMPTY_FAVORITES = { songs: {}, shows: {} };

const normalizeFavorites = (value) => ({
  songs: value?.songs && typeof value.songs === "object" ? value.songs : {},
  shows: value?.shows && typeof value.shows === "object" ? value.shows : {},
});

const favoritesStore = createLocalStore(
  FAVORITES_KEY,
  EMPTY_FAVORITES,
  normalizeFavorites
);

export function songId(song) {
  return (
    song.id ||
    `${song.artist || ""}|${song.title || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

export function useFavorites(type) {
  const store = useLocalStore(favoritesStore);
  const bucket = store[type] || {};

  const items = useMemo(
    () => Object.values(bucket).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)),
    [bucket]
  );
  const isSaved = useCallback((id) => Boolean(bucket[id]), [bucket]);
  const toggle = useCallback((item) => {
    const id = type === "songs" ? songId(item) : item.id;
    if (!id) return;

    favoritesStore.set((current) => {
      const currentBucket = current[type] || {};
      const nextBucket = { ...currentBucket };

      if (nextBucket[id]) delete nextBucket[id];
      else nextBucket[id] = { ...item, id, savedAt: Date.now() };

      return { ...current, [type]: nextBucket };
    });
  }, [type]);

  return {
    items,
    isSaved,
    toggle,
  };
}
