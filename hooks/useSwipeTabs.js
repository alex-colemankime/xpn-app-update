import { swipeDirection, useSwipe } from "./useSwipe.js";

// A swipe sideways across a screen's content moves to the next or previous
// of its tabs (Favorites' Songs, Shows, Videos, Concerts; Shows' All shows,
// Schedule, Archive), as tabs do in a phone's own apps. Only a clear
// sideways flick: scrolling up and down is never taken for one.

// Which way a finished touch moves: 1 (next tab), -1 (previous) or 0.
// Pure, so it can be tested.
export function swipeStep(touch) {
  const direction = swipeDirection(touch);
  return direction === "left" ? 1 : direction === "right" ? -1 : 0;
}

// Steps through `values` by a sideways swipe: true when there was a next
// (or previous) one to step to.
export function stepper(values, value, onChange) {
  return (direction) => {
    const step = direction === "left" ? 1 : direction === "right" ? -1 : 0;
    const next = step ? values[values.indexOf(value) + step] : undefined;
    if (next === undefined) return false;
    onChange(next, step);
    return true;
  };
}

// `values` in tab order; `onChange(next, direction)` when a swipe moves.
export function useSwipeTabs(values, value, onChange) {
  return useSwipe(stepper(values, value, onChange));
}
