import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { isoDate } from "../concerts.js";
import { minutesSinceAlarm, CATCHUP_MINUTES } from "../alarm.js";

// catalog.js and nowplaying.js pull in JSON and React, so their pure helpers
// are lifted out of the source the same way the existing player tests do.
function load(file, from, to, exports) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const start = source.indexOf(from);
  const end = source.indexOf(to);
  assert.ok(start !== -1 && end > start, `could not locate ${from} in ${file}`);
  const context = vm.createContext({ Intl, Date, Set });
  vm.runInContext(
    source.slice(start, end).replaceAll("export ", "") +
      `\nthis.api = {${exports.join(",")}};`,
    context,
  );
  return context.api;
}

test("a song reported before midnight is still current just after it", () => {
  const { reportedMinutes } = load(
    "catalog.js",
    "export function easternParts",
    "export function clockLabel",
    ["reportedMinutes"],
  );
  const age = (nowD, nowT, songD, songT) =>
    reportedMinutes(nowD, nowT) - reportedMinutes(songD, songT);

  // The bug: 23:58 yesterday vs 00:01 today used to read as -1437 minutes.
  assert.equal(age("2026-09-08", "00:01", "2026-09-07", "23:58"), 3);
  assert.equal(age("2026-09-08", "10:05", "2026-09-08", "10:00"), 5);
  assert.equal(age("2026-09-08", "10:00", "2026-09-08", "09:00"), 60);
  assert.equal(reportedMinutes("", "10:00"), null);
  assert.equal(reportedMinutes("2026-09-08", "nope"), null);
});

test("playlist days merge, deduplicate, and stay newest first", () => {
  const { previousDate, mergeTracks } = load(
    "nowplaying.js",
    "const EARLY_HOUR",
    "export function normalizePlaylist",
    ["previousDate", "mergeTracks"],
  );

  assert.equal(previousDate("2026-09-08"), "2026-09-07");
  assert.equal(previousDate("2026-01-01"), "2025-12-31");
  assert.equal(previousDate("2026-03-09"), "2026-03-08"); // across the DST change

  const yesterday = [
    { date: "2026-09-07", time: "23:58", title: "Late", artist: "A" },
    { date: "2026-09-07", time: "23:40", title: "Earlier", artist: "B" },
  ];
  const today = [
    { date: "2026-09-08", time: "00:04", title: "First", artist: "C" },
    { date: "2026-09-07", time: "23:58", title: "Late", artist: "A" },
  ];
  const merged = mergeTracks([today, yesterday]);
  assert.deepEqual(
    merged.map((t) => t.title),
    ["First", "Late", "Earlier"],
  );
});

test("concert dates keep the Eastern calendar day for evening events", () => {
  // The bug: an 8pm ET show used to land on the following day via toISOString.
  assert.equal(isoDate("2026-06-12 20:00:00"), "2026-06-12");
  assert.equal(isoDate("2026-06-12T20:00:00-04:00"), "2026-06-12");
  assert.equal(isoDate("2026-06-13T02:00:00Z"), "2026-06-12"); // 10pm ET
  assert.equal(isoDate("2026-06-12"), "2026-06-12");
  assert.equal(isoDate("not a date"), "");
  assert.equal(isoDate(undefined), "");
});

test("the alarm window catches a minute a throttled tab would skip", () => {
  const at = (h, m, s = 0) => new Date(2026, 8, 8, h, m, s);
  assert.equal(minutesSinceAlarm("07:00", at(6, 59, 59)), -1);
  assert.equal(minutesSinceAlarm("07:00", at(7, 0, 30)), 0);
  assert.equal(minutesSinceAlarm("07:00", at(7, 1, 5)), 1);
  assert.ok(minutesSinceAlarm("07:00", at(7, 1, 5)) < CATCHUP_MINUTES);
  assert.ok(minutesSinceAlarm("07:00", at(7, 2, 0)) >= CATCHUP_MINUTES);
  assert.equal(minutesSinceAlarm("bad", at(7, 0)), null);
});
