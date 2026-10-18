// The physics every gesture shares: where a throw would come to rest, how
// a drag past an edge resists, how fast the finger was moving when it let
// go, and a spring that carries that speed on, can be caught mid-flight, and
// never overshoots unless it was thrown. The values follow Apple's
// "Designing Fluid Interfaces" (WWDC 2018).

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// How far a throw at `velocity` (px/s) travels before it comes to rest, as a
// scroll view decelerates (0.998 per millisecond). Pure, so it can be tested.
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// How far something follows a finger pulled `overshoot` px past its edge:
// less and less the further it goes, so it slows before it stops rather
// than hitting a wall. `dimension` is the size of the thing being pulled.
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!dimension) return 0;
  return (
    (Math.sign(overshoot) * Math.abs(overshoot) * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

// The finger's speed (px/s) when it lets go, from its last 80ms only: a slow
// pull that ends in a flick is a flick, and a fast start that stopped is
// not. A finger held still sends no moves, so `velocity(now)` takes the
// moment it let go: the finger is where it last moved to, and any time it
// rested there counts.
export function createVelocityTracker(windowMs = 80) {
  let samples = [];
  return {
    add(time, position) {
      samples.push({ time, position });
      while (samples.length > 2 && time - samples[0].time > windowMs) samples.shift();
    },
    velocity(now) {
      if (!samples.length) return 0;
      const last = samples[samples.length - 1];
      const end = now > last.time ? { time: now, position: last.position } : last;
      const recent = samples.filter((s) => end.time - s.time <= windowMs && s !== end);
      if (!recent.length) return 0;
      const first = recent[0];
      const ms = end.time - first.time;
      return ms > 0 ? ((end.position - first.position) / ms) * 1000 : 0;
    },
    reset() {
      samples = [];
    },
  };
}

// One step of a damped spring toward `to`. `damping` 1 settles without
// overshoot; below 1 it overshoots a little (only after a throw). `response`
// is roughly how long it takes to get there, in seconds. Pure.
export function springStep({ value, velocity, to, damping, response }, dt) {
  const stiffness = ((2 * Math.PI) / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  const force = -stiffness * (value - to) - friction * velocity;
  const nextVelocity = velocity + force * dt;
  return { value: value + nextVelocity * dt, velocity: nextVelocity };
}

// Animates a value from `from` to `to` on a spring, starting at `velocity`
// (px/s, the finger's when it let go), calling `onFrame(value)` each frame
// and `onDone()` when it settles. Returns `stop()`, which leaves the value
// where it is, so a finger can catch it mid-flight. Under reduced motion it
// goes straight to `to`.
export function springTo({
  from,
  to,
  velocity = 0,
  damping = 1,
  response = 0.35,
  onFrame,
  onDone,
}) {
  if (reduced() || typeof requestAnimationFrame === "undefined") {
    onFrame(to);
    onDone?.();
    return () => {};
  }
  let state = { value: from, velocity };
  let last = performance.now();
  let frame = requestAnimationFrame(function step(now) {
    // Small fixed steps keep the spring stable on a slow frame.
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      state = springStep({ ...state, to, damping, response }, h);
      dt -= h;
    }
    if (Math.abs(state.value - to) < 0.5 && Math.abs(state.velocity) < 10) {
      onFrame(to);
      frame = 0;
      onDone?.();
      return;
    }
    onFrame(state.value);
    frame = requestAnimationFrame(step);
  });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
