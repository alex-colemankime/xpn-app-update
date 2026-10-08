// Usage and crash reporting, to the station's GA4 property (VITE_GA4_ID):
// which screens and features are used, and errors the app hits, so WXPN can
// see what listeners use and fix what breaks. Nothing is sent without an id.
//
// What it never does: cookies, advertising ids, Google signals or ad
// personalization, or anything that says who a listener is. Each install has
// a random id of its own (so GA4 can count listeners), and a listener can
// switch reporting off in Settings, which also forgets that id.
//
// Events (GA4 names and parameters):
//   page_view      a screen opened            page_title: "Listen", …
//   play_station   the radio started          station
//   save / unsave  a heart                    item_type: songs | shows | …
//   episode_play   an archive episode         show
//   video_play     a video                    video_id
//   donate_click   a link to the donate page  place
//   share          a song shared              method
//   turn_on        a notification feature     feature: reminders | alarm | live | drives
//   music_connect  playlist sync connected    service
//   exception      an error                   description, fatal

import { GA4_ID } from "./config.js";
import { createLocalStore, readJson, writeJson } from "./storage.js";

const CLIENT_KEY = "xpn.analytics.client";
export const reportingStore = createLocalStore("xpn.analytics", { on: true }, (v) => ({
  on: v?.on !== false,
}));

// An error as a short, anonymous line: the message (with addresses and
// numbers long enough to identify anything taken out), and where it came
// from. Pure, so it can be tested.
export function describeError(error, where = "") {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error?.reason?.message ?? error?.message ?? "Unknown error");
  const text = message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "<email>")
    .replace(/\d{5,}/g, "<n>");
  return `${where ? `${where}: ` : ""}${text}`.replace(/\s+/g, " ").trim().slice(0, 150);
}

// The reporter, with sending passed in so it can be tested. Events before
// `start()` wait in a short queue; with reporting off they are dropped.
export function createAnalytics({ send, enabled = () => true, limit = 50 }) {
  let ready = false;
  const queue = [];
  const sentErrors = new Set();
  return {
    start() {
      ready = true;
      queue.splice(0).forEach(([name, params]) => send(name, params));
    },
    track(name, params = {}) {
      if (!enabled()) return;
      if (ready) send(name, params);
      else if (queue.length < limit) queue.push([name, params]);
    },
    // The same error reported once per session, so a loop can't flood it.
    error(error, { where = "", fatal = false } = {}) {
      const description = describeError(error, where);
      if (sentErrors.has(description)) return;
      sentErrors.add(description);
      this.track("exception", { description, fatal });
    },
  };
}

const randomId = () => `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`;

// gtag, loaded only when there is an id and reporting is on.
function loadGtag() {
  window.dataLayer = window.dataLayer || [];
  // gtag reads `arguments`, as Google's own snippet does.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  let clientId = readJson(CLIENT_KEY, null);
  if (!clientId) writeJson(CLIENT_KEY, (clientId = randomId()));
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, {
    send_page_view: false, // screens are reported as they open
    client_storage: "none", // no cookies; the id below instead
    client_id: clientId,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    app_version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "",
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.append(script);
}

// The phone apps' pages have no web address GA4 understands
// (capacitor://localhost), so screens are reported at an https one.
const pageLocation = (screen) => {
  const origin = /^https?:$/.test(window.location.protocol)
    ? window.location.origin
    : "https://localhost";
  return `${origin}/#/${screen}`;
};

const analytics = createAnalytics({
  enabled: () => Boolean(GA4_ID) && reportingStore.getSnapshot().on,
  send: (name, params) => globalThis.gtag?.("event", name, params),
});

export const track = (name, params) => analytics.track(name, params);
export const reportError = (error, options) => analytics.error(error, options);
export const trackScreen = (screen, title) =>
  analytics.track("page_view", { page_title: title, page_location: pageLocation(screen) });

// At launch: load gtag and report errors the app doesn't catch itself.
export function startAnalytics() {
  if (!GA4_ID || typeof window === "undefined") return;
  if (reportingStore.getSnapshot().on) loadGtag();
  analytics.start();
  window.addEventListener("error", (e) => reportError(e.error || e.message, { fatal: true }));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { where: "promise" }));
}

// The Settings switch. Off forgets this install's id; on again starts anew.
export function setReporting(on) {
  reportingStore.set({ on });
  if (!on) writeJson(CLIENT_KEY, null);
  else if (GA4_ID && !window.gtag) loadGtag();
}
export const reportingAvailable = () => Boolean(GA4_ID);
