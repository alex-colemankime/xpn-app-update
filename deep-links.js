// Links that open the app (Universal Links on iOS, App Links on Android):
// an xpn.org address tapped on a phone with the app opens the same thing in
// the app, and on any other phone the website as before. Needs the two
// files in native/well-known/ hosted on xpn.org, and the native setup in
// README › Native apps.
//
//   xpn.org/program/<show>/      that show's sheet
//   xpn.org/listen/              Listen
//   xpn.org/wxpn-playlists/      Listen (recently played)
//   xpn.org/concert-and-events/  Concerts
//
// Donate links are left out on purpose: giving happens on xpn.org (App
// Review 3.2.2), so those always open the website.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { SHOWS } from "./catalog.js";
import { featureOn } from "./features.js";

const HOSTS = new Set(["xpn.org", "www.xpn.org"]);
const slugOf = (page) => /\/program\/([^/]+)/.exec(page || "")?.[1] || "";
const SHOW_BY_SLUG = new Map(
  Object.values(SHOWS)
    .filter((show) => slugOf(show.page))
    .map((show) => [slugOf(show.page), show.id]),
);

// The app's route for an address, or null when the app has nothing for it.
// Pure, so it can be tested.
export function routeForUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) return null;
  const [first, second] = url.pathname.split("/").filter(Boolean);
  if (first === "program" && SHOW_BY_SLUG.has(second)) {
    return `#/shows/show/${encodeURIComponent(SHOW_BY_SLUG.get(second))}`;
  }
  if (first === "listen" || first === "wxpn-playlists") return "#/listen";
  if (first === "concert-and-events" && featureOn("concerts")) return "#/concerts";
  return null;
}

// At launch (phone apps): open what a tapped link points at, whether it
// started the app or reached it while open.
export function startDeepLinks() {
  if (!Capacitor.isNativePlatform()) return;
  const open = (url) => {
    const hash = routeForUrl(url);
    if (hash && window.location.hash !== hash) window.location.hash = hash;
  };
  App.addListener("appUrlOpen", ({ url }) => open(url)).catch(() => {});
  App.getLaunchUrl()
    .then((launch) => launch?.url && open(launch.url))
    .catch(() => {});
}
