import { useEffect, useState } from "react";
import { LIVESTREAM_PAGE_URL, SHOW_SAMPLES, UPDATES_URL } from "../config.js";
import {
  LIVE_ANNOUNCE_MINUTES,
  activeUpdates,
  livestreamUpdate,
  normalizeUpdates,
} from "../updates.js";
import { airingSoon } from "../catalog.js";
import { withTimeout } from "../net.js";
import { createLocalStore, readJson, useLocalStore, writeJson } from "../storage.js";
import { useNow } from "./useNow.js";

// Station updates (see updates.js): fetched at launch, whenever the app comes
// back to the front, and every few minutes while it is open. The last good
// file is kept, so a banner survives a moment offline.
const CACHE_KEY = "xpn.updates.cache";
const REFRESH_MS = 5 * 60000;

const dismissedStore = createLocalStore("xpn.updates.dismissed", [], (value) =>
  Array.isArray(value) ? value.filter((id) => typeof id === "string").slice(-50) : [],
);
export const dismissUpdate = (id) =>
  dismissedStore.set((ids) => (ids.includes(id) ? ids : [...ids, id]));

// A value with the same content as the last one is kept as the same object,
// so screens that receive it don't re-render and effects keyed on it don't
// re-run.
const sameContent = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const keepIfSame = (next) => (prev) => (sameContent(prev, next) ? prev : next);
function useSameContent(value) {
  const [kept, setKept] = useState(value);
  if (sameContent(kept, value)) return kept;
  setKept(value);
  return value;
}

async function loadUpdates(signal) {
  if (!UPDATES_URL) {
    if (!SHOW_SAMPLES) return [];
    const { SAMPLE_UPDATES } = await import("../samples.js");
    return normalizeUpdates(SAMPLE_UPDATES);
  }
  const response = await fetch(UPDATES_URL, { signal: withTimeout(signal), cache: "no-store" });
  if (!response.ok) throw new Error(`Updates: HTTP ${response.status}`);
  const json = await response.json();
  writeJson(CACHE_KEY, json);
  return normalizeUpdates(json);
}

// Around each Free at Noon, the week's video from xpn.org's livestream page.
async function loadLivestream(signal) {
  const airing = LIVESTREAM_PAGE_URL && airingSoon("freeatnoon", LIVE_ANNOUNCE_MINUTES);
  if (!airing) return null;
  const response = await fetch(LIVESTREAM_PAGE_URL, {
    signal: withTimeout(signal),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return livestreamUpdate(await response.json(), airing);
}

export function useStationUpdates() {
  const [posted, setPosted] = useState(() => normalizeUpdates(readJson(CACHE_KEY, null)));
  const [livestream, setLivestream] = useState(null);
  // Whether the first check has finished, so a link to the live video isn't
  // judged "over" before the app has looked.
  const [loaded, setLoaded] = useState(false);
  const dismissed = useLocalStore(dismissedStore);
  const now = useNow();

  useEffect(() => {
    let controller = null;
    const listening = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const { signal } = (controller = new AbortController());
      const keep = () => {}; // a failed check keeps what we have
      const checks = [
        loadUpdates(signal).then((next) => setPosted(keepIfSame(next)), keep),
        loadLivestream(signal).then((next) => setLivestream(keepIfSame(next)), keep),
      ];
      // A check cut short by a newer one hasn't looked yet.
      Promise.all(checks).then(() => signal.aborted || setLoaded(true));
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh, { signal: listening.signal });
    return () => {
      controller?.abort();
      clearInterval(timer);
      listening.abort();
    };
  }, []);

  // Posted updates come first, so a live video the station posts itself
  // wins. Every update goes to the notifications planned ahead
  // (useStationAlerts).
  const all = livestream ? [...posted, livestream] : posted;
  // Recomputed with the clock; kept as the same objects while their content
  // is unchanged. Compared on content as well as id, so a corrected banner
  // (same id, fixed text or link) replaces the old one without a restart.
  const active = activeUpdates(all, now);
  const banner = useSameContent(
    active.banner && !dismissed.includes(active.banner.id) ? active.banner : null,
  );
  const live = useSameContent(active.live || null);
  return {
    banner,
    live,
    liveDismissed: Boolean(live && dismissed.includes(live.id)),
    all,
    loaded,
  };
}
