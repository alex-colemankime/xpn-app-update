import { useEffect, useEffectEvent } from "react";
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
import { alertPlan } from "../updates.js";
import { OFF_IN_SETTINGS, useReminderSettings } from "./useShowReminders.js";
import { onPushTap, pushIsOn, syncPushTopics } from "../push.js";
import { playStream, selectStream } from "../player.js";
import { useEveryShow } from "./useEveryShow.js";
import { track } from "../analytics.js";

// Notifications from the station that a listener has asked for in Settings:
// live video (Free at Noon and other sessions) and member drives. Both are
// off until turned on there, with the consent wording beside the switch, as
// the App Store requires for anything promotional (App Review 4.5.4).
//
// They are planned from the station's updates file (updates.js, alertPlan)
// and scheduled on the phone like show reminders, so no push service is
// involved. The trade-off: a phone learns of a notice when the app opens, so
// the station posts them ahead (a drive's dates are known weeks out). A push
// service would reach phones that haven't opened the app; these switches are
// the consent it would use too.

const alertsStore = createLocalStore("xpn.alerts", { live: false, drives: false }, (v) => ({
  live: Boolean(v?.live),
  drives: Boolean(v?.drives),
}));

export const useAlertSettings = () => useLocalStore(alertsStore);

const TURNED_ON = {
  live: "Live video notifications are on.",
  drives: "Member drive notifications are on.",
};

// A tap on a switch: turning one on asks for notification permission first.
export async function setAlert(topic, on) {
  if (on && !(await requestNotifications())) {
    showToast(OFF_IN_SETTINGS);
    return false;
  }
  alertsStore.set((c) => ({ ...c, [topic]: on }));
  if (on) track("turn_on", { feature: topic });
  if (on) showToast(TURNED_ON[topic]);
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

  // With push set up, the station's sender delivers these; the phone only
  // keeps the listener's subscriptions up to date with it.
  useEffect(() => {
    syncPushTopics(settings)
      .then((ok) => {
        if (!ok) {
          alertsStore.set({ live: false, drives: false });
          showToast(OFF_IN_SETTINGS);
        }
      })
      .catch(() => {});
  }, [settings]);

  useEveryShow(() => {
    if (!notificationsAreNative()) return;
    const plan = (
      pushIsOn()
        ? []
        : alertPlan(updates, settings, {
            remindedShows: reminded ? reminded.split(",") : [],
          })
    ).map(({ key, at, title, body, extra }) => ({
      id: reminderId(`alert:${key}`, at),
      at,
      title,
      body,
      extra,
    }));
    syncNotifications("station-alert", plan)
      .then((permission) => {
        if ((settings.live || settings.drives) && permission === "denied") {
          alertsStore.set({ live: false, drives: false });
          showToast(OFF_IN_SETTINGS);
        }
      })
      .catch(() => {});
  }, [updates, settings, reminded]);

  // A tap opens what the notice is about: the video, or the station's page
  // (the donate page in a drive).
  const open = useEffectEvent((target) => {
    if (target?.action === "watch" && target.live?.watch) {
      watch({ ...target.live, state: "live" });
    } else if (target?.action === "open") {
      openPage(target.url);
    } else if (target?.action === "listen") {
      selectStream(target.stream);
      playStream();
    }
  });
  useEffect(() => {
    const offLocal = onNotification("station-alert", open);
    const offPush = onPushTap(open);
    return () => {
      offLocal();
      offPush();
    };
  }, []);
}
