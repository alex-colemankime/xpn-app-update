// Asking for a store rating (review.js): rarely, and only once it has earned it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldAskForReview } from "../review.js";

const DAY = 24 * 3600000;
const now = 1_800_000_000_000;

test("asked only after real use: two hours of listening and a few saves", () => {
  assert.equal(shouldAskForReview({ minutes: 30, saves: 5 }, { now, version: "1.0.0" }), false);
  assert.equal(shouldAskForReview({ minutes: 300, saves: 1 }, { now, version: "1.0.0" }), false);
  assert.equal(shouldAskForReview({ minutes: 130, saves: 3 }, { now, version: "1.0.0" }), true);
});

test("at most once a version, and never within 120 days", () => {
  const used = { minutes: 500, saves: 20 };
  const asked = { ...used, askedAt: now - 10 * DAY, askedVersion: "1.0.0" };
  assert.equal(shouldAskForReview(asked, { now, version: "1.0.0" }), false);
  assert.equal(shouldAskForReview(asked, { now, version: "1.1.0" }), false, "too soon");
  assert.equal(
    shouldAskForReview({ ...asked, askedAt: now - 121 * DAY }, { now, version: "1.1.0" }),
    true,
  );
});
