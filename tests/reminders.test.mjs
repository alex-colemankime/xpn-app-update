import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { easternToEpoch, shiftDate } from "../time.js";
import { upcomingStarts } from "../schedule.js";
import { reminderPlan, reminderId, MAX_REMINDERS } from "../reminders.js";

const SHOWS = JSON.parse(fs.readFileSync(new URL("../shows.json", import.meta.url), "utf8"));
const iso = (t) => new Date(t).toISOString();

test("Eastern wall-clock times map to the right instant across DST", () => {
  assert.equal(
    iso(easternToEpoch("2026-10-05", "14:00")),
    "2026-10-05T18:00:00.000Z",
    "EDT is UTC-4",
  );
  assert.equal(
    iso(easternToEpoch("2026-12-07", "14:00")),
    "2026-12-07T19:00:00.000Z",
    "EST is UTC-5",
  );
  assert.equal(easternToEpoch("2026-03-08", "02:30"), null, "skipped spring hour");
  assert.equal(
    iso(easternToEpoch("2026-11-01", "01:30")),
    "2026-11-01T05:30:00.000Z",
    "first of the repeated hour",
  );
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});

test("upcoming starts skip what has begun and run a week ahead", () => {
  const starts = upcomingStarts(
    SHOWS,
    ["worldcafe"],
    { date: "2026-10-05", day: "Monday", time: "15:00" },
    7,
  );
  assert.deepEqual(
    starts.map((s) => s.date),
    ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"],
    "Monday's has started; weekdays only",
  );
  assert.ok(starts.every((s) => s.start === "14:00"));
  assert.deepEqual(
    upcomingStarts(SHOWS, ["nope"], {
      date: "2026-10-05",
      day: "Monday",
      time: "09:00",
    }),
    [],
  );
});

test("the reminder plan lands lead minutes before each airing", () => {
  const now = new Date("2026-10-05T13:00:00Z"); // Monday 9am ET
  const plan = reminderPlan({ shows: SHOWS, showIds: ["worldcafe", "funky"], now, leadMinutes: 5 });
  const first = plan[0];
  assert.equal(first.showId, "worldcafe");
  assert.equal(iso(first.at), "2026-10-05T17:55:00.000Z", "1:55pm ET for a 2pm show");
  assert.equal(first.title, "World Cafe starts in 5 minutes");
  assert.match(first.body, /Raina Douris/);
  assert.ok(
    plan.some((r) => r.showId === "funky"),
    "Funky Friday is in the week",
  );
  assert.deepEqual(
    [...plan].sort((a, b) => a.at - b.at),
    plan,
    "soonest first",
  );
  assert.equal(new Set(plan.map((r) => r.id)).size, plan.length, "ids are unique");
  const atStart = reminderPlan({ shows: SHOWS, showIds: ["worldcafe"], now, leadMinutes: 0 });
  assert.equal(atStart[0].title, "World Cafe is on now");
});

test("ids are stable, and the plan respects the platform limit", () => {
  assert.equal(reminderId("worldcafe", 1), reminderId("worldcafe", 1));
  assert.notEqual(reminderId("worldcafe", 1), reminderId("worldcafe", 2));
  assert.ok(reminderId("x", 5) > 0 && reminderId("x", 5) < 2 ** 31);
  const everything = reminderPlan({
    shows: SHOWS,
    showIds: Object.keys(SHOWS),
    now: new Date("2026-10-05T13:00:00Z"),
  });
  assert.equal(everything.length, MAX_REMINDERS);
});
