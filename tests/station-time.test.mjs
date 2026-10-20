// Times from the station's schedule (time.js, stationClock and stationWhen):
// in Eastern time wherever the phone is, marked ET when it's elsewhere, so
// the on-air band and the schedule never disagree. The zone is set before
// time.js loads.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TZ = "America/Los_Angeles";
const { stationClock, stationWhen, localClock } = await import("../time.js");

test("a show ending at 4pm Eastern reads 4pm ET on a Pacific phone, not 1pm", () => {
  const fourPmEastern = Date.UTC(2026, 9, 20, 20, 0); // 4pm EDT
  assert.equal(stationClock(fourPmEastern, fourPmEastern - 3600000), "4pm ET");
  assert.equal(localClock(fourPmEastern), "1pm", "the phone's own clock, for comparison");
  assert.equal(stationWhen(fourPmEastern, fourPmEastern - 3600000), "Today at 4pm ET");
});
