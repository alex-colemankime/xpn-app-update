import { test } from "node:test";
import assert from "node:assert/strict";
import { alarmPlan, normalizeAlarm, ALARM_ID_BASE } from "../alarm.js";
import { reminderId } from "../reminders.js";

const local = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi);

test("the phone alarm is planned a week ahead on its repeat days", () => {
  const alarm = normalizeAlarm({ enabled: true, time: "07:00", repeatDays: [1, 3, 5] });
  const now = local(2026, 10, 5, 6, 0); // a Monday, before the alarm
  const plan = alarmPlan(alarm, now);
  const days = plan.map((a) => new Date(a.at).getDay());
  assert.deepEqual(days, [1, 3, 5, 1], "Mon, Wed, Fri, then next Mon");
  assert.ok(plan.every((a) => new Date(a.at).getHours() === 7));
  assert.equal(new Set(plan.map((a) => a.id)).size, plan.length, "ids are unique");
});

test("an alarm that already rang today, or is off, is not planned", () => {
  const now = local(2026, 10, 5, 6, 0);
  const rang = normalizeAlarm({
    enabled: true,
    time: "07:00",
    repeatDays: [1],
    lastTriggeredDate: "2026-10-05",
  });
  assert.deepEqual(
    alarmPlan(rang, now).map((a) => new Date(a.at).getDate()),
    [12],
  );
  assert.deepEqual(alarmPlan(normalizeAlarm({ enabled: false }), now), []);
});

test("a pending snooze is planned first", () => {
  const now = local(2026, 10, 5, 7, 2);
  const snoozeUntil = now.getTime() + 10 * 60000;
  const alarm = normalizeAlarm({ enabled: true, time: "07:00", repeatDays: [], snoozeUntil });
  assert.deepEqual(alarmPlan(alarm, now), [{ id: ALARM_ID_BASE, at: snoozeUntil }]);
});

test("reminder ids never collide with the alarm's", () => {
  for (let i = 0; i < 2000; i++) assert.ok(reminderId(`show${i}`, i * 60000) > ALARM_ID_BASE + 100);
});
