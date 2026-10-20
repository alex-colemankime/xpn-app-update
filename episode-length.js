// How long an archive episode runs, before anyone plays it. A dated
// broadcast knows from its slot in the schedule (archive.js slotLength); a
// feature names no slot (World Cafe's sessions, "Friko on World Cafe"), and
// xpn.org's page gives no length, so the file itself is asked: an <audio>
// element set to read only the file's header (preload="metadata"), one
// episode at a time. What it says is kept by episode id, so each file is
// read once, and a saved episode in Favorites (which keeps no audio link)
// still shows its length.
import { useEffect, useSyncExternalStore } from "react";
import { createStore, readJson, writeJson } from "./storage.js";
import { linkIsFresh } from "./archive.js";

const KEY = "xpn.archive.lengths";
// Far more than the archive lists at once; the oldest go first.
const KEEP = 400;
const TIMEOUT_MS = 15000;

// Kept lengths: { [episode id]: seconds }, anything damaged left out.
export function normalizeLengths(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const kept = Object.entries(value).filter(([, s]) => Number.isFinite(s) && s > 0);
  return Object.fromEntries(kept.slice(-KEEP));
}

const store = createStore(normalizeLengths(readJson(KEY, null)));

export function rememberLength(id, seconds) {
  if (!id || !Number.isFinite(seconds) || seconds <= 0) return;
  const lengths = store.getSnapshot();
  if (lengths[id] === Math.round(seconds)) return;
  const next = normalizeLengths({ ...lengths, [id]: Math.round(seconds) });
  writeJson(KEY, next);
  store.set(next);
}

export const knownLength = (id) => store.getSnapshot()[id] || 0;

// Files asked about one at a time, and each link only once, so a list of
// episodes never opens a crowd of connections. A link that ran out is asked
// about again only once the archive has read a new one.
const queue = [];
const asked = new Set();
let busy = false;

function readHeader(url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let timer;
    let settled = false;
    const done = (seconds) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Let go of the file: nothing more of it is downloaded.
      audio.removeAttribute("src");
      audio.load();
      resolve(seconds);
    };
    timer = setTimeout(() => done(0), TIMEOUT_MS);
    audio.preload = "metadata";
    audio.muted = true;
    audio.addEventListener("loadedmetadata", () => done(audio.duration), { once: true });
    audio.addEventListener("error", () => done(0), { once: true });
    audio.src = url;
    audio.load();
  });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const { id, url } = queue.shift();
    if (knownLength(id)) continue;
    const seconds = await readHeader(url);
    if (Number.isFinite(seconds)) rememberLength(id, seconds);
  }
  busy = false;
}

// Reads an episode's length from its file, if it isn't known some other
// way. Not with Save-Data on, and only with a link still good to read.
export function requestLength(episode, { saveData = false, now = Date.now() } = {}) {
  const id = episode?.id;
  if (!id || knownLength(id) || saveData || !linkIsFresh(episode, now)) return false;
  if (asked.has(episode.audio) || typeof Audio === "undefined") return false;
  asked.add(episode.audio);
  queue.push({ id, url: episode.audio });
  pump();
  return true;
}

// An episode's length as its file reported it, asking the file when `ask`
// (the episode has no other way to know).
export function useEpisodeLength(episode, ask) {
  const id = episode?.id;
  useEffect(() => {
    if (ask)
      requestLength(episode, {
        saveData: Boolean(globalThis.navigator?.connection?.saveData),
      });
  }, [episode, ask]);
  return useSyncExternalStore(store.subscribe, () => (id ? store.getSnapshot()[id] || 0 : 0));
}
