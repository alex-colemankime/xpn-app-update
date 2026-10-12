import { test } from "node:test";
import assert from "node:assert/strict";
import { swipeDirection } from "../hooks/useSwipe.js";
import { stepper } from "../hooks/useSwipeTabs.js";
import { dragCloses } from "../hooks/useSheetDrag.js";

test("a flick reads as the way it went, and only a clear one counts", () => {
  assert.equal(swipeDirection({ dx: -120, dy: 10, ms: 200 }), "left");
  assert.equal(swipeDirection({ dx: 120, dy: 0, ms: 200 }), "right");
  assert.equal(
    swipeDirection({ dx: 4, dy: -40, ms: 150 }, 32),
    "up",
    "the mini player's short flick",
  );
  assert.equal(swipeDirection({ dx: 4, dy: -40, ms: 150 }), "", "too short by default");
  assert.equal(swipeDirection({ dx: 0, dy: 90, ms: 200 }), "down");
  assert.equal(swipeDirection({ dx: -100, dy: 90, ms: 200 }), "", "a diagonal");
  assert.equal(swipeDirection({ dx: -150, dy: 0, ms: 1200 }), "", "a slow drag");
});

test("a swipe steps through days or tabs, and says when there is nowhere to go", () => {
  const days = ["Mon", "Tue", "Wed"];
  const moves = [];
  const onChange = (next, step) => moves.push([next, step]);
  assert.equal(stepper(days, "Tue", onChange)("left"), true);
  assert.equal(stepper(days, "Tue", onChange)("right"), true);
  assert.equal(stepper(days, "Wed", onChange)("left"), false, "past the end: the tabs may use it");
  assert.equal(stepper(days, "Mon", onChange)("right"), false);
  assert.equal(stepper(days, "Mon", onChange)("up"), false, "not sideways");
  assert.deepEqual(moves, [
    ["Wed", 1],
    ["Mon", -1],
  ]);
});

test("a sheet closes when pulled far enough or flicked, and settles back otherwise", () => {
  assert.equal(dragCloses({ dy: 200, ms: 600, height: 600 }), true, "a long pull");
  assert.equal(dragCloses({ dy: 120, ms: 600, height: 600 }), false, "short of a quarter");
  assert.equal(
    dragCloses({ dy: 100, ms: 300, height: 300 }),
    true,
    "past the minimum on a short sheet",
  );
  assert.equal(dragCloses({ dy: 60, ms: 80, height: 600 }), true, "a quick flick");
  assert.equal(dragCloses({ dy: 20, ms: 10, height: 600 }), false, "a nudge");
});
