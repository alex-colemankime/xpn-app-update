// Features the station can turn off, and on again, while the app runs: the
// remote config's "off" list (remote-config.js) on top of what the build
// sets up (config.js). A switch reaches phones with the next check of the
// station updates (at launch, on return to the app, and every few minutes),
// and the app follows at once: a tab disappears or comes back, a feed stops
// being read.
//
//   videos        the Videos tab, and videos in Favorites and show pages
//   concerts      the Concerts tab and saved concerts (Settings then links
//                 to the calendar on xpn.org)
//   archive       the Shows › Archive tab, and episodes in Favorites
//   playlistSync  Spotify and Apple Music playlists
//   push          push notifications (the phone plans its own instead)
//   liveVideo     reading the week's Free at Noon from xpn.org/livestream
//   reviewPrompt  asking for a store rating

import { useSyncExternalStore } from "react";
import {
  ARCHIVE_ENABLED,
  CONCERTS_ENABLED,
  LIVESTREAM_PAGE_URL,
  PUSH_REGISTER_URL,
  VIDEOS_ENABLED,
} from "./config.js";
import { savedConfig } from "./remote-config.js";
import { createStore } from "./storage.js";

const BUILT = {
  videos: VIDEOS_ENABLED,
  concerts: CONCERTS_ENABLED,
  archive: ARCHIVE_ENABLED,
  playlistSync: true,
  push: Boolean(PUSH_REGISTER_URL),
  liveVideo: Boolean(LIVESTREAM_PAGE_URL),
  reviewPrompt: true,
};

// Which features are on, from what the build has and what is switched off.
// Pure, so it can be tested.
export function featureSet(off = [], built = BUILT) {
  return Object.fromEntries(
    Object.entries(built).map(([name, on]) => [name, on && !off.includes(name)]),
  );
}

const store = createStore(featureSet(savedConfig().off));

// The station's "off" list changed (useStationUpdates). Unchanged keeps the
// same object, so nothing re-renders.
export function applySwitches(off) {
  const next = featureSet(off);
  const now = store.getSnapshot();
  if (Object.keys(next).some((name) => next[name] !== now[name])) store.set(next);
}

export const featureOn = (name) => Boolean(store.getSnapshot()[name]);
export const subscribeFeatures = store.subscribe;
export const useFeatures = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
