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

// The days an alarm repeats, short: "Weekdays", "Every day", "Mon, Wed, Fri".
export function repeatLabel(days) {
  const set = [...new Set(days)].sort().join();
  if (!set) return "No days chosen";
  if (set === "0,1,2,3,4,5,6") return "Every day";
  if (set === "1,2,3,4,5") return "Weekdays";
  if (set === "0,6") return "Weekends";
  return DAY_LABELS.filter((d) => days.includes(d.id))
    .map((d) => d.label.slice(0, 3))
    .join(", ");
}

// The days as they read inside a sentence: "on weekdays", "every day",
// "on Mon, Wed and Fri". Null when no day is chosen.
export function repeatPhrase(days) {
  const set = [...new Set(days)].sort().join();
  if (!set) return null;
  if (set === "0,1,2,3,4,5,6") return "every day";
  if (set === "1,2,3,4,5") return "on weekdays";
  if (set === "0,6") return "on weekends";
  const names = DAY_LABELS.filter((d) => days.includes(d.id)).map((d) => d.label);
  return `on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}`;
}

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
    ? [
        ...new Set(
          value.repeatDays
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        ),
      ].sort()
    : DEFAULT_ALARM.repeatDays,
  volume: clampVolume(value?.volume ?? DEFAULT_ALARM.volume),
  snoozeMinutes: clampSnooze(value?.snoozeMinutes),
  lastTriggeredDate: String(value?.lastTriggeredDate || ""),
  snoozeUntil: Number(value?.snoozeUntil || 0),
});

const alarmStore = createLocalStore("xpn.alarm.v1", DEFAULT_ALARM, normalizeAlarm);

// A change to the alarm: fields to set, or a function of the current alarm
// returning them. Module-level, so its identity never changes.
function updateAlarm(patch) {
  alarmStore.set((current) =>
    normalizeAlarm({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }),
  );
}

export function useAlarmSettings() {
  return [useLocalStore(alarmStore), updateAlarm];
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The day ("2026-10-08") of an alarm that should ring now, or null. A
// window rather than an exact-minute match, so a throttled background tab
// that only gets one timer callback a minute cannot skip past the alarm.
// Yesterday counts too: an 11:59pm alarm caught at 12:00am still rings.
export const CATCHUP_MINUTES = 2;
export function dueAlarmDate(alarm, now = new Date()) {
  if (!isValidTime(alarm.time)) return null;
  const [hour, minute] = alarm.time.split(":").map(Number);
  for (const back of [0, 1]) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, hour, minute);
    const since = Math.floor((now - at) / 60000);
    const day = dateKey(at);
    if (
      since >= 0 &&
      since < CATCHUP_MINUTES &&
      alarm.repeatDays.includes(at.getDay()) &&
      alarm.lastTriggeredDate !== day
    ) {
      return day;
    }
  }
  return null;
}

// The day ("2026-10-08") a ring belongs to: the alarm's latest time, on one
// of its days, at or before `now`. A snooze that rings after midnight, or an
// alarm notification tapped late, belongs to the day the alarm went off;
// recording today instead would skip today's own alarm. With no such time in
// the past week (no days chosen), what was recorded stays.
export function ringDay(alarm, now = new Date()) {
  if (isValidTime(alarm.time)) {
    const [hour, minute] = alarm.time.split(":").map(Number);
    for (let back = 0; back < 7; back++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, hour, minute);
      if (at <= now && alarm.repeatDays.includes(at.getDay())) return dateKey(at);
    }
  }
  return alarm.lastTriggeredDate;
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
  return dueAlarmDate(alarm, now) ? "alarm" : null;
}

// For the phone apps, where the alarm is a notification the phone keeps:
// one for each of its days, repeating weekly by itself (`on`, Capacitor's
// weekday: 1 is Sunday), so it rings whether or not the app is opened again,
// plus a pending snooze. [{ id, at, on? }], soonest first; `at` is each one's
// next time. Ids are fixed per day (re-planning replaces them) and sit below
// the range reminders use. (The phone repeats a day's alarm without knowing
// what has rung: one that already rang today, moved later in the day, rings
// again; the app, opened by it, rings it only once.)
export const ALARM_ID_BASE = 1000;
export function alarmPlan(alarm, now = new Date()) {
  if (!alarm.enabled || !isValidTime(alarm.time)) return [];
  const plan = [];
  if (alarm.snoozeUntil > now.getTime()) plan.push({ id: ALARM_ID_BASE, at: alarm.snoozeUntil });
  const [hour, minute] = alarm.time.split(":").map(Number);
  for (const day of new Set(alarm.repeatDays)) {
    // Its next time: today's if still to come (and it hasn't rung today),
    // else a later day's.
    let at = null;
    for (let k = 0; k <= 7 && !at; k++) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, hour, minute);
      if (t > now && t.getDay() === day && dateKey(t) !== alarm.lastTriggeredDate) at = t;
    }
    if (!at) continue;
    plan.push({
      id: ALARM_ID_BASE + 1 + day,
      at: at.getTime(),
      on: { weekday: day + 1, hour, minute },
    });
  }
  return plan.sort((a, b) => a.at - b.at);
}
