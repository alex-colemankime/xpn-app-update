import { useEffect, useEffectEvent, useRef } from "react";
import { rubberband } from "../motion.js";
import { tap } from "../haptics.js";

// Pull down at the top of a screen to load it again (Listen's songs, the
// concerts, the videos, the archive): a small spinner follows the finger
// and turns while the screen loads. Touch only, and the lists already keep
// themselves up to date, so it is a way to hurry them, never the only way.
//
// Listeners are passive and the spinner moves on the compositor (a CSS
// variable on one element), so scrolling is never held up.

const TRAVEL = 88; // px the spinner can come down, at most
const READY = 64; // px it has come down when a release loads
const MIN_SPIN_MS = 600; // long enough to see that it ran

// How far the spinner comes for a pull of `dy` px: it follows the finger
// less and less the further it goes, so it slows before it stops instead of
// hitting a wall (motion.js). Whether that loads on release.
export const pullDistance = (dy) => (dy > 0 ? Math.min(TRAVEL, rubberband(dy, 260)) : 0);
export const pullLoads = (dy) => pullDistance(dy) >= READY;

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// `onRefresh()` may return a promise: the spinner turns until it settles.
// Drawn inside the screen it refreshes; it listens on that screen (App's
// [data-screen]), and only while it is drawn.
export function PullToRefresh({ onRefresh }) {
  const ref = useRef(null);
  const refresh = useEffectEvent(() => onRefresh());
  useEffect(() => {
    const spinner = ref.current;
    const screen = spinner?.closest("[data-screen]") || spinner?.parentElement;
    if (!screen) return;
    let start = null;
    let busy = false;
    let frame = 0;
    // `pull`, while a finger is pulling: the pull, so it ticks only once.
    const show = (px, pull = null) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        spinner.style.setProperty("--pull", `${px}px`);
        spinner.style.setProperty("--turn", `${px * 4}deg`);
        // A tick the first time it arms, the moment letting go would load;
        // easing back and pulling past it again in the same pull doesn't.
        if (px >= READY && !("ready" in spinner.dataset)) {
          spinner.dataset.ready = "";
          if (pull && !pull.ticked) {
            pull.ticked = true;
            tap("selection");
          }
        } else if (px < READY) delete spinner.dataset.ready;
      });
    };
    const down = (e) => {
      start = null;
      if (busy || e.touches.length !== 1 || window.scrollY > 0) return;
      if (e.target.closest("input, textarea, select, [popover], dialog, [data-no-swipe]")) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, on: false };
    };
    const move = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!start.on) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Down, and mostly down, from the very top: a pull. Anything else
        // is scrolling or a sideways swipe, left alone.
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          start = null;
          return;
        }
        start.on = true;
        spinner.dataset.state = "pulling";
      }
      start.dy = dy;
      show(pullDistance(dy), start);
    };
    const cancel = () => {
      if (start?.on) {
        delete spinner.dataset.state;
        show(0);
      }
      start = null;
    };
    const up = async () => {
      const was = start;
      start = null;
      if (!was?.on) return;
      if (!pullLoads(was.dy)) {
        delete spinner.dataset.state;
        show(0);
        return;
      }
      busy = true;
      spinner.dataset.state = "loading";
      show(READY - 8);
      const began = Date.now();
      try {
        await refresh();
      } catch {
        // the screen says what failed; the spinner just stops
      }
      const left = MIN_SPIN_MS - (Date.now() - began);
      if (left > 0 && !reduced()) await new Promise((r) => setTimeout(r, left));
      delete spinner.dataset.state;
      show(0);
      busy = false;
    };
    screen.addEventListener("touchstart", down, { passive: true });
    screen.addEventListener("touchmove", move, { passive: true });
    screen.addEventListener("touchend", up, { passive: true });
    screen.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      screen.removeEventListener("touchstart", down);
      screen.removeEventListener("touchmove", move);
      screen.removeEventListener("touchend", up);
      screen.removeEventListener("touchcancel", cancel);
    };
  }, []);
  return (
    <div ref={ref} className="pull-refresh" aria-hidden="true">
      <span />
    </div>
  );
}
