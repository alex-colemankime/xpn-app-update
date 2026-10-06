import { test, mock } from "node:test";
import assert from "node:assert/strict";

// The shared clock pauses while the app is hidden, except while audio plays:
// then the lock screen's song info still needs the real time.
const listeners = [];
globalThis.document = {
  visibilityState: "hidden",
  addEventListener: (_, f) => listeners.push(f),
};
mock.timers.enable({ apis: ["setInterval", "Date"], now: Date.parse("2026-10-05T14:00:00Z") });
const { subscribeClock, getNow, keepClockRunning } = await import("../hooks/useNow.js");

test("hidden: the clock stops; hidden while playing: it keeps time", () => {
  const stop = subscribeClock(() => {});
  const start = getNow();
  mock.timers.tick(5 * 60000);
  assert.equal(getNow(), start, "paused while hidden and silent");
  keepClockRunning(true);
  mock.timers.tick(5 * 60000);
  assert.ok(getNow() - start >= 5 * 60000, "advancing while audio plays");
  keepClockRunning(false);
  const paused = getNow();
  mock.timers.tick(60000);
  assert.equal(getNow(), paused);
  stop();
});
