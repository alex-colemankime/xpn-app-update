import { useCallback } from "react";
import { createLocalStore, useLocalStore } from "./storage.js";
import { STREAM_IDS } from "./streams.js";

export const DAY_LABELS = [
  { id: 0, label: "Sunday" },
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
];
export const SNOOZE_OPTIONS = [5, 10, 15, 20];

const DEFAULT_ALARM = {
  enabled: false,
  time: "07:00",
  streamId: "xpn",
  repeatDays: [1, 2, 3, 4, 5],
  volume: 70,
  snoozeMinutes: 10,
  lastTriggeredDate: "",
  snoozeUntil: 0,
};

const isValidTime = (value) => /^\d{2}:\d{2}$/.test(value || "");
const clampVolume = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const clampSnooze = (value) =>
  SNOOZE_OPTIONS.includes(Number(value)) ? Number(value) : DEFAULT_ALARM.snoozeMinutes;

export const normalizeAlarm = (value) => ({
  ...DEFAULT_ALARM,
  ...(value && typeof value === "object" ? value : {}),
  enabled: Boolean(value?.enabled),
  time: isValidTime(value?.time) ? value.time : DEFAULT_ALARM.time,
  streamId: STREAM_IDS.includes(value?.streamId) ? value.streamId : DEFAULT_ALARM.streamId,
  repeatDays: Array.isArray(value?.repeatDays)
    ? [...new Set(value.repeatDays.map(Number).filter((day) => day >= 0 && day <= 6))].sort()
    : DEFAULT_ALARM.repeatDays,
  volume: clampVolume(value?.volume ?? DEFAULT_ALARM.volume),
  snoozeMinutes: clampSnooze(value?.snoozeMinutes),
  lastTriggeredDate: String(value?.lastTriggeredDate || ""),
  snoozeUntil: Number(value?.snoozeUntil || 0),
});

const alarmStore = createLocalStore("xpn.alarm.v1", DEFAULT_ALARM, normalizeAlarm);

export function useAlarmSettings() {
  const alarm = useLocalStore(alarmStore);
  const updateAlarm = useCallback((patch) => {
    alarmStore.set((current) =>
      normalizeAlarm({
        ...current,
        ...(typeof patch === "function" ? patch(current) : patch),
      }),
    );
  }, []);

  return [alarm, updateAlarm];
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Minutes since today's alarm time (negative before it). A window rather
// than an exact-minute match, so a throttled background tab that only gets
// one timer callback a minute cannot skip past the alarm entirely.
export const CATCHUP_MINUTES = 2;
export function minutesSinceAlarm(value, now = new Date()) {
  if (!isValidTime(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() - (hour * 60 + minute);
}

// A snooze whose end passed while the device slept still rings, up to an
// hour late; an older one (say, left from days ago) never does.
const SNOOZE_GRACE_MINUTES = 60;

// What should ring right now: "alarm", "snooze", or null.
export function alarmDue(alarm, now = new Date()) {
  if (!alarm.enabled) return null;
  const t = now.getTime();
  if (alarm.snoozeUntil > t) return null;
  if (alarm.snoozeUntil && t - alarm.snoozeUntil < SNOOZE_GRACE_MINUTES * 60000) return "snooze";
  const since = minutesSinceAlarm(alarm.time, now);
  const due =
    alarm.repeatDays.includes(now.getDay()) &&
    alarm.lastTriggeredDate !== dateKey(now) &&
    since !== null &&
    since >= 0 &&
    since < CATCHUP_MINUTES;
  return due ? "alarm" : null;
}

// For the phone apps, where the alarm is a notification scheduled ahead:
// every time it should ring over the next week, in the listener's own time,
// plus a pending snooze. [{ id, at }], soonest first. Ids are fixed per slot
// (re-planning replaces them) and sit below the range reminders use.
export const ALARM_ID_BASE = 1000;
export function alarmPlan(alarm, now = new Date(), days = 7) {
  if (!alarm.enabled) return [];
  const plan = [];
  if (alarm.snoozeUntil > now.getTime()) plan.push({ id: ALARM_ID_BASE, at: alarm.snoozeUntil });
  const [hour, minute] = alarm.time.split(":").map(Number);
  for (let k = 0; k <= days; k++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, hour, minute);
    if (at <= now || !alarm.repeatDays.includes(at.getDay())) continue;
    if (dateKey(at) === alarm.lastTriggeredDate) continue; // already rang today
    plan.push({ id: ALARM_ID_BASE + 1 + k, at: at.getTime() });
  }
  return plan.sort((a, b) => a.at - b.at);
}
