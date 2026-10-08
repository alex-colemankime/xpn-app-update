import { test } from "node:test";
import assert from "node:assert/strict";
import { alarmDue, dueAlarmDate, CATCHUP_MINUTES } from "../alarm.js";

test("the alarm window catches a minute a throttled tab would skip", () => {
  const alarm = { enabled: true, time: "07:00", repeatDays: [2], lastTriggeredDate: "" };
  const at = (h, m, s = 0) => new Date(2026, 8, 8, h, m, s); // a Tuesday
  assert.equal(dueAlarmDate(alarm, at(6, 59, 59)), null);
  assert.equal(dueAlarmDate(alarm, at(7, 0, 30)), "2026-09-08");
  assert.equal(dueAlarmDate(alarm, at(7, 1, 5)), "2026-09-08");
  assert.equal(dueAlarmDate(alarm, at(7, 0 + CATCHUP_MINUTES, 0)), null);
  assert.equal(dueAlarmDate({ ...alarm, time: "bad" }, at(7, 0)), null);
});

test("an alarm just before midnight still rings when caught just after", () => {
  const alarm = { enabled: true, time: "23:59", repeatDays: [2], lastTriggeredDate: "" };
  const wednesday = new Date(2026, 8, 9, 0, 0, 30);
  assert.equal(dueAlarmDate(alarm, wednesday), "2026-09-08", "Tuesday's alarm");
  assert.equal(alarmDue(alarm, wednesday), "alarm");
  assert.equal(alarmDue({ ...alarm, lastTriggeredDate: "2026-09-08" }, wednesday), null);
});

test("alarmDue rings on repeat days inside the window, once per day", () => {
  const base = {
    enabled: true,
    time: "07:00",
    repeatDays: [1, 2, 3, 4, 5],
    lastTriggeredDate: "",
    snoozeUntil: 0,
  };
  const monday = (h, m) => new Date(2026, 8, 28, h, m); // Sept 28 2026 is a Monday
  assert.equal(alarmDue(base, monday(7, 0)), "alarm");
  assert.equal(alarmDue(base, monday(7, 1)), "alarm", "catches a skipped minute");
  assert.equal(alarmDue(base, monday(7, 2)), null);
  assert.equal(alarmDue(base, monday(6, 59)), null);
  assert.equal(alarmDue({ ...base, enabled: false }, monday(7, 0)), null);
  assert.equal(alarmDue({ ...base, lastTriggeredDate: "2026-09-28" }, monday(7, 0)), null);
  assert.equal(alarmDue({ ...base, repeatDays: [0, 6] }, monday(7, 0)), null);
});

test("a snooze rings when it ends, and a stale one never does", () => {
  const now = new Date(2026, 8, 28, 9, 30);
  const base = { enabled: true, time: "07:00", repeatDays: [1], lastTriggeredDate: "2026-09-28" };
  assert.equal(alarmDue({ ...base, snoozeUntil: now.getTime() + 60000 }, now), null);
  assert.equal(alarmDue({ ...base, snoozeUntil: now.getTime() - 30000 }, now), "snooze");
  // The device slept through the end of the snooze: late beats silent.
  assert.equal(alarmDue({ ...base, snoozeUntil: now.getTime() - 20 * 60000 }, now), "snooze");
  // Snoozed, switched off, re-enabled days later: must stay quiet.
  assert.equal(alarmDue({ ...base, snoozeUntil: now.getTime() - 3 * 86400000 }, now), null);
});
