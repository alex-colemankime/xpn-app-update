import { useEffect, useRef } from "react";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import {
  notificationsAreNative,
  onNotification,
  requestNotifications,
  syncNotifications,
} from "../notifications.js";
import { playStream, selectStream } from "../player.js";
import { LEAD_OPTIONS, reminderPlan } from "../reminders.js";
import { createLocalStore, useLocalStore } from "../storage.js";
import { showToast } from "../toast.js";
import { useEveryShow } from "./useEveryShow.js";

// Reminders before followed shows start.
//   - In the iOS and Android apps they are notifications scheduled on the
//     phone for the week ahead, so no server is involved and they arrive
//     with the app closed.
//   - In a browser, scheduled notifications are not possible, so the app
//     shows a heads-up with a Listen button while it is open.

const remindersStore = createLocalStore("xpn.reminders", { enabled: false, lead: 5 }, (v) => ({
  enabled: Boolean(v?.enabled),
  lead: LEAD_OPTIONS.includes(Number(v?.lead)) ? Number(v.lead) : 5,
}));

export const useReminderSettings = () => useLocalStore(remindersStore);
export const setReminderLead = (lead) => remindersStore.set((c) => ({ ...c, lead }));
export const disableReminders = () => remindersStore.set((c) => ({ ...c, enabled: false }));

export const OFF_IN_SETTINGS =
  "Notifications are off for WXPN. You can allow them in your phone’s Settings.";

// Turning reminders on is the one moment the app asks for notification
// permission, so the system prompt always arrives with its reason in view.
// `quiet`: the caller shows the result itself (the welcome moves on a step),
// so no notice covers it.
export async function enableReminders({ quiet = false } = {}) {
  if (!(await requestNotifications())) {
    showToast(OFF_IN_SETTINGS);
    return false;
  }
  remindersStore.set((c) => ({ ...c, enabled: true }));
  if (!quiet) showToast("Show reminders are on.");
  return true;
}

// `paused`: hold in-app heads-ups while something must not be covered (the
// first-run welcome); one that comes due meanwhile shows once it closes.
export function useShowReminders(onListen, { paused = false } = {}) {
  const heldSince = useRef(0);
  const settings = useReminderSettings();
  const followed = useFavoriteItems("shows");
  const ids = followed.map((s) => s.id).join(",");

  const listen = useRef(onListen);
  useEffect(() => {
    listen.current = () => {
      selectStream("xpn");
      playStream();
      onListen();
    };
  });

  // Native: keep the phone's schedule in step with follows and settings, and
  // roll the week forward whenever the app comes back to the foreground. If
  // notifications were switched off in the phone's Settings, reminders turn
  // off here too, so the switch never claims they will arrive.
  useEveryShow(() => {
    if (!notificationsAreNative()) return;
    const plan = settings.enabled
      ? reminderPlan({
          shows: SHOWS,
          showIds: ids ? ids.split(",") : [],
          leadMinutes: settings.lead,
        }).map(({ id, at, title, body, showId }) => ({
          id,
          at,
          title,
          body,
          extra: { showId },
        }))
      : [];
    syncNotifications("show-reminder", plan)
      .then((permission) => {
        if (settings.enabled && permission === "denied") {
          disableReminders();
          showToast(OFF_IN_SETTINGS);
        }
      })
      .catch(() => {});
  }, [settings.enabled, settings.lead, ids]);

  // Native: tapping a reminder opens Listen and starts the station.
  useEffect(() => onNotification("show-reminder", () => listen.current()), []);

  // Browser: a heads-up in the app when a reminder comes due while it is open.
  useEffect(() => {
    if (notificationsAreNative() || !settings.enabled || !ids) return;
    if (paused) {
      heldSince.current ||= Date.now();
      return;
    }
    const shown = new Set();
    const check = () => {
      const now = Date.now();
      // Planned from a minute ago, so a reminder that just came due is found;
      // after a hold, from when it began (up to ten minutes back, so a
      // heads-up is never about a show long under way).
      const from = Math.max(now - 600000, Math.min(now - 60000, heldSince.current || now));
      heldSince.current = 0;
      const due = reminderPlan({
        shows: SHOWS,
        showIds: ids.split(","),
        now: new Date(from),
        leadMinutes: settings.lead,
        days: 1,
      }).find((r) => r.at <= now && !shown.has(r.id));
      if (!due) return;
      shown.add(due.id);
      const show = SHOWS[due.showId];
      showToast(
        { title: due.title, text: show?.host || "On WXPN 88.5", image: show?.img },
        { label: "Listen", onClick: () => listen.current() },
      );
    };
    check();
    const timer = setInterval(check, 20000);
    return () => clearInterval(timer);
  }, [settings.enabled, settings.lead, ids, paused]);
}
