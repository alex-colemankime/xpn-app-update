import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarEnd, pickDay } from "../concerts.js";

const NONE = { from: "", to: "" };

test("a tap picks a day, a later one makes a range, and a picked day lets go", () => {
  let range = pickDay(NONE, "2026-10-14");
  assert.deepEqual(range, { from: "2026-10-14", to: "2026-10-14" }, "one day");
  assert.deepEqual(pickDay(range, "2026-10-14"), NONE, "tapped again: every date");
  assert.deepEqual(pickDay(range, "2026-10-10"), { from: "2026-10-10", to: "2026-10-10" });
  range = pickDay(range, "2026-10-20");
  assert.deepEqual(range, { from: "2026-10-14", to: "2026-10-20" });
  assert.deepEqual(pickDay(range, "2026-10-14"), NONE, "either end lets go");
  assert.deepEqual(pickDay(range, "2026-10-20"), NONE);
  assert.deepEqual(pickDay(range, "2026-10-16"), { from: "2026-10-16", to: "2026-10-16" });
});

test("the calendar reaches as far as the listings the app loads", () => {
  assert.equal(calendarEnd("2026-10-11"), "2027-10-11");
});
