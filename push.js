// Push notifications from the station (iOS and Android apps): live video and
// member drives, sent from WordPress to phones whether or not the app has
// been opened lately. Only when VITE_PUSH_REGISTER_URL is set; without it,
// those notifications are planned on the phone from the station updates
// (useStationAlerts), which needs nothing on a server.
//
// The listener's two switches in Settings › From WXPN are their
// subscriptions ("live", "drives"). Whenever the set changes, or the phone's
// push token does, the app sends one small request:
//
//   POST VITE_PUSH_REGISTER_URL
//   { "token": "…", "platform": "ios" | "android", "topics": ["live", "drives"],
//     "app": "org.xpn.wxpn", "version": "1.0.0" }
//
// An empty `topics` list means "send me nothing" (keep the token, or delete
// it). The token is the phone's own: an APNs device token on iOS, an FCM
// token on Android, so the sender talks to Apple and Google directly (or
// through one service that does both).
//
// What the sender puts in a notification's data decides what a tap opens:
//   { "action": "watch", "watch": "https://www.youtube.com/watch?v=…",
//     "title": "Free at Noon: Dawes" }          the video, in the app
//   { "action": "open", "url": "https://xpn.org/donate/" }   a page
//   { "action": "listen", "stream": "xpn" }     a station, playing
// (anything else just opens the app).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { PUSH_REGISTER_URL } from "./config.js";
import { withTimeout } from "./net.js";
import { readJson, writeJson } from "./storage.js";
import { webUrl } from "./text.js";

const SENT_KEY = "xpn.push.sent";
const APP_ID = "org.xpn.wxpn";
const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

export const pushIsOn = () => Boolean(PUSH_REGISTER_URL) && Capacitor.isNativePlatform();

// What a tap on a pushed notification asks for, from its data, or null.
// Pure, so it can be tested; links are https only.
export function pushTarget(data) {
  if (!data || typeof data !== "object") return null;
  if (data.action === "watch") {
    const watch = webUrl(data.watch);
    return watch ? { action: "watch", live: { watch, title: String(data.title || "") } } : null;
  }
  if (data.action === "open") {
    const url = webUrl(data.url);
    return url ? { action: "open", url } : null;
  }
  if (data.action === "listen") return { action: "listen", stream: String(data.stream || "xpn") };
  return null;
}

// The registration logic, with the phone's push API and the network passed
// in so it can be tested with stand-ins. `api` is PushNotifications' shape.
export function createPushClient({ api, post, platform, sent = readJson(SENT_KEY, null), save }) {
  let token = sent?.token || null;
  let topics = [];
  let registering = null;

  // Tell the server, once per change of token or topics.
  async function report() {
    if (!token) return;
    const key = `${token}|${topics.join(",")}`;
    if (sent?.key === key) return;
    await post({ token, platform, topics, app: APP_ID, version: VERSION });
    sent = { token, key };
    save?.(sent);
  }

  // Ask the phone for its token. Resolves once the token has arrived (or
  // registration failed); a new token later is reported by itself.
  function register() {
    registering ??= new Promise((resolve, reject) => {
      let first = resolve;
      api.addListener("registration", ({ value }) => {
        token = value;
        // The first token is reported by setTopics; a new one later (the
        // phone replaced it) by itself.
        if (first) {
          first(value);
          first = null;
        } else {
          report().catch(() => {});
        }
      });
      api.addListener("registrationError", (error) => {
        registering = null;
        reject(error);
      });
      api.register().catch(reject);
    });
    return registering;
  }

  // The listener's subscriptions changed (or the app opened). Turning any on
  // registers the phone; turning all off tells the server to send nothing.
  async function setTopics(next) {
    topics = [...next].sort();
    if (topics.length) {
      const { receive } = await api.checkPermissions();
      if (receive !== "granted") {
        const asked = await api.requestPermissions();
        if (asked.receive !== "granted") return false;
      }
      await register();
    }
    await report();
    return true;
  }

  return { setTopics };
}

let client = null;
const realClient = () =>
  (client ??= createPushClient({
    api: PushNotifications,
    platform: Capacitor.getPlatform(),
    save: (value) => writeJson(SENT_KEY, value),
    post: async (body) => {
      const response = await fetch(PUSH_REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: withTimeout(),
      });
      if (!response.ok) throw new Error(`Push registration: HTTP ${response.status}`);
    },
  }));

// The topics a listener has switched on, sent to the server. False when the
// phone refused notifications.
export async function syncPushTopics(settings) {
  if (!pushIsOn()) return true;
  const topics = Object.keys(settings).filter((topic) => settings[topic]);
  return realClient().setTopics(topics);
}

// Call `handler(target)` when the listener taps a pushed notification.
export function onPushTap(handler) {
  if (!pushIsOn()) return () => {};
  const handle = PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const target = pushTarget(event.notification?.data);
    if (target) handler(target);
  });
  return () => handle.then((h) => h.remove()).catch(() => {});
}
