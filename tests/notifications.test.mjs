// The phone's notifications share one budget (notifications.js): iOS keeps
// only the soonest 64 pending and drops the rest without a word.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateNotifications, createScheduler, NOTIFICATION_BUDGET } from "../notifications.js";

const DAY = 86400000;
const many = (n, start, step, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, at: start + i * step }));

test("reminders, alarms and station notifications together stay within the budget", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  const plans = {
    "show-reminder": many(48, now + 60000, 3 * 3600000, "r"),
    "radio-alarm": many(8, now + 6 * DAY, DAY, "a"), // the alarms are the furthest off
    "station-alert": many(12, now + 120000, 6 * 3600000, "s"),
  };
  const kept = allocateNotifications(plans);
  assert.equal(kept.length, NOTIFICATION_BUDGET, "68 planned, 60 kept");
  assert.equal(
    kept.filter((n) => n.kind === "radio-alarm").length,
    8,
    "every alarm, however far off",
  );
  const others = kept.filter((n) => n.kind !== "radio-alarm");
  const latestKept = Math.max(...others.map((n) => n.at));
  const dropped = [...plans["show-reminder"], ...plans["station-alert"]].filter(
    (n) => !kept.some((k) => k.id === n.id),
  );
  assert.equal(dropped.length, 8);
  assert.ok(
    dropped.every((n) => n.at >= latestKept),
    "what waits is the furthest off",
  );
});

test("notifications already on the phone from another kind leave less room", () => {
  const plans = { "show-reminder": many(48, 0, 1, "r"), "radio-alarm": many(2, 0, 1, "a") };
  assert.equal(allocateNotifications(plans, 10).length, 10);
  assert.equal(allocateNotifications(plans, 10).filter((n) => n.kind === "radio-alarm").length, 2);
  assert.deepEqual(allocateNotifications(plans, 0), []);
});

// A stand-in for the phone: what is pending, and what was ever scheduled.
function phone() {
  const pending = new Map();
  const scheduled = [];
  return {
    pending,
    scheduled,
    api: {
      getPending: async () => ({ notifications: [...pending.values()] }),
      cancel: async ({ notifications }) => notifications.forEach((n) => pending.delete(n.id)),
      schedule: async ({ notifications }) =>
        notifications.forEach((n) => {
          scheduled.push(n);
          pending.set(n.id, n);
        }),
    },
    // The phone shows what has come due and drops it from the pending list.
    deliverUntil: (t) => {
      for (const [id, n] of pending) if (n.schedule.at.getTime() <= t) pending.delete(id);
    },
  };
}

test("a notification already delivered is never scheduled again", async () => {
  let clock = Date.UTC(2026, 9, 7, 13, 55);
  const device = phone();
  const trouble = [];
  const scheduler = createScheduler({
    api: device.api,
    now: () => clock,
    onTrouble: (t) => trouble.push(t),
  });
  const reminder = { id: 1, at: Date.UTC(2026, 9, 7, 14, 0), title: "World Cafe starts soon" };
  await scheduler.sync("show-reminder", [reminder]);
  assert.equal(device.scheduled.length, 1);

  // The reminder arrives while the app stays open; later an alarm setting
  // changes, which plans every kind again.
  clock = Date.UTC(2026, 9, 7, 14, 30);
  device.deliverUntil(clock);
  await scheduler.sync("radio-alarm", []);
  assert.equal(device.scheduled.length, 1, "the delivered reminder isn't scheduled a second time");
  assert.equal(trouble.at(-1), false, "and nothing is reported missing");
});

test("a notification due within seconds is left out rather than delivered early", async () => {
  const clock = Date.UTC(2026, 9, 7, 13, 59, 58);
  const device = phone();
  const scheduler = createScheduler({ api: device.api, now: () => clock });
  await scheduler.sync("show-reminder", [
    { id: 1, at: clock + 2000, title: "now" },
    { id: 2, at: clock + 3600000, title: "later" },
  ]);
  assert.deepEqual(
    device.scheduled.map((n) => n.id),
    [2],
  );
});
