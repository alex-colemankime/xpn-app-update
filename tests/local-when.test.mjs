// "Tomorrow" across a change of the clocks (time.js, localWhen). The zone is
// set before time.js loads, since its formatters take the zone then.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TZ = "America/New_York";
const { localWhen } = await import("../time.js");

test("the night before the clocks spring forward, the next morning is tomorrow", () => {
  // Saturday, March 13, 2027, 11:30pm: that night has only 23 hours.
  const now = new Date(2027, 2, 13, 23, 30).getTime();
  const sundayMorning = new Date(2027, 2, 14, 10, 0).getTime();
  assert.equal(localWhen(sundayMorning, now), "Tomorrow at 10am");
});

test("the night before they fall back, the day after is still tomorrow", () => {
  const now = new Date(2026, 10, 1, 0, 30).getTime(); // a 25-hour day
  assert.equal(localWhen(new Date(2026, 10, 2, 0, 15).getTime(), now), "Tomorrow at 12:15am");
  assert.equal(localWhen(new Date(2026, 10, 1, 23, 0).getTime(), now), "Today at 11pm");
});
