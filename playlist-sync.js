// Keeps a "WXPN Favorites" playlist in the listener's Spotify or Apple Music
// in step with the songs they save, the way workout apps build a playlist of
// every song you like.
//
// It reconciles rather than replaying events: the wanted state is "every
// saved song", the known state is what this app has put in the playlist, and
// each run closes the gap (find and add new saves, remove unsaved ones where
// the service allows). That makes it safe to run any number of times: after
// each save, when the app comes back to the front, and after connecting.

import { useSyncExternalStore } from "react";
import { getSavedSongs, songId, subscribeFavorites } from "./favorites.js";
import {
  AuthError,
  NotAllowedError,
  SERVICES,
  cancelAuthorization,
  forgetAuth,
  isSpotifyReturn,
  PLAYLIST_NAME,
} from "./music-services.js";
import { createLocalStore } from "./storage.js";
import { showToast } from "./toast.js";

const EMPTY = {
  service: null, // "spotify" | "apple"
  // Who is signed in ("" where the service won't say), and whether the
  // playlist below has been checked against them since the last sign-in.
  account: "",
  verified: false,
  playlistId: "",
  playlistUrl: "",
  matched: {}, // songId -> the service's track reference
  missing: [], // songIds the service has no match for
  lastSync: 0,
  status: "idle", // "idle" | "syncing" | "error" | "signed-out" | "not-allowed"
};
const MAX_FINDS_PER_RUN = 60;
// What a different account starts from: no playlist yet, nothing in it.
const FRESH_PLAYLIST = { playlistId: "", playlistUrl: "", matched: {}, missing: [] };

const syncStore = createLocalStore("xpn.playlistSync", EMPTY, (v) => ({
  ...EMPTY,
  ...(v && typeof v === "object" ? v : {}),
  account: typeof v?.account === "string" ? v.account : "",
  verified: v?.verified === true,
  matched: v?.matched && typeof v.matched === "object" ? v.matched : {},
  missing: Array.isArray(v?.missing) ? v.missing : [],
  status: v?.status || "idle",
}));
// A sync interrupted by closing the app is simply run again. Only at launch:
// a run in progress shows "syncing" ("Adding your songs…").
if (syncStore.getSnapshot().status === "syncing") syncStore.set((s) => ({ ...s, status: "idle" }));

export const usePlaylistSync = () =>
  useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
const patch = (p) => syncStore.set((s) => ({ ...s, ...p }));

// The plan for one run, worked out from what is saved and what the playlist
// is known to hold. Pure, so it can be tested. `matched` is what the playlist
// holds: where the service cannot remove songs (Apple Music), an unsaved song
// stays in the playlist, so it stays in `matched` too, and saving it again
// does not add a second copy.
export function syncPlan(saved, state, canRemove) {
  const ids = new Set(saved.map(songId));
  const unsaved = Object.keys(state.matched).filter((id) => !ids.has(id));
  return {
    toFind: saved.filter((s) => {
      const id = songId(s);
      return !state.matched[id] && !state.missing.includes(id);
    }),
    toRemove: canRemove ? unsaved : [],
    missing: state.missing.filter((id) => ids.has(id)),
  };
}

let running = null;
let again = false;
// Bumped whenever the connection changes service, or ends, or turns out to
// be another account. A run belongs to the connection it started under; once
// that changes, the run stops writing (its results would describe a playlist
// the listener no longer uses).
let generation = 0;
// Sign-in dialogs and OAuth exchanges can finish after another sign-in or
// Disconnect. Their completion must not replace the listener's newer choice.
let connectionAttempt = 0;
// Changes whenever the signed-in account may have: a sign-in starting, and
// again when it completes. An account check counts only if none happened
// while it ran.
let signIns = 0;

export function syncNow() {
  if (running) {
    again = true;
    return running;
  }
  running = run()
    .catch(() => {})
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        syncNow();
      }
    });
  return running;
}

async function run(retried = false) {
  let gen = generation;
  const current = () => gen === generation;
  // The sign-in this run started under. Signing in again to the same service
  // lets the run finish, but its view of the account no longer counts.
  const signIn = signIns;
  // Writes only while this run's connection is still the current one.
  const update = (p) => current() && patch(p);
  const state = syncStore.getSnapshot();
  const service = SERVICES[state.service];
  if (!service || !service.available()) return;
  update({ status: "syncing" });
  try {
    // After a sign-in, the playlist on record is kept only once it is known
    // to belong to the account now signed in; otherwise this account starts
    // its own.
    if (!state.verified) {
      const account = (await service.account?.()) || "";
      if (!current()) return;
      const sameAccount = Boolean(state.account && account && state.account === account);
      const keep =
        Boolean(state.playlistId) &&
        (sameAccount || !service.owns || (await service.owns(state.playlistId, account)));
      // Checked under a sign-in that has since been replaced: the next run
      // (connect() starts one) checks the new account instead.
      if (!current() || signIn !== signIns) {
        // The new sign-in's own run takes over; this one stands down.
        update({ status: "idle" });
        return;
      }
      if (keep) update({ account, verified: true });
      else {
        // Another account: whatever is still working for the old one stops.
        generation++;
        gen = generation;
        patch({ ...FRESH_PLAYLIST, account, verified: true });
      }
    }
    const playlist = await service.ensurePlaylist(syncStore.getSnapshot());
    if (!current()) return;
    update(playlist);
    // A show's segment (a World Cafe session hour) isn't a track to find.
    const songs = getSavedSongs().filter((s) => !s.show);
    const plan = syncPlan(songs, syncStore.getSnapshot(), Boolean(service.remove));
    // Front-inserting services need older batches first; otherwise the
    // second batch of an initial import would cover the newest favorites.
    const batch = service.prepends
      ? plan.toFind.slice(-MAX_FINDS_PER_RUN)
      : plan.toFind.slice(0, MAX_FINDS_PER_RUN);
    const found = {};
    const missing = [...plan.missing];
    for (const song of batch) {
      const ref = await service.find(song);
      if (!current()) return;
      if (ref) found[songId(song)] = ref;
      else missing.push(songId(song));
    }
    // Different broadcast titles can resolve to the same catalog track.
    // Keep both local identities, but only one copy in the remote playlist.
    const knownRefs = new Set(Object.values(syncStore.getSnapshot().matched));
    const refs = [...new Set(Object.values(found))].filter((ref) => !knownRefs.has(ref));
    if (refs.length) {
      await service.add(playlist.playlistId, refs);
      if (!current()) return;
    }
    // Record the additions now, so a failed removal below can't make the
    // next run add the same songs again.
    update({ matched: { ...syncStore.getSnapshot().matched, ...found }, missing });
    if (plan.toRemove.length) {
      const matched = syncStore.getSnapshot().matched;
      const removing = new Set(plan.toRemove);
      const retained = new Set(
        Object.entries(matched)
          .filter(([id]) => !removing.has(id))
          .map(([, ref]) => ref),
      );
      const refs = [...new Set(plan.toRemove.map((id) => matched[id]))].filter(
        (ref) => !retained.has(ref),
      );
      if (refs.length) await service.remove(playlist.playlistId, refs);
      if (!current()) return;
      const after = { ...syncStore.getSnapshot().matched };
      plan.toRemove.forEach((id) => delete after[id]);
      update({ matched: after });
    }
    update({ lastSync: Date.now(), status: "idle" });
    if (plan.toFind.length > MAX_FINDS_PER_RUN) again = true;
  } catch (error) {
    if (!current()) return;
    if (error?.status === 404 && !retried) {
      // The listener deleted the playlist: start a fresh one.
      update(FRESH_PLAYLIST);
      return run(true);
    }
    update({
      status:
        error instanceof AuthError
          ? "signed-out"
          : error instanceof NotAllowedError
            ? "not-allowed"
            : "error",
    });
  }
}

// Start connecting a service. Spotify leaves the app to sign in and comes
// back through finishConnect; Apple Music signs in in place. Signing in again
// to the same service keeps its playlist and what it holds, so a reconnect
// carries on with the same "WXPN Favorites" instead of starting another;
// but only once the next run has checked the playlist is this account's.
export async function connect(serviceId) {
  const service = SERVICES[serviceId];
  if (!service?.available()) {
    showToast(`${service?.name || "That service"} isn’t set up in this version of the app.`);
    return;
  }
  const before = syncStore.getSnapshot();
  const attempt = ++connectionAttempt;
  signIns++;
  cancelAuthorization();
  const same = before.service === serviceId;
  // A different service (or none before) means a different playlist, so any
  // run still working for the old one must not write. Signing in again to
  // the same service keeps the playlist record, unverified: a run in flight
  // may finish (the services refuse changes to another account's playlist,
  // and stopping it midway could add its songs twice), and the next run
  // checks the record against the account now signed in before using it.
  if (!same) generation++;
  syncStore.set(same ? { ...before, verified: false } : { ...EMPTY, service: serviceId });
  try {
    const result = await service.connect();
    if (attempt !== connectionAttempt) return;
    if (result === "connected") {
      // Anything checked while the sign-in was open was about the old one.
      signIns++;
      patch({ verified: false });
      afterConnect(service);
    }
  } catch {
    if (attempt !== connectionAttempt) return;
    if (!same) {
      // Back to the previous connection; its interrupted run starts over.
      generation++;
      syncStore.set({ ...before, status: before.status === "syncing" ? "idle" : before.status });
      if (before.service) syncNow();
    }
    showToast(`Couldn’t connect to ${service.name}. Please try again.`);
  }
}

function afterConnect(service) {
  showToast(`Connected to ${service.name}. Adding your saved songs to “${PLAYLIST_NAME}”.`);
  syncNow();
}

export async function finishConnect(url) {
  const state = syncStore.getSnapshot();
  if (state.service !== "spotify" || !isSpotifyReturn(url)) return;
  const attempt = connectionAttempt;
  const service = SERVICES.spotify;
  try {
    const connected = await service.finish(url);
    if (attempt !== connectionAttempt) return;
    if (connected) {
      signIns++;
      patch({ service: service.id, status: "idle", verified: false });
      afterConnect(service);
      return;
    }
  } catch {
    /* fall through */
  }
  if (attempt !== connectionAttempt) return;
  // Signing in did not finish: leave any existing playlist record as it was
  // (only its status says it needs signing in again).
  if (state.playlistId) patch({ status: "signed-out" });
  else syncStore.set(EMPTY);
  showToast(`Couldn’t connect to ${service.name}. Please try again.`);
}

export function disconnect() {
  connectionAttempt++;
  signIns++;
  generation++;
  forgetAuth();
  syncStore.set(EMPTY);
}

// Wiring: sync shortly after each save or unsave, when the app returns to the
// front, and handle Spotify's sign-in return trip (web and phone apps).
let started = false;
export function startPlaylistSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  let timer = null;
  subscribeFavorites(() => {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
  if (isSpotifyReturn(window.location.href)) {
    const url = window.location.href;
    // Drop the sign-in details from the address bar straight away.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}#/settings`);
    // replaceState fires no event of its own; tell the router.
    window.dispatchEvent(new PopStateEvent("popstate"));
    finishConnect(url);
  } else {
    syncNow();
  }
  // Phone apps: Spotify hands back org.xpn.wxpn://spotify-callback. Usually
  // as appUrlOpen; but if Android closed WXPN during sign-in, the return
  // starts a fresh app and arrives as its launch URL instead. Each return is
  // handled once, so the sign-in code is exchanged once.
  const handled = new Set();
  const handleReturn = async (url) => {
    if (!url || handled.has(url) || !isSpotifyReturn(url)) return;
    handled.add(url);
    const { Browser } = await import("@capacitor/browser");
    Browser.close().catch(() => {});
    finishConnect(url);
  };
  import("@capacitor/app")
    .then(async ({ App }) => {
      await App.addListener("appUrlOpen", ({ url }) => handleReturn(url));
      const launch = await App.getLaunchUrl().catch(() => null);
      handleReturn(launch?.url);
    })
    .catch(() => {});
}
