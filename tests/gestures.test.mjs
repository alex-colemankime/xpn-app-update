import { test } from "node:test";
import assert from "node:assert/strict";
import { closeLine, releaseCloses } from "../hooks/useSheetDrag.js";
import { createVelocityTracker, project, rubberband, springStep } from "../motion.js";

test("a throw comes to rest where a scroll view's would", () => {
  assert.equal(project(0), 0);
  // 1000 px/s at 0.998 per ms travels about 499px.
  assert.ok(Math.abs(project(1000) - 499) < 1);
  assert.ok(project(-1000) < 0, "upward throws go up");
});

test("a pull past an edge resists more the further it goes, and never passes the size", () => {
  assert.equal(rubberband(0, 600), 0);
  const a = rubberband(50, 600);
  const b = rubberband(200, 600);
  assert.ok(a > 0 && a < 50, "it follows less than the finger");
  assert.ok(b > a && b - a < 150, "and less again further out");
  assert.ok(rubberband(100000, 600) < 600);
  assert.equal(rubberband(-50, 600), -a, "the same either way");
});

test("the speed at let-go comes from the last moments only", () => {
  const v = createVelocityTracker();
  // A slow pull for half a second, then a quick flick.
  for (let t = 0; t <= 500; t += 16) v.add(t, t * 0.1);
  for (let t = 516; t <= 580; t += 16) v.add(t, 50 + (t - 500) * 2);
  assert.ok(v.velocity() > 1500, "a slow pull that ends in a flick is a flick");
  const w = createVelocityTracker();
  // A fast start that then stops.
  for (let t = 0; t <= 100; t += 16) w.add(t, t * 3);
  for (let t = 116; t <= 400; t += 16) w.add(t, 300);
  assert.equal(w.velocity(), 0, "a fast start that stopped is not");
});

test("a pull that stops before the finger lifts isn't a throw, though no move came between", () => {
  const v = createVelocityTracker();
  // 120px in 100ms, then the finger rests (a resting finger sends no moves)
  // and lifts a second later.
  for (let t = 0; t <= 100; t += 16) v.add(t, t * 1.2);
  assert.ok(v.velocity(100) > 1000, "lifted at once, it is a throw");
  assert.equal(v.velocity(1100), 0, "lifted after a rest, it is not");
  assert.ok(v.velocity(140) < v.velocity(100), "a short rest slows it");
  assert.equal(
    releaseCloses({ y: 120, velocity: v.velocity(1100), height: 523 }),
    false,
    "and the sheet springs back",
  );
});

test("a sheet closes when thrown or let go past the line, and settles back otherwise", () => {
  const height = 600;
  assert.ok(Math.abs(closeLine(height) - 168) < 1e-9);
  assert.equal(closeLine(300), 96, "never less than the minimum");
  assert.equal(releaseCloses({ y: 30, velocity: 0, height }), false, "a nudge");
  assert.equal(releaseCloses({ y: 200, velocity: 0, height }), true, "a slow pull past the line");
  assert.equal(releaseCloses({ y: 60, velocity: 900, height }), true, "a flick");
  assert.equal(
    releaseCloses({ y: 250, velocity: -600, height }),
    false,
    "moving back up when let go",
  );
  assert.equal(releaseCloses({ y: 120, velocity: 120, height }), false, "short and slow");
});

test("the spring settles on its target, without overshoot when critically damped", () => {
  let state = { value: 0, velocity: 0 };
  let max = 0;
  for (let i = 0; i < 240; i++) {
    state = springStep({ ...state, to: 100, damping: 1, response: 0.35 }, 1 / 240);
    max = Math.max(max, state.value);
  }
  for (let i = 0; i < 480; i++) {
    state = springStep({ ...state, to: 100, damping: 1, response: 0.35 }, 1 / 240);
    max = Math.max(max, state.value);
  }
  assert.ok(Math.abs(state.value - 100) < 0.5, "it arrives");
  assert.ok(max <= 100.01, "and never passes it");
});
