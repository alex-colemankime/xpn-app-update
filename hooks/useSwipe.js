import { useCallback, useLayoutEffect, useRef } from "react";

// A quick flick of a finger across an element: sideways between tabs or
// days, up on the mini player. Touch only, so a mouse or trackpad works as
// it always has. Listeners are passive and decide when the finger lifts, so
// scrolling is never held up.

const MIN = 56; // far enough
const RATIO = 1.6; // and mostly in one direction
const MAX_MS = 700; // and quick, not a slow drag to read
const EDGE = 24; // the phone's own back gesture lives at the edges

// Which way a finished touch went: "left", "right", "up", "down" or "".
// Pure, so it can be tested.
export function swipeDirection({ dx, dy, ms }, min = MIN) {
  if (ms > MAX_MS) return "";
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= min && ax >= ay * RATIO) return dx < 0 ? "left" : "right";
  if (ay >= min && ay >= ax * RATIO) return dy < 0 ? "up" : "down";
  return "";
}

// Where a swipe means something else: fields, sliders, rows that scroll
// sideways themselves, and anything marked data-no-swipe.
function swipeable(target, root) {
  for (let el = target; el && el !== root.parentElement; el = el.parentElement) {
    if (el.matches?.("input, textarea, select, [data-no-swipe], [popover]")) return false;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll") return false;
    }
  }
  return true;
}

// `onSwipe(direction)` returns true when it used the swipe. A swipe is used
// once: an element inside another that also listens (Shows' schedule days,
// inside Shows' tabs) has it first, and the outer one only when the inner
// had no use for it (no day further on, say).
//
// Returns a ref callback, so the element may come and go (a tab's content
// does) and its listeners with it.
export function useSwipe(onSwipe, { min = MIN } = {}) {
  const latest = useRef(onSwipe);
  useLayoutEffect(() => {
    latest.current = onSwipe;
  });
  return useCallback(
    (el) => {
      if (!el) return;
      let start = null;
      const down = (e) => {
        const t = e.touches[0];
        start =
          e.touches.length === 1 &&
          t.clientX > EDGE &&
          t.clientX < window.innerWidth - EDGE &&
          swipeable(e.target, el)
            ? { x: t.clientX, y: t.clientY, at: e.timeStamp }
            : null;
      };
      const up = (e) => {
        if (!start) return;
        const t = e.changedTouches[0];
        const direction = swipeDirection(
          { dx: t.clientX - start.x, dy: t.clientY - start.y, ms: e.timeStamp - start.at },
          min,
        );
        start = null;
        if (!direction || e.swipeUsed) return;
        if (latest.current(direction)) e.swipeUsed = true;
      };
      const cancel = () => {
        start = null;
      };
      el.addEventListener("touchstart", down, { passive: true });
      el.addEventListener("touchend", up, { passive: true });
      el.addEventListener("touchcancel", cancel, { passive: true });
      return () => {
        el.removeEventListener("touchstart", down);
        el.removeEventListener("touchend", up);
        el.removeEventListener("touchcancel", cancel);
      };
    },
    [min],
  );
}
