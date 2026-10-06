import { test } from "node:test";
import assert from "node:assert/strict";
import { easternParts, reportedMinutes, clockLabel } from "../time.js";

test("Eastern date keys survive UTC midnight and daylight saving transitions", () => {
  assert.equal(easternParts(new Date("2026-09-08T01:00:00Z")).date, "2026-09-07");
  assert.equal(easternParts(new Date("2026-03-08T07:00:00Z")).time, "03:00");
  assert.equal(easternParts(new Date("2026-11-01T06:00:00Z")).time, "01:00");
  assert.equal(easternParts(new Date("2026-09-28T16:00:00Z")).day, "Monday");
});

test("a song reported before midnight is still current just after it", () => {
  const age = (nowD, nowT, songD, songT) =>
    reportedMinutes(nowD, nowT) - reportedMinutes(songD, songT);
  // The original bug: 23:58 yesterday vs 00:01 today read as -1437 minutes.
  assert.equal(age("2026-09-08", "00:01", "2026-09-07", "23:58"), 3);
  assert.equal(age("2026-09-08", "10:05", "2026-09-08", "10:00"), 5);
  assert.equal(reportedMinutes("", "10:00"), null);
  assert.equal(reportedMinutes("2026-09-08", "nope"), null);
});

test("clock labels read naturally", () => {
  assert.equal(clockLabel("00:00"), "midnight");
  assert.equal(clockLabel("07:30"), "7:30am");
  assert.equal(clockLabel("12:00"), "noon");
  assert.equal(clockLabel("16:05"), "4:05pm");
});
