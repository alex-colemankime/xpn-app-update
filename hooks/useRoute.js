import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

// Hash routes, so the browser and Android back buttons step back through
// screens and close the show sheet, and any screen can be linked to:
//   #/shows                                a screen
//   #/favorites/show/worldcafe             a show, open over that screen
//   #/favorites/show/worldcafe/episode/x   one of its episodes
// Hash routing needs no server rewrites, so it works on GitHub Pages and in
// the Capacitor webview alike.

import { CONCERTS_ENABLED } from "../config.js";

const SCREENS = [
  "listen",
  "favorites",
  "shows",
  "settings",
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
  return { screen, showId, episodeId };
}

export function routeHash({ screen, showId, episodeId }) {
  let hash = `#/${screen}`;
  if (showId) hash += `/show/${encodeURIComponent(showId)}`;
  if (showId && episodeId) hash += `/episode/${encodeURIComponent(episodeId)}`;
  return hash;
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
// pushState and replaceState fire no event of their own.
const announce = () => window.dispatchEvent(new PopStateEvent("popstate"));
const push = (route, state) => {
  window.history.pushState(state, "", routeHash(route));
  announce();
};
const replace = (route, state = { depth: depth() }) => {
  window.history.replaceState(state, "", routeHash(route));
  announce();
};

// Screen changes cross-fade where the View Transitions API exists and the
// listener has not asked for reduced motion; elsewhere they are instant.
function withTransition(update) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced || document.visibilityState === "hidden")
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
    if (screen === route.screen && !route.showId) return;
    withTransition(() => push({ screen }, { depth: 0 }));
  },
  openShow(showId, episodeId = null) {
    push({ screen: current().screen, showId, episodeId }, { depth: depth() + 1 });
  },
  // Drilling into an episode from inside the sheet is undone by Back.
  openEpisode(episodeId) {
    push({ ...current(), episodeId }, { depth: depth() + 1, fromShow: true });
  },
  closeEpisode() {
    if (window.history.state?.fromShow) window.history.back();
    else replace({ ...current(), episodeId: null });
  },
  closeShow() {
    const d = depth();
    if (d > 0) window.history.go(-d);
    else replace({ screen: current().screen }, { depth: 0 });
  },
};

export function useRoute() {
  const route = parseRoute(useSyncExternalStore(subscribe, getHash, () => ""));
  return { ...route, ...actions };
}
