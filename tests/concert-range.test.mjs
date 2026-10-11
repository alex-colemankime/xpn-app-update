import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDay } from "../concerts.js";

test("a range is two taps: the first day, then the last", () => {
  let range = { from: "", to: "" };
  range = pickDay(range, "2026-10-14");
  assert.deepEqual(range, { from: "2026-10-14", to: "" });
  range = pickDay(range, "2026-10-20");
  assert.deepEqual(range, { from: "2026-10-14", to: "2026-10-20" });
  // A third tap starts again; a day before the start does too.
  assert.deepEqual(pickDay(range, "2026-10-16"), { from: "2026-10-16", to: "" });
  assert.deepEqual(pickDay({ from: "2026-10-14", to: "" }, "2026-10-10"), {
    from: "2026-10-10",
    to: "",
  });
  // One day: the same day twice.
  assert.deepEqual(pickDay({ from: "2026-10-14", to: "" }, "2026-10-14"), {
    from: "2026-10-14",
    to: "2026-10-14",
  });
});
