import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useFavoriteItems } from "../favorites.js";
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
  live: "We’ll let you know before live video starts.",
  drives: "We’ll let you know during member drives.",
};

// A tap on a switch: turning one on asks for notification permission first.
export async function setAlert(topic, on) {
  if (on && !(await requestNotifications())) {
    showToast(OFF_IN_SETTINGS);
    return false;
  }
  alertsStore.set((c) => ({ ...c, [topic]: on }));
  if (on) showToast(TURNED_ON[topic]);
  return true;
}

// Open the station's page for a notice (the donate page in a drive) the way
// a live video opens on iOS: in the phone's browser view, so giving happens
// on xpn.org, never inside the app (App Review 3.2.2).
function openPage(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/browser")
      .then(({ Browser }) => Browser.open({ url }))
      .catch(() => window.open(url, "_blank", "noopener"));
  } else {
    window.open(url, "_blank", "noopener");
  }
}

// `updates`: every update in the station's file (not only those showing
// now). `onWatch(live)` opens a live video.
export function useStationAlerts(updates, { onWatch }) {
  const settings = useAlertSettings();
  const reminders = useReminderSettings();
  const followed = useFavoriteItems("shows");
  // A followed show already has its reminder; no second notification.
  const reminded = reminders.enabled ? followed.map((s) => s.id).join(",") : "";

  const watch = useRef(onWatch);
  useEffect(() => {
    watch.current = onWatch;
  });

  useEffect(() => {
    if (!notificationsAreNative()) return;
    const sync = () => {
      const plan = alertPlan(updates, settings, {
        remindedShows: reminded ? reminded.split(",") : [],
      }).map(({ key, at, title, body, extra }) => ({
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
    };
    sync();
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [updates, settings, reminded]);

  // A tap opens what the notice is about: the video, or the station's page.
  useEffect(
    () =>
      onNotification("station-alert", (extra) => {
        if (extra?.action === "watch" && extra.live?.watch) {
          watch.current({ ...extra.live, state: "live" });
        } else if (extra?.action === "open") {
          openPage(extra.url);
        }
      }),
    [],
  );
}
