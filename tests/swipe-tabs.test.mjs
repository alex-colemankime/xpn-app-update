import { test } from "node:test";
import assert from "node:assert/strict";
import { swipeStep } from "../hooks/useSwipeTabs.js";

test("a quick sideways flick moves a tab; scrolling and slow drags don't", () => {
  assert.equal(swipeStep({ dx: -120, dy: 10, ms: 200 }), 1, "to the left: the next tab");
  assert.equal(swipeStep({ dx: 120, dy: -8, ms: 200 }), -1, "to the right: the one before");
  assert.equal(swipeStep({ dx: -40, dy: 0, ms: 150 }), 0, "too short");
  assert.equal(swipeStep({ dx: -100, dy: 90, ms: 200 }), 0, "a diagonal scroll");
  assert.equal(swipeStep({ dx: 10, dy: 400, ms: 300 }), 0, "a scroll down");
  assert.equal(swipeStep({ dx: -150, dy: 0, ms: 1200 }), 0, "a slow drag");
});
