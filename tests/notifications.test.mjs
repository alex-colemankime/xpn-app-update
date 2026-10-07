// The phone's notifications share one budget (notifications.js): iOS keeps
// only the soonest 64 pending and drops the rest without a word.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateNotifications, NOTIFICATION_BUDGET } from "../notifications.js";

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
