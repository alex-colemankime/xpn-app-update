import { useEffect, useMemo, useState } from "react";
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
  const dismissed = useLocalStore(dismissedStore);
  const now = useNow();

  useEffect(() => {
    let controller = null;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      loadUpdates(controller.signal).then(setPosted, () => {
        /* keep what we have */
      });
      loadLivestream(controller.signal).then(setLivestream, () => {
        /* keep what we have */
      });
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Posted updates come first, so a live video the station posts itself wins.
  const updates = useMemo(
    () => (livestream ? [...posted, livestream] : posted),
    [posted, livestream],
  );
  // Recomputed with the clock, but the same objects come back while nothing
  // changes, so screens that receive them do not re-render.
  const { banner, live } = activeUpdates(updates, now);
  // Keyed on content as well as id, so a corrected banner (same id, fixed
  // text or link) replaces the old one without a restart.
  const bannerKey = banner && !dismissed.includes(banner.id) ? JSON.stringify(banner) : "";
  const liveKey = live ? JSON.stringify(live) : "";
  return useMemo(
    () => ({
      banner: bannerKey ? banner : null,
      live: liveKey ? live : null,
      liveDismissed: Boolean(live && dismissed.includes(live.id)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bannerKey, liveKey, dismissed],
  );
}
