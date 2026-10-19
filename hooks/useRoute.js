import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { CONCERTS_ENABLED, VIDEOS_ENABLED } from "../config.js";

// Hash routes, so the browser and Android back buttons step back through
// screens and close the show sheet, and any screen can be linked to:
//   #/shows                                a screen
//   #/favorites/show/worldcafe             a show, open over that screen
//   #/favorites/show/worldcafe/episode/x   one of its episodes
//   #/shows/host/raina-douris              a host, the same way
//   #/videos/video/6406083303112           a video, full screen over that screen
//   #/listen/live                          the station's live video, the same way
// Hash routing needs no server rewrites, so it works on GitHub Pages and in
// the Capacitor webview alike.

const SCREENS = [
  "listen",
  "favorites",
  "shows",
  "settings",
  ...(VIDEOS_ENABLED ? ["videos"] : []),
  ...(CONCERTS_ENABLED ? ["concerts"] : []),
];

export function parseRoute(hash) {
  const parts = String(hash || "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return ""; // a malformed escape reads as a missing segment
      }
    });
  const screen = SCREENS.includes(parts[0]) ? parts[0] : "listen";
  const showId = parts[1] === "show" && parts[2] ? parts[2] : null;
  const episodeId = showId && parts[3] === "episode" && parts[4] ? parts[4] : null;
  const videoId = parts[1] === "video" && /^\d+$/.test(parts[2] || "") ? parts[2] : null;
  const live = parts[1] === "live";
  const hostId = parts[1] === "host" && parts[2] ? parts[2] : null;
  return { screen, showId, episodeId, videoId, live, hostId };
}

export function routeHash({ screen, showId, episodeId, videoId, live, hostId }) {
  let hash = `#/${screen}`;
  if (videoId) return `${hash}/video/${encodeURIComponent(videoId)}`;
  if (live) return `${hash}/live`;
  if (hostId) return `${hash}/host/${encodeURIComponent(hostId)}`;
  if (showId) hash += `/show/${encodeURIComponent(showId)}`;
  if (showId && episodeId) hash += `/episode/${encodeURIComponent(episodeId)}`;
  return hash;
}

// How far down each screen was when the listener left it, so coming back
// returns there (App.jsx). Noted at the moment of leaving: before the app's
// own navigation changes the address, and, for Back and Forward, from the
// browser's own event, which reaches this listener (added first, as the app
// loads) before the screen changes. Nothing is noted while scrolling.
const places = new Map();
let shownScreen = typeof window === "undefined" ? "" : parseRoute(window.location.hash).screen;
const leaving = (next) => {
  if (next === shownScreen) return;
  places.set(shownScreen, window.scrollY);
  shownScreen = next;
};
export const placeOf = (screen) => places.get(screen) || 0;
if (typeof window !== "undefined") {
  const followAddress = () => leaving(parseRoute(window.location.hash).screen);
  window.addEventListener("popstate", followAddress);
  window.addEventListener("hashchange", followAddress);
}

const subscribe = (listener) => {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
};
const getHash = () => window.location.hash;

// history.state.depth counts sheet entries pushed on top of a screen, so
// closing the sheet can return to the screen in one step however deep the
// listener went, and a sheet opened from a shared link closes in place
// instead of navigating out of the app.
const depth = () => window.history.state?.depth || 0;
// The current entry's state as it is, for a replace that stands in for it.
const entryState = () => window.history.state ?? { depth: depth() };
// pushState and replaceState fire no event of their own.
const announce = () => window.dispatchEvent(new PopStateEvent("popstate"));
const push = (route, state) => {
  leaving(route.screen);
  window.history.pushState(state, "", routeHash(route));
  announce();
};
const replace = (route, state = { depth: depth() }) => {
  leaving(route.screen);
  window.history.replaceState(state, "", routeHash(route));
  announce();
};

// Changing tabs happens dozens of times a session, so it is instant, as a
// phone's own tab bars are. The Android app alone uses Material's quick
// fade-through (styles/states.css), as Android's own apps do. Never under
// reduced motion, and never where the View Transitions API is missing.
const android = () => window.Capacitor?.getPlatform?.() === "android";
function withTransition(update) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (
    !android() ||
    !document.startViewTransition ||
    reduced ||
    document.visibilityState === "hidden"
  )
    return update();
  // flushSync renders the new screen inside the transition's snapshot window.
  const transition = document.startViewTransition(() => flushSync(update));
  // Browsers can skip a cross-fade when the tab is hidden or another
  // navigation supersedes it. The route still updates; only the animation's
  // ready promise rejects, which is an expected cancellation.
  transition.ready.catch(() => {});
}

// The actions read the route at the moment they run, so they never change
// identity and screens that receive them need not re-render.
const current = () => parseRoute(getHash());
const actions = {
  navigate(screen) {
    const route = current();
    // The screen already in front, chosen again (its tab, or the wordmark):
    // back to its top, as a phone's tab bar does.
    if (screen === route.screen && !route.showId && !route.hostId) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
    // The screen it came from, so Settings can step back to it.
    withTransition(() => push({ screen }, { depth: 0, from: route.screen }));
  },
  // The Settings key: opens Settings, and pressed again in Settings, goes
  // back where the listener was (Back, so the history doesn't grow), or to
  // Listen when Settings was opened directly.
  toggleSettings() {
    const route = current();
    if (route.screen !== "settings") return actions.navigate("settings");
    const from = window.history.state?.from;
    if (from && from !== "settings" && !route.showId && !route.hostId && !depth())
      window.history.back();
    else actions.navigate(from && from !== "settings" ? from : "listen");
  },
  openShow(showId, episodeId = null) {
    push({ screen: current().screen, showId, episodeId }, { depth: depth() + 1 });
  },
  // A host's sheet, the same way: from a show's, Back returns to the show.
  openHost(hostId) {
    push({ screen: current().screen, hostId }, { depth: depth() + 1 });
  },
  // An episode's page (opened from the mini player) gives way to its show's.
  closeEpisode() {
    replace({ ...current(), episodeId: null });
  },
  // Closes a show's sheet or a host's, however many deep.
  closeShow() {
    const d = depth();
    if (d > 0) window.history.go(-d);
    else replace({ screen: current().screen }, { depth: 0 });
  },
  // A video opens over the screen (from a show's sheet too, which Back then
  // returns to); picking the next one replaces it, so Back always closes.
  // The live video works the same way.
  // Replacing one video with another keeps the entry's own state, so Close
  // still knows to step Back.
  openVideo(videoId) {
    const route = current();
    if (route.videoId || route.live) replace({ screen: route.screen, videoId }, entryState());
    else push({ screen: route.screen, videoId }, { depth: depth() + 1, fromScreen: true });
  },
  openLive() {
    const route = current();
    if (route.live) return;
    if (route.videoId) replace({ screen: route.screen, live: true }, entryState());
    else push({ screen: route.screen, live: true }, { depth: depth() + 1, fromScreen: true });
  },
  closeVideo() {
    if (window.history.state?.fromScreen) window.history.back();
    else replace({ screen: current().screen }, { depth: 0 });
  },
};

// A show opened from outside a screen's props (a song's sheet).
export const openShow = (showId) => actions.openShow(showId);

export function useRoute() {
  const route = parseRoute(useSyncExternalStore(subscribe, getHash));
  return { ...route, ...actions };
}
