import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DAYS } from "../time.js";
import { scheduleLines } from "../schedule.js";
import { SHOWS, airingSoon, onAirAt, nextAiringOf, untilLabel } from "../catalog.js";

const raw = JSON.parse(fs.readFileSync(new URL("../shows.json", import.meta.url), "utf8"));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// The schedule is edited by hand, so the data itself is checked.
test("shows.json is well formed", () => {
  for (const [key, show] of Object.entries(raw)) {
    assert.equal(show.id, key, `${key}: key matches id`);
    assert.ok(show.name?.trim(), `${key}: has a name`);
    assert.equal(typeof show.host, "string", `${key}: host is text (may be empty)`);
    assert.ok(show.desc?.trim(), `${key}: has a description`);
    if (show.img.startsWith("shows/")) {
      assert.ok(
        fs.existsSync(new URL(`../public/${show.img}`, import.meta.url)),
        `${key}: image exists`,
      );
    } else {
      assert.match(show.img, /^https:\/\//, `${key}: image is https`);
    }
    if (!show.schedule?.length) assert.ok(show.time, `${key}: unscheduled shows say when instead`);
    for (const slot of show.schedule || []) {
      assert.match(slot.start, HHMM, `${key}: start ${slot.start}`);
      assert.match(slot.end, HHMM, `${key}: end ${slot.end}`);
      assert.notEqual(slot.end, "23:59", `${key}: midnight is written 00:00`);
      assert.ok(slot.days.length, `${key}: slot has days`);
      for (const day of slot.days) assert.ok(DAYS.includes(day), `${key}: day ${day}`);
    }
  }
});

test("air times read the same way for every show", () => {
  assert.deepEqual(scheduleLines(raw.worldcafe), ["Weekdays, 2–4pm"]);
  assert.deepEqual(scheduleLines(raw.sleepyhollow), ["Weekends, 6–10am"]);
  assert.deepEqual(scheduleLines(raw.freeatnoon), ["Fridays, noon–1pm"]);
  assert.deepEqual(scheduleLines(raw.middays), ["Mon–Thu, 10am–2pm", "Fridays, 10am–noon & 1–2pm"]);
  assert.deepEqual(scheduleLines(raw.afternoons), ["Mon–Thu, 4–6pm & 7–8pm"]);
  assert.deepEqual(scheduleLines(raw.americanroutes), ["Saturdays, 11pm–1am"]);
  assert.deepEqual(SHOWS.worldcafe.times, ["Weekdays, 2–4pm"]);
});

test("on air and next airing carry real moments", () => {
  const at = new Date("2026-10-05T14:40:00-04:00"); // Monday, World Cafe
  const live = onAirAt(at);
  assert.equal(live.show.id, "worldcafe");
  assert.equal(new Date(live.endsAt).toISOString(), "2026-10-05T20:00:00.000Z", "4pm EDT");
  assert.match(untilLabel(live), /^until /);
  const next = nextAiringOf(SHOWS.funky, at);
  assert.equal(new Date(next.startsAt).toISOString(), "2026-10-09T20:00:00.000Z", "Friday 4pm EDT");
});

test("an airing about to start runs as long as that day's slot", () => {
  // Middays runs 10am-2pm Monday to Thursday but only until noon on Friday.
  const friday = airingSoon("middays", 60, new Date("2026-10-09T09:30:00-04:00"));
  assert.equal(new Date(friday.ends).toISOString(), "2026-10-09T16:00:00.000Z", "noon EDT");
});
