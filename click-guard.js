// A drag isn't also a tap on what it started over: the click that follows
// its release (if the browser sends one) goes nowhere. Only that one: the
// guard is gone after this turn of the event loop, so a release that sends
// no click (a touch that moved, say) can't swallow a later tap.
export function swallowNextClick(el) {
  const swallow = (c) => {
    c.stopPropagation();
    c.preventDefault();
  };
  el.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
}
