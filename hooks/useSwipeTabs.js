import { useEffect, useEffectEvent, useRef } from "react";

// A swipe sideways across a screen's content moves to the next or previous
// of its tabs (Favorites' Songs, Shows, Videos, Concerts; Shows' All shows,
// Schedule, Archive), as tabs do in a phone's own apps. Touch only, and only
// a clear sideways flick: scrolling up and down is never taken for one.
// Listeners are passive and decide when the finger lifts, so scrolling is
// never held up.

const MIN_DX = 56; // far enough sideways
const RATIO = 1.6; // and mostly sideways
const MAX_MS = 700; // and quick, not a slow drag to read
const EDGE = 24; // the phone's own back gesture lives at the edges

// Which way a finished touch moves: 1 (next tab), -1 (previous) or 0.
// Pure, so it can be tested.
export function swipeStep({ dx, dy, ms }) {
  if (ms > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

// Where a sideways swipe means something else: fields, sliders, rows that
// scroll sideways themselves, and anything marked data-no-swipe.
function swipeable(target) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.matches?.("input, textarea, select, [data-no-swipe], [popover]")) return false;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll") return false;
    }
  }
  return true;
}

// `values` in tab order; `onChange(next, direction)` when a swipe moves.
export function useSwipeTabs(values, value, onChange) {
  const ref = useRef(null);
  const move = useEffectEvent((step) => {
    const next = values[values.indexOf(value) + step];
    if (next !== undefined) onChange(next, step);
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start = null;
    const down = (e) => {
      const t = e.touches[0];
      start =
        e.touches.length === 1 &&
        t.clientX > EDGE &&
        t.clientX < window.innerWidth - EDGE &&
        swipeable(e.target)
          ? { x: t.clientX, y: t.clientY, at: e.timeStamp }
          : null;
    };
    const up = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const step = swipeStep({
        dx: t.clientX - start.x,
        dy: t.clientY - start.y,
        ms: e.timeStamp - start.at,
      });
      start = null;
      if (step) move(step);
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
  }, []);
  return ref;
}
