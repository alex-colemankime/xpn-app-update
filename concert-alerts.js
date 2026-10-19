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

// An artist's name as it can be compared: no case, accents, a leading
// "The", or punctuation, which simply goes ("R.E.M." is "REM"); a hyphen or
// slash parts words; "&" and "and" alike; letters of any script kept
// ("宇多田ヒカル"). "The Beths" and "Beths" match; "Bright Eyes" and
// "Bright Eyes & Friends" do not. Pure.
export function artistKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&|\+/g, " and ")
    .replace(/[-\u2010-\u2015/_]+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// Names split from a credit: "A feat. B", "A, B", "A / B". Names joined by
// "&" stay whole: "Hall & Oates" is one act.
const CREDITS = /\s+(?:feat\.?|ft\.?|featuring|with|x)\s+|\s*[,/]\s*/i;

// The names a song's artist line stands for, each as [key, the name as
// written]: the whole line, and each artist credited on it. An alert names
// the act that matched ("Conor Oberst"), not the whole credit line.
function songArtists(line) {
  return [line, ...String(line || "").split(CREDITS)]
    .map((name) => [artistKey(name), String(name || "").trim()])
    .filter(([key]) => key);
}

// The acts on a concert's bill, as compared: each act, each without a
// parenthetical or a backing band ("Jillian Ashcraft & Her Band"), and the
// performers a parenthetical features ("John Scofield's Electrospective
// (feat. Adam Deitch / Oteil Burbridge)").
function billArtists(title) {
  const { headliner, support } = splitBill(title);
  return [headliner, ...support].flatMap((act) => {
    const plain = act
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s+(?:&|and)\s+(?:his|her|their|the)\s+.+$/i, "");
    const featured = [...act.matchAll(/\((?:feat\.?|ft\.?|featuring|with)\s+([^)]*)\)/gi)].flatMap(
      ([, names]) => names.split(/\s*(?:[,/]|&|\band\b)\s*/i),
    );
    return [act, plain, ...featured].map(artistKey).filter(Boolean);
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
  seen: Array.isArray(v?.seen) ? v.seen.filter((id) => typeof id === "string") : null,
}));
export const useConcertAlertSettings = () => useLocalStore(store);
export const setConcertAlerts = (enabled) => store.set((s) => ({ ...s, enabled }));

// What to announce from a fresh calendar: the matches not announced before,
// and the ids to remember. A concert is remembered for as long as it is on
// the calendar (`onCalendar`, every upcoming concert's id), never by count,
// so one is never announced twice however many there are. Pure.
export function newMatches(matches, seen, onCalendar = null) {
  const known = new Set(seen || []);
  const fresh = matches.filter((m) => !known.has(m.concert.id));
  const kept = onCalendar ? [...known].filter((id) => onCalendar.has(id)) : [...known];
  return {
    fresh,
    first: seen === null,
    seen: [...kept, ...fresh.map((m) => m.concert.id)],
  };
}

// Records what was announced, and returns what to announce now. Written
// only when there is something to remember, so a check that finds nothing
// new doesn't touch storage or wake the screens that read it.
export function takeNewMatches(matches, onCalendar) {
  const before = store.getSnapshot().seen;
  const { fresh, first, seen } = newMatches(matches, before, onCalendar);
  if (fresh.length || first || seen.length !== before.length) store.set((s) => ({ ...s, seen }));
  return { fresh, first };
}

// "Show only artists you like" on Concerts, as a store, so an alert's View
// can turn it on from anywhere. For this session only, as the other filters.
const likedOnly = createStore(false);
export const useLikedOnly = () => useSyncExternalStore(likedOnly.subscribe, likedOnly.getSnapshot);
export const setLikedOnly = (on) => likedOnly.set(on);

// An alert's View: Concerts with only artists you like, and every other
// filter let go (a search or a date left from before could hide the very
// concert announced). Concerts clears its own filters when this count
// moves.
const likedView = createStore(0);
export const useLikedViewRequest = () =>
  useSyncExternalStore(likedView.subscribe, likedView.getSnapshot);
export function showLikedConcerts() {
  likedOnly.set(true);
  likedView.set((n) => n + 1);
}
