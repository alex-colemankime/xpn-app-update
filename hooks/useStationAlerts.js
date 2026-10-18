import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { useFavoriteItems } from "../favorites.js";
import { openPage } from "../links.js";
import {
  notificationsAreNative,
  onNotification,
  requestNotifications,
  syncNotifications,
} from "../notifications.js";
import { reminderId } from "../reminders.js";
import { createLocalStore, useLocalStore } from "../storage.js";
import { showToast } from "../toast.js";
import { alertPlan, normalizeAlertSettings } from "../updates.js";
import { OFF_IN_SETTINGS, useReminderSettings } from "./useShowReminders.js";
import {
  getPushStatus,
  kindsPushed,
  onPushTap,
  pushIsOn,
  subscribePushStatus,
  syncPushTopics,
  topicsToSend,
} from "../push.js";
import { useFeatures } from "../features.js";
import { playStation } from "../player.js";
import { useEveryShow } from "./useEveryShow.js";
import { track } from "../analytics.js";

// Notifications from the station, for a listener who turned them on in
// Settings: live video (Free at Noon and other sessions), member drives and
// whatever else the station sends, under one switch. Off until turned on
// there, with the consent wording beside the switch, as the App Store
// requires for anything promotional (App Review 4.5.4).
//
// Without push (push.js), they are planned from the station's updates file
// (updates.js, alertPlan) and scheduled on the phone like show reminders. The trade-off: a phone learns of a notice when the app opens, so
// the station posts them ahead (a drive's dates are known weeks out). A push
// service would reach phones that haven't opened the app; this switch is
// the consent it would use too.

// On or off, and a choice carried over from the version with a switch per
// kind until the listener turns everything on (updates.js,
// normalizeAlertSettings).
const alertsStore = createLocalStore("xpn.alerts", { on: false }, normalizeAlertSettings);

export const useAlertSettings = () => useLocalStore(alertsStore);
const NONE = [];
const OFF = { on: false };

// A tap on the switch: turning it on asks for notification permission first.
// Turned on here, it's for everything the station sends.
export async function setAlerts(on) {
  if (on && !(await requestNotifications())) {
    showToast(OFF_IN_SETTINGS);
    return false;
  }
  alertsStore.set({ on });
  // The switch says it's on; no notice repeats it.
  if (on) track("turn_on", { feature: "station_notifications" });
  return true;
}

// `updates`: every update in the station's file (not only those showing
// now). `onWatch(live)` opens a live video.
export function useStationAlerts(updates, { onWatch }) {
  const settings = useAlertSettings();
  const reminders = useReminderSettings();
  const followed = useFavoriteItems("shows");
  // A followed show already has its reminder; no second notification.
  const reminded = reminders.enabled ? followed.map((s) => s.id).join(",") : "";

  const watch = useEffectEvent((live) => onWatch(live));

  // With push set up, the station's sender delivers these; the phone keeps
  // the listener's subscriptions up to date with it. Until the sender has
  // them (registration or the server failed), the phone schedules them
  // itself below, and tries the sender again when the app comes back to the
  // foreground or the connection returns. Follows the station's push switch
  // too, so turning push on (or off) remotely applies straight away.
  const pushOn = useFeatures().push;
  const status = useSyncExternalStore(subscribePushStatus, getPushStatus);
  // What the sender covers, left to it; while it's failing, the phone
  // schedules everything (a replaced token may have left the old one dead).
  const pushed = status.failing ? NONE : status.topics;
  // What the sender should have: the listener's topics while push is on,
  // nothing once the station switches it off.
  const wanted = topicsToSend(settings.on, pushIsOn(), settings.kinds);
  const behind = status.failing || [...wanted].sort().join(",") !== status.topics.join(",");
  const syncPush = useEffectEvent(() => {
    syncPushTopics(settings.on, settings.kinds)
      .then((ok) => {
        if (!ok) {
          alertsStore.set(OFF);
          showToast(OFF_IN_SETTINGS);
        }
      })
      .catch(() => {});
  });
  useEffect(() => syncPush(), [settings, pushOn]);
  useEffect(() => {
    if (!behind) return;
    const retry = () => {
      if (document.visibilityState === "visible") syncPush();
    };
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
    };
  }, [behind]);

  useEveryShow(() => {
    if (!notificationsAreNative()) return;
    // What the sender already delivers isn't scheduled here as well.
    const covered = pushIsOn() ? kindsPushed(pushed) : [];
    const kinds = (settings.kinds || ["live", "drives"]).filter((k) => !covered.includes(k));
    const plan = alertPlan(updates, settings.on && kinds.length > 0, {
      remindedShows: reminded ? reminded.split(",") : [],
      kinds,
    }).map(({ key, at, title, body, extra }) => ({
      id: reminderId(`alert:${key}`, at),
      at,
      title,
      body,
      extra,
    }));
    syncNotifications("station-alert", plan)
      .then((permission) => {
        if (settings.on && permission === "denied") {
          alertsStore.set(OFF);
          showToast(OFF_IN_SETTINGS);
        }
      })
      .catch(() => {});
  }, [updates, settings, reminded, pushed]);

  // A tap opens what the notice is about: the video, or the station's page
  // (the donate page in a drive).
  const open = useEffectEvent((target) => {
    if (target?.action === "watch" && target.live?.watch) {
      // `pushed`: the link itself is what to play (useWatching, liveToShow).
      watch({ ...target.live, state: "live", pushed: true });
    } else if (target?.action === "open") {
      openPage(target.url);
    } else if (target?.action === "listen") {
      playStation(target.stream);
    }
  });
  useEffect(() => onNotification("station-alert", open), []);
  // Pushed notifications' taps, while push is on or the sender may still
  // send (it has topics for this phone until told otherwise).
  const pushTaps = pushOn || status.topics.length > 0;
  useEffect(() => (pushTaps ? onPushTap(open) : undefined), [pushTaps]);
}
