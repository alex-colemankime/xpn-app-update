// Concerts by artists the listener likes: whenever the concert calendar
// loads or refreshes, its listings are checked against the artists of the
// songs the listener has saved, and a show not seen before is announced
// in the app ("Bright Eyes is coming to Union Transfer"), with a way to see
// every concert by an artist they like (Concerts › Filters).
//
// It runs in the app, so it hears about a new show the next time WXPN opens
// or refreshes the calendar (every few hours while open). An alert to a
// closed app would need the station's push service to send it (README,
// "Push notifications").

import { useSyncExternalStore } from "react";
import { createLocalStore, createStore, useLocalStore } from "./storage.js";
import { splitBill } from "./concerts.js";

// An artist's name as it can be compared: no accents, case, punctuation or
// a leading "The"; "&" and "and" alike. "The Beths" and "Beths" match;
// "Bright Eyes" and "Bright Eyes & Friends" do not. Pure.
export function artistKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&|\+/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// The names a song's artist line stands for: the whole line, and each
// artist credited on it ("Phoebe Bridgers feat. Conor Oberst", "A, B").
// Names joined by "&" stay whole: "Hall & Oates" is one act.
// Each as [key, the name as written], so an alert names the act that
// matched ("Conor Oberst"), not the whole credit line.
function songArtists(line) {
  const parts = String(line || "").split(/\s+(?:feat\.?|ft\.?|featuring|with|x)\s+|,\s*/i);
  return [line, ...parts]
    .map((name) => [artistKey(name), String(name || "").trim()])
    .filter(([key]) => key.length > 1);
}

// The acts on a concert's bill, as compared: each act, and each without a
// parenthetical or a backing band ("Jillian Ashcraft & Her Band").
function billArtists(title) {
  const { headliner, support } = splitBill(title);
  return [headliner, ...support].flatMap((act) => {
    const plain = act
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s+(?:&|and)\s+(?:his|her|their|the)\s+.+$/i, "");
    return [artistKey(act), artistKey(plain)];
  });
}

// The concerts with an artist the listener likes, each with the name of the
// act that matched, as the listener's saved song credits it. Pure, so it
// can be tested.
export function concertsByLikedArtists(concerts, songs) {
  const liked = new Map();
  for (const song of songs) {
    for (const [key, name] of songArtists(song.artist)) if (!liked.has(key)) liked.set(key, name);
  }
  if (!liked.size) return [];
  const found = [];
  for (const concert of concerts) {
    const key = billArtists(concert.artist).find((k) => liked.has(k));
    if (key) found.push({ concert, artist: liked.get(key) });
  }
  return found;
}

// On (the default) or off, and the concerts already announced, by id. Null
// until the first check, which announces what is already on the calendar
// once, as one notice, rather than one by one.
const store = createLocalStore("xpn.concertAlerts.v1", { enabled: true, seen: null }, (v) => ({
  enabled: v?.enabled !== false,
  seen: Array.isArray(v?.seen) ? v.seen.filter((id) => typeof id === "string").slice(-500) : null,
}));
export const useConcertAlertSettings = () => useLocalStore(store);
export const setConcertAlerts = (enabled) => store.set((s) => ({ ...s, enabled }));

// What to announce from a fresh calendar: the matches not announced before,
// and the ids to remember. Pure.
export function newMatches(matches, seen) {
  const known = new Set(seen || []);
  const fresh = matches.filter((m) => !known.has(m.concert.id));
  return {
    fresh,
    first: seen === null,
    seen: [...known, ...fresh.map((m) => m.concert.id)],
  };
}

// Records what was announced, and returns what to announce now.
export function takeNewMatches(matches) {
  const { fresh, first, seen } = newMatches(matches, store.getSnapshot().seen);
  // Written only when there is something to remember, so a check that finds
  // nothing new doesn't touch storage or wake the screens that read it.
  if (fresh.length || first) store.set((s) => ({ ...s, seen }));
  return { fresh, first };
}

// "Show only artists you like" on Concerts, as a store, so an alert's View
// can turn it on from anywhere. For this session only, as the other filters.
const likedOnly = createStore(false);
export const useLikedOnly = () => useSyncExternalStore(likedOnly.subscribe, likedOnly.getSnapshot);
export const setLikedOnly = (on) => likedOnly.set(on);
