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
//       "ios": "https://apps.apple.com/app/id…"
//     }
//   }
//
// Streams change at once. Features turned off (or back on) apply the next
// time the app opens, since the app's tabs are set at launch. The last
// config is kept on the device, so it holds offline and from the first
// moment of the next launch. Stream addresses are https only, and only on
// WXPN's or StreamGuys' hosts, so a damaged or tampered file can't send
// listeners elsewhere.

import { createStore, readJson, writeJson } from "./storage.js";
import { oneLine, plainText, webUrl } from "./text.js";

const KEY = "xpn.remote-config";
export const FEATURES = ["videos", "concerts", "archive", "playlistSync", "push"];
const STREAM_HOSTS = /(^|\.)(xpn\.org|streamguys1\.com|streamguys\.com)$/;
const PLAY_STORE = "https://play.google.com/store/apps/details?id=org.xpn.wxpn";

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
      ios: webUrl(u.ios),
      android: webUrl(u.android) || PLAY_STORE,
    };
  }
  return config;
}

// The config in what the updates source returned: the file's "config", or
// the first Advanced Ads ad whose JSON holds one.
export function configFrom(json) {
  if (json?.config) return normalizeConfig(json.config);
  const ads = Array.isArray(json) ? json : Array.isArray(json?.ads) ? json.ads : [];
  for (const ad of ads) {
    const body = plainText(typeof ad?.content === "string" ? ad.content : ad?.content?.rendered)
      .replace(/[“”″]/g, '"')
      .replace(/[‘’′]/g, "'");
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

export function saveConfig(config) {
  writeJson(KEY, config);
  updateRequest.set(config.update);
}
