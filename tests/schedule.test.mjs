import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { onAir, nextAiring, toHHMM } from "../schedule.js";

const SHOWS = JSON.parse(fs.readFileSync(new URL("../shows.json", import.meta.url), "utf8"));
const at = (day, time) => ({ day, time });

test("finds the show on air from the real schedule", () => {
  const now = onAir(SHOWS, at("Tuesday", "14:30"));
  assert.equal(now.show.id, "worldcafe");
  assert.equal(toHHMM(now.end), "16:00");
  assert.equal(now.minutesLeft, 90);
  assert.equal(
    onAir(SHOWS, at("Tuesday", "16:00")).show.id,
    "afternoons",
    "a slot starts at its start",
  );
});

test("a show running past midnight still counts the next morning", () => {
  // American Routes: Saturday 23:00–01:00.
  const late = onAir(SHOWS, at("Saturday", "23:30"));
  assert.equal(late.show.id, "americanroutes");
  assert.equal(toHHMM(late.end), "01:00", "ends in the next day's first hour");
  const spill = onAir(SHOWS, at("Sunday", "00:30"));
  assert.equal(spill?.show.id, "americanroutes");
  assert.equal(spill.minutesLeft, 30);
  // A show ending exactly at midnight.
  assert.equal(toHHMM(onAir(SHOWS, at("Monday", "23:00")).end), "00:00");
});

test("gaps report nothing and overlaps go to the latest start", () => {
  const fixture = {
    a: { id: "a", schedule: [{ days: ["Monday"], start: "00:00", end: "05:00" }] },
    b: { id: "b", schedule: [{ days: ["Monday"], start: "02:00", end: "04:00" }] },
  };
  assert.equal(onAir(fixture, at("Monday", "01:00")).show.id, "a");
  assert.equal(onAir(fixture, at("Monday", "03:00")).show.id, "b");
  assert.equal(onAir(fixture, at("Monday", "04:30")).show.id, "a");
  assert.equal(onAir(fixture, at("Monday", "06:00")), null, "no show is invented for a gap");
});

test("the real schedule covers the whole week with no gaps", () => {
  for (const day of [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]) {
    for (let m = 0; m < 1440; m++) {
      const time = toHHMM(m);
      assert.ok(onAir(SHOWS, at(day, time)), `${day} ${time}`);
    }
  }
});

test("next airing reads as today, tomorrow or a weekday", () => {
  const cafe = SHOWS.worldcafe; // weekdays 14:00
  assert.equal(nextAiring(cafe, at("Tuesday", "09:00")).label, "Today at 2pm");
  assert.equal(
    nextAiring(cafe, at("Tuesday", "15:00")).label,
    "Tomorrow at 2pm",
    "already started today",
  );
  assert.equal(nextAiring(cafe, at("Friday", "15:00")).label, "Monday at 2pm");
  assert.equal(nextAiring({ id: "x", schedule: [] }, at("Monday", "09:00")), null);
  const weekly = { schedule: [{ days: ["Wednesday"], start: "20:00", end: "22:00" }] };
  assert.equal(
    nextAiring(weekly, at("Wednesday", "21:00")).label,
    "Wednesday at 8pm",
    "a week out",
  );
});

test("next airing ends when that day's slot ends", () => {
  // Middays starts at 10am every weekday but runs until noon on Fridays.
  const friday = nextAiring(SHOWS.middays, at("Thursday", "15:00"));
  assert.equal(friday.start, "10:00");
  assert.equal(friday.end, "12:00");
  assert.equal(nextAiring(SHOWS.middays, at("Monday", "09:00")).end, "14:00");
});

test("a day drawn to scale: each show as tall as it runs, the night before carried in", async () => {
  const { scheduleRuler } = await import("../schedule.js");
  const s = (start, end, id) => ({ start, end, show: { id } });
  const { rows, offsetAt } = scheduleRuler(
    [s("01:00", "05:00", "b"), s("05:00", "05:30", "c"), s("05:30", "24:00", "d")],
    [s("23:00", "01:00", "a")],
    { perHour: 60, minHeight: 50 },
  );
  assert.deepEqual(
    rows.map((r) => [r.slot?.show.id ?? "gap", r.from, r.to, r.height, Boolean(r.carried)]),
    [
      ["a", 0, 60, 60, true],
      ["b", 60, 300, 240, false],
      ["c", 300, 330, 50, false],
      ["d", 330, 1440, 1110, false],
    ],
  );
  assert.equal(offsetAt(0), 0);
  assert.equal(offsetAt(120), 120, "two hours in, an hour into b");
  assert.equal(offsetAt(315), 60 + 240 + 25, "halfway through the short slot");
  const gappy = scheduleRuler([s("02:00", "04:00", "x")], [], { perHour: 60, minHeight: 50 });
  assert.deepEqual(
    gappy.rows.map((r) => (r.gap ? `gap ${r.from}-${r.to}` : r.slot.show.id)),
    ["gap 0-120", "x", "gap 240-1440"],
  );
});
