import { useCallback } from "react";
import { createLocalStore, useLocalStore } from "./storage.js";

export const DAY_LABELS = [
  { id: 0, short: "S", label: "Sunday" },
  { id: 1, short: "M", label: "Monday" },
  { id: 2, short: "T", label: "Tuesday" },
  { id: 3, short: "W", label: "Wednesday" },
  { id: 4, short: "T", label: "Thursday" },
  { id: 5, short: "F", label: "Friday" },
  { id: 6, short: "S", label: "Saturday" },
];

export const DEFAULT_ALARM = {
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
const clampSnooze = (value) => [5, 10, 15, 20].includes(Number(value)) ? Number(value) : DEFAULT_ALARM.snoozeMinutes;

const normalizeAlarm = (value) => ({
  ...DEFAULT_ALARM,
  ...(value && typeof value === "object" ? value : {}),
  enabled: Boolean(value?.enabled),
  time: isValidTime(value?.time) ? value.time : DEFAULT_ALARM.time,
  streamId: ["xpn", "xpn2", "kids"].includes(value?.streamId) ? value.streamId : DEFAULT_ALARM.streamId,
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
    alarmStore.set((current) => normalizeAlarm({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  }, []);

  return [alarm, updateAlarm];
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function timeKey(date = new Date()) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatAlarmTime(value) {
  if (!isValidTime(value)) return "";
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
