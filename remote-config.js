// Remote config: changes the station can make to apps already on phones,
// without a store release. It rides in the station updates (the file, or an
// Advanced Ads ad whose JSON is only a "config"):
//
//   "config": {
//     "streams": {                         a station's addresses, if StreamGuys
//       "xpn": { "url": "https://…", "backupUrl": "https://…" }   moves a mount
//     },
//     "off": ["videos", "archive"],        features to hide (see FEATURES)
//     "update": {                          ask for a newer version
//       "minVersion": "1.2.0",             below this, the app asks to update
//       "required": false,                 true: it can't be dismissed
//       "message": "This version can no longer play WXPN.",
//       "ios": "https://apps.apple.com/app/id…"   the App Store page
//     }
//   }
//
// An update is only ever required where it can be done: the store address
// must be the App Store's or Google Play's, and without one for the phone's
// own platform the request can still be set aside (updateNotice).
//
// Streams change from the next connection; features turned off (or back on)
// apply at once, while the app runs (features.js). The last config is kept
// on the device, so it holds offline and from the first moment of the next
// launch. Stream addresses are https only, and only on
// WXPN's or StreamGuys' hosts, so a damaged or tampered file can't send
// listeners elsewhere.

import { createStore, readJson, writeJson } from "./storage.js";
import { oneLine, webUrl } from "./text.js";
import { adList, adText } from "./updates.js";

const KEY = "xpn.remote-config";
// What the station can turn off and on again (features.js says what each is).
export const FEATURES = [
  "videos",
  "concerts",
  "archive",
  "playlistSync",
  "push",
  "liveVideo",
  "reviewPrompt",
];
const STREAM_HOSTS = /(^|\.)(xpn\.org|streamguys1\.com|streamguys\.com)$/;
const PLAY_STORE = "https://play.google.com/store/apps/details?id=org.xpn.wxpn";
// A store address on the store's own host, else "".
const storeUrl = (value, hosts) => {
  const url = webUrl(value);
  return url && hosts.test(new URL(url).hostname) ? url : "";
};
const APP_STORE_HOSTS = /^(apps|itunes)\.apple\.com$/;
const PLAY_HOSTS = /^play\.google\.com$/;

const streamUrl = (value) => {
  const url = webUrl(value);
  return url && STREAM_HOSTS.test(new URL(url).hostname) ? url : "";
};

// A config with only the parts that check out. Pure, so it can be tested.
export function normalizeConfig(raw) {
  const config = { streams: {}, off: [], update: null };
  if (!raw || typeof raw !== "object") return config;
  for (const [id, s] of Object.entries(raw.streams || {})) {
    const url = streamUrl(s?.url);
    const backupUrl = streamUrl(s?.backupUrl);
    if (url || backupUrl)
      config.streams[id] = { ...(url && { url }), ...(backupUrl && { backupUrl }) };
  }
  config.off = (Array.isArray(raw.off) ? raw.off : []).filter((f) => FEATURES.includes(f));
  const u = raw.update;
  if (u && /^\d+(\.\d+){0,2}$/.test(String(u.minVersion || ""))) {
    config.update = {
      minVersion: String(u.minVersion),
      required: u.required === true,
      message: oneLine(u.message || "", 200),
      ios: storeUrl(u.ios, APP_STORE_HOSTS),
      android: storeUrl(u.android, PLAY_HOSTS) || PLAY_STORE,
    };
  }
  return config;
}

// The config in what the updates source returned: the file's "config", or
// the first Advanced Ads ad whose JSON holds one (read as updates.js reads
// the others).
export function configFrom(json) {
  if (json?.config) return normalizeConfig(json.config);
  for (const ad of adList(json) || []) {
    const body = adText(ad);
    if (!body.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(body);
      if (parsed.config) return normalizeConfig(parsed.config);
    } catch {
      /* not this one */
    }
  }
  return normalizeConfig(null);
}

// Is version `a` older than `b`? ("1.2" < "1.10.0")
export function versionBelow(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0;
  }
  return false;
}

export const savedConfig = () => normalizeConfig(readJson(KEY, null));

// The latest "update" request, for the prompt (components/UpdatePrompt.jsx).
export const updateRequest = createStore(savedConfig().update);

// What the phone apps show for an update request: null (nothing), or the
// store to send the listener to and whether it can be set aside. Required
// only with a store address for this platform: a required request with
// nowhere to update would leave the listener with no way into the app.
// Pure, so it can be tested.
export function updateNotice({ request, platform, version, dismissed }) {
  if (!request || platform === "web" || !versionBelow(version, request.minVersion)) return null;
  const store = (platform === "ios" ? request.ios : request.android) || "";
  const required = request.required && Boolean(store);
  if (!required && dismissed === request.minVersion) return null;
  return { store, required };
}

export function saveConfig(config) {
  writeJson(KEY, config);
  updateRequest.set(config.update);
}
