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
import { createStore, readJson, writeJson } from "./storage.js";
import { webUrl } from "./text.js";
import { featureOn } from "./features.js";

const SENT_KEY = "xpn.push.sent";
const APP_ID = "org.xpn.wxpn";
const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

export const pushIsOn = () => featureOn("push") && Capacitor.isNativePlatform();

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
// The topics in what was last sent ("token|drives,live"), or none.
export const topicsIn = (sent) =>
  sent?.token && typeof sent.key === "string"
    ? sent.key
        .slice(sent.key.indexOf("|") + 1)
        .split(",")
        .filter(Boolean)
    : [];

const REGISTER_TIMEOUT_MS = 15000;

export function createPushClient({
  api,
  post,
  platform,
  sent = readJson(SENT_KEY, null),
  save,
  // Called whenever status() may have changed.
  onChange,
  // A phone that never answers (no connection to Apple's push service, say)
  // mustn't hold up later changes, turning everything off among them.
  registerTimeout = REGISTER_TIMEOUT_MS,
}) {
  let token = sent?.token || null;
  let topics = [];
  let registering = null;
  let waiting = null;
  let listening = false;
  // Whether the last attempt to bring the server up to date failed
  // (registration, or a request: a new topic list or a replaced token).
  let failing = false;
  const settle = (ok) => {
    failing = !ok;
    onChange?.();
  };
  // Changes are sent one at a time, each with the latest topics, so a quick
  // on-then-off can't end with the older "on" arriving last.
  let queue = Promise.resolve();

  // Tell the server, once per change of token or topics.
  async function report() {
    if (!token) return;
    const key = `${token}|${topics.join(",")}`;
    if (sent?.key === key) return;
    await post({ token, platform, topics, app: APP_ID, version: VERSION });
    sent = { token, key };
    save?.(sent);
  }

  // The phone's answers to register(), listened for once.
  function listen() {
    if (listening) return;
    listening = true;
    api.addListener("registration", ({ value }) => {
      token = value;
      if (waiting) {
        // The token register() is waiting for; setTopics reports it.
        const { resolve } = waiting;
        waiting = null;
        resolve(value);
      } else {
        // A token later (the phone replaced it, or it answered after giving
        // up) is reported by itself, in turn with any change under way.
        queue = queue.then(report).then(
          () => settle(true),
          () => settle(false),
        );
      }
    });
    api.addListener("registrationError", (error) => failed(error));
  }
  // A failed registration is forgotten, so the next attempt registers again.
  function failed(error) {
    registering = null;
    if (!waiting) return;
    const { reject } = waiting;
    waiting = null;
    reject(error);
  }

  // Ask the phone for its token, once per session once it has worked.
  function register() {
    listen();
    registering ??= new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => failed(new Error("Push registration: no answer")),
        registerTimeout,
      );
      waiting = {
        resolve: (value) => (clearTimeout(timer), resolve(value)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      };
      Promise.resolve()
        .then(() => api.register())
        .catch(failed);
    });
    return registering;
  }

  async function apply() {
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

  // The listener's subscriptions changed (or the app opened). Turning any on
  // registers the phone; turning all off tells the server to send nothing.
  // Resolves true once the server has them, false if the phone refused
  // notifications; rejects if registration or the server failed.
  function setTopics(next) {
    topics = [...next].sort();
    const run = queue.then(apply).then(
      (ok) => (settle(true), ok),
      (error) => {
        settle(false);
        throw error;
      },
    );
    queue = run.catch(() => {});
    return run;
  }

  // The topics the sender has for this phone, as last confirmed, and
  // whether bringing it up to date last failed.
  const status = () => ({ topics: topicsIn(sent), failing });

  return { setTopics, status };
}

let client = null;
const realClient = () =>
  (client ??= createPushClient({
    api: PushNotifications,
    platform: Capacitor.getPlatform(),
    save: (value) => writeJson(SENT_KEY, value),
    onChange: () => setStatus(client.status()),
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

// What the sender has for this phone: its topics (as of the last confirmed
// request, kept from the last session too) and whether bringing it up to
// date last failed. The phone schedules itself whatever the sender doesn't
// cover (useStationAlerts), and everything while it's failing, since a
// replaced token may have left the old one dead.
const NO_PUSH = { topics: [], failing: false };
const statusStore = createStore({ ...NO_PUSH, topics: topicsIn(readJson(SENT_KEY, null)) });
export const subscribePushStatus = statusStore.subscribe;
export const getPushStatus = statusStore.getSnapshot;
const setStatus = (next) => {
  const now = statusStore.getSnapshot();
  if (next.failing !== now.failing || next.topics.join(",") !== now.topics.join(",")) {
    statusStore.set(next);
  }
};

// What the sender should have for this phone: the topics switched on, or
// none once the station switches push off. Pure, so it can be tested.
export const topicsToSend = (settings, pushOn) =>
  pushOn ? Object.keys(settings).filter((topic) => settings[topic]) : [];

// The topics a listener has switched on, sent to the server. With push
// switched off by the station, the server is told to send nothing (when it
// had anything). False when the phone refused notifications; rejects when
// registration or the server failed (the phone then schedules the notices
// itself, and tries again when the app comes back to the foreground or the
// connection returns).
export async function syncPushTopics(settings) {
  if (!Capacitor.isNativePlatform() || !PUSH_REGISTER_URL) {
    setStatus(NO_PUSH);
    return true;
  }
  const on = featureOn("push");
  if (!on && !client && !topicsIn(readJson(SENT_KEY, null)).length) {
    setStatus(NO_PUSH);
    return true;
  }
  return realClient().setTopics(topicsToSend(settings, on));
}

// Call `handler(target)` when the listener taps a pushed notification
// (useStationAlerts listens while push is on, or the sender still has
// topics for this phone).
export function onPushTap(handler) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const target = pushTarget(event.notification?.data);
    if (target) handler(target);
  });
  return () => handle.then((h) => h.remove()).catch(() => {});
}
