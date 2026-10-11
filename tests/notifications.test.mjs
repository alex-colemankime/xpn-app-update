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

test("an alarm about to ring stays on the phone when another plan changes", async () => {
  let clock = Date.UTC(2026, 9, 8, 6, 50);
  const device = phone();
  const scheduler = createScheduler({ api: device.api, now: () => clock });
  const ring = Date.UTC(2026, 9, 8, 7, 0);
  await scheduler.sync("radio-alarm", [{ id: 7, at: ring, title: "Good morning" }]);

  // Three seconds before it rings, a show reminder is planned.
  clock = ring - 3000;
  await scheduler.sync("show-reminder", [{ id: 1, at: ring + 3600000, title: "Later" }]);
  assert.ok(device.pending.has(7), "the alarm is still pending");
  assert.equal(
    device.scheduled.filter((n) => n.id === 7).length,
    1,
    "and was never cancelled and scheduled again",
  );

  // Turning the alarm off still takes it off the phone, however close.
  await scheduler.sync("radio-alarm", []);
  assert.ok(!device.pending.has(7));
});

test("an alarm about to ring survives a second, unrelated sync too", async () => {
  let clock = Date.UTC(2026, 9, 8, 6, 50);
  const device = phone();
  const scheduler = createScheduler({ api: device.api, now: () => clock });
  const ring = Date.UTC(2026, 9, 8, 7, 0);
  await scheduler.sync("radio-alarm", [{ id: 7, at: ring, title: "Good morning" }]);
  clock = ring - 3000;
  await scheduler.sync("show-reminder", [{ id: 1, at: ring + 3600000, title: "Later" }]);
  clock = ring - 2000;
  await scheduler.sync("station-alert", [{ id: 2, at: ring + 7200000, title: "Drive" }]);
  assert.ok(device.pending.has(7), "still pending after the second sync");
  // It rings, and is gone; a later sync doesn't bring it back.
  clock = ring + 1000;
  device.deliverUntil(ring);
  await scheduler.sync("show-reminder", []);
  assert.equal(device.scheduled.filter((n) => n.id === 7).length, 1);
  // And turning the alarm off still cancels one that's imminent.
  const next = clock + 60000;
  await scheduler.sync("radio-alarm", [{ id: 8, at: next, title: "Soon" }]);
  clock = next - 3000;
  await scheduler.sync("show-reminder", []);
  assert.ok(device.pending.has(8));
  await scheduler.sync("radio-alarm", []);
  assert.ok(!device.pending.has(8));
});

// The phone's notification events, as Capacitor delivers them: an event with
// nobody listening is held, and handed only to the first listener added.
function capacitorEvents() {
  const listeners = {};
  const retained = {};
  return {
    added: () => Object.values(listeners).flat().length,
    addListener(event, fn) {
      (listeners[event] ||= []).push(fn);
      if (listeners[event].length === 1 && retained[event]) {
        retained[event].splice(0).forEach((p) => fn(p));
      }
      return Promise.resolve({ remove: async () => {} });
    },
    fire(event, payload) {
      if (listeners[event]?.length) listeners[event].forEach((fn) => fn(payload));
      else (retained[event] ||= []).push(payload);
    },
  };
}
const tap = (kind, more = {}) => ({ notification: { extra: { kind, ...more } } });

test("a reminder tapped to open the app reaches its handler, though the alarm listened first", async () => {
  const { createNotificationRouter } = await import("../notifications.js");
  const phone = capacitorEvents();
  // The tap that launched the app, before anything listens.
  phone.fire("localNotificationActionPerformed", tap("show-reminder", { show: "worldcafe" }));
  const on = createNotificationRouter(phone.addListener);
  const alarms = [];
  const reminders = [];
  on("radio-alarm", (extra) => alarms.push(extra), { whileOpen: true });
  on("show-reminder", (extra) => reminders.push(extra));
  assert.deepEqual(alarms, []);
  assert.deepEqual(reminders, [{ kind: "show-reminder", show: "worldcafe" }]);
  assert.equal(phone.added(), 2, "one listener per event, shared by every kind");
});

test("arriving while open goes only to handlers that asked; taps wait, arrivals don't", async () => {
  const { createNotificationRouter } = await import("../notifications.js");
  const phone = capacitorEvents();
  const on = createNotificationRouter(phone.addListener);
  const alarms = [];
  const reminders = [];
  on("radio-alarm", (extra) => alarms.push(extra.kind), { whileOpen: true });
  const stop = on("show-reminder", (extra) => reminders.push(extra.kind));
  phone.fire("localNotificationReceived", tap("radio-alarm"));
  phone.fire("localNotificationReceived", tap("show-reminder"));
  assert.deepEqual(alarms, ["radio-alarm"]);
  assert.deepEqual(reminders, []);
  stop();
  phone.fire("localNotificationActionPerformed", tap("show-reminder"));
  phone.fire("localNotificationReceived", tap("show-reminder"));
  on("show-reminder", (extra) => reminders.push(extra.kind));
  assert.deepEqual(reminders, ["show-reminder"], "the tap waited for the next handler");
});
