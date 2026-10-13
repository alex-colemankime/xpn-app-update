import { useRef } from "react";

// Two taps in quick succession, close together: a double tap, as photo apps
// use to like something. Pointer events, so it works the same for a finger
// and a mouse; a tap that turns into a scroll is cancelled by the browser
// and never counts. Taps on the buttons and links inside (`ignore`) are
// theirs alone and never count toward one.
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 40;

export function useDoubleTap(onDoubleTap, { ignore = "button, a, input" } = {}) {
  const last = useRef(null);
  return (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (ignore && e.target.closest?.(ignore)) {
      last.current = null;
      return;
    }
    const prev = last.current;
    const near =
      prev &&
      e.timeStamp - prev.at < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_SLOP;
    if (!near) {
      last.current = { at: e.timeStamp, x: e.clientX, y: e.clientY };
      return;
    }
    last.current = null;
    onDoubleTap(e);
  };
}

// A mouse's double click would also select the word under it; the double
// tap is all it should do. Dragging to select text still works.
export const noDoubleClickSelect = (e) => {
  if (e.detail > 1) e.preventDefault();
};
