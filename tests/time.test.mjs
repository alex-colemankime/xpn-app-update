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

test("short lengths and AP months, for episode rows", async () => {
  const { apMonths, compactLength } = await import("../time.js");
  assert.equal(compactLength(13920), "3h 52m");
  assert.equal(compactLength(3420), "57m");
  assert.equal(compactLength(7200), "2h");
  assert.equal(compactLength(20), "1m");
  assert.equal(compactLength(null), "");
  assert.equal(apMonths("Saturday, October 10"), "Saturday, Oct. 10");
  assert.equal(apMonths("Sunday, September 27"), "Sunday, Sept. 27");
  assert.equal(apMonths("Friday, June 5"), "Friday, June 5");
  assert.equal(apMonths("September Sessions"), "September Sessions", "only a date's month");
  const { mediumDay, shortDay } = await import("../time.js");
  const now = new Date("2026-10-11T12:00:00");
  assert.equal(shortDay("2026-09-30T18:00:00", now), "Sept. 30");
  assert.equal(shortDay("2026-05-04T18:00:00", now), "May 4");
  assert.equal(shortDay("2025-10-01T18:00:00", now), "Oct. 1, 2025");
  assert.equal(shortDay("not a date", now), "");
  assert.equal(mediumDay("2026-03-15T12:00:00"), "March 15, 2026");
  assert.equal(mediumDay("2026-12-01T12:00:00"), "Dec. 1, 2026");
});
