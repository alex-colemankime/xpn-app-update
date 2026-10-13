import { useCallback } from "react";

// A sheet that rises from the bottom of a phone (a show, a video, a song's
// menu) follows a finger pulled down from its top, and goes when let go far
// enough or fast enough; otherwise it settles back. Its close button, a tap
// outside, Escape and Back all still close it.
//
// The drag starts only when the sheet is scrolled to its top and the
// finger's first move is down, so scrolling the sheet works as before. The
// listener that holds the page still while dragging is on the sheet alone,
// never on the page, so nothing else waits on it.

const PHONE = "(max-width: 767px)";
const SLOP = 4; // px before the first move counts
const FAR = 0.28; // of the sheet's height
const FAR_MIN = 96; // px
const FAST = 0.6; // px per ms, a flick
const OUT_MS = 200;

// Whether a finished drag closes the sheet. Pure, so it can be tested.
export function dragCloses({ dy, ms, height }) {
  if (dy <= 24) return false;
  return dy >= Math.max(FAR_MIN, height * FAR) || dy / Math.max(ms, 1) >= FAST;
}

// Something between the touch and the sheet that is scrolled down, or a
// control the finger is using (a slider), keeps the touch for itself. The
// sheet's header (and its grabber above it) always pulls the sheet, however
// far down it is scrolled.
const HANDLE = ".dialog-header, .watch-bar, .popover-menu-head";
const GRAB_PX = 28; // the top of the sheet, where the grabber sits
function startsDrag(target, sheet, y) {
  if (target.closest?.(HANDLE) || y - sheet.getBoundingClientRect().top < GRAB_PX) return true;
  for (let el = target; el && el !== sheet.parentElement; el = el.parentElement) {
    if (el.matches?.("input, textarea, select, iframe, [data-no-swipe]")) return false;
    if (el.scrollTop > 0) return false;
  }
  return true;
}

// Closes the sheet as its own Escape would: a dialog decides for itself (one
// that can't be dismissed stays), a popover simply hides.
function dismiss(sheet) {
  if (sheet.matches("[popover]")) {
    try {
      sheet.hidePopover();
    } catch {
      // already hidden
    }
  } else sheet.dispatchEvent(new Event("cancel", { cancelable: true }));
}

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A ref callback for the sheet. `anyWidth` lets a sheet that is a sheet on
// every screen (the press-and-hold menu) be pulled down there too.
export function useSheetDrag({ anyWidth = false } = {}) {
  return useCallback(
    (sheet) => {
      if (!sheet) return;
      let drag = null;
      const place = (to, animate) => {
        sheet.style.transition = animate && !reduced() ? `translate ${OUT_MS}ms ease-out` : "none";
        sheet.style.translate = to;
      };
      const reset = () => {
        sheet.style.transition = "";
        sheet.style.translate = "";
      };
      const stillOpen = () => sheet.isConnected && (sheet.open || sheet.matches?.(":popover-open"));
      const settleBack = () => {
        place("0 0", true);
        setTimeout(reset, OUT_MS);
      };
      // Off the bottom, then closed. A sheet that is still open a moment
      // later couldn't be dismissed, and comes back; one that closed is put
      // back in place, out of sight, for next time.
      const slideAway = () => {
        place("0 100%", true);
        setTimeout(() => {
          dismiss(sheet);
          setTimeout(() => (stillOpen() ? settleBack() : reset()), 350);
        }, OUT_MS);
      };
      const start = (e) => {
        drag = null;
        if (e.touches.length !== 1) return;
        if (!anyWidth && !window.matchMedia?.(PHONE).matches) return;
        const t = e.touches[0];
        if (!startsDrag(e.target, sheet, t.clientY)) return;
        drag = { x: t.clientX, y: t.clientY, at: e.timeStamp, on: false, dy: 0 };
      };
      const move = (e) => {
        if (!drag) return;
        const t = e.touches[0];
        const dx = t.clientX - drag.x;
        const dy = t.clientY - drag.y;
        if (!drag.on) {
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          // The first move decides: down and mostly down drags the sheet;
          // anything else is the sheet's own scrolling, left alone.
          if (dy <= 0 || Math.abs(dx) > dy || !e.cancelable) {
            drag = null;
            return;
          }
          drag.on = true;
        }
        e.preventDefault();
        drag.dy = Math.max(0, dy);
        place(`0 ${drag.dy}px`, false);
      };
      const end = (e) => {
        const was = drag;
        drag = null;
        if (!was?.on) return;
        const closes = dragCloses({
          dy: was.dy,
          ms: e.timeStamp - was.at,
          height: sheet.getBoundingClientRect().height,
        });
        if (closes) slideAway();
        else settleBack();
      };
      // With a mouse (the shared design preview on a computer), a press and
      // drag down pulls the sheet the same way.
      const mouseDown = (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        start({ touches: [e], target: e.target, timeStamp: e.timeStamp });
        if (drag) drag.pointer = e.pointerId;
      };
      const mouseMove = (e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        const was = drag.on;
        move({ touches: [e], cancelable: true, preventDefault: () => e.preventDefault() });
        if (!was && drag?.on) sheet.setPointerCapture?.(e.pointerId);
      };
      const mouseUp = (e) => {
        if (drag?.pointer !== e.pointerId) return;
        const dragged = drag.on;
        end(e);
        // A drag isn't also a click on whatever it started over.
        if (dragged) {
          const swallow = (c) => {
            c.stopPropagation();
            c.preventDefault();
          };
          sheet.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => sheet.removeEventListener("click", swallow, { capture: true }), 0);
        }
      };
      sheet.addEventListener("pointerdown", mouseDown);
      sheet.addEventListener("pointermove", mouseMove);
      sheet.addEventListener("pointerup", mouseUp);
      sheet.addEventListener("pointercancel", mouseUp);
      sheet.addEventListener("touchstart", start, { passive: true });
      sheet.addEventListener("touchmove", move, { passive: false });
      sheet.addEventListener("touchend", end, { passive: true });
      sheet.addEventListener("touchcancel", end, { passive: true });
      return () => {
        sheet.removeEventListener("pointerdown", mouseDown);
        sheet.removeEventListener("pointermove", mouseMove);
        sheet.removeEventListener("pointerup", mouseUp);
        sheet.removeEventListener("pointercancel", mouseUp);
        sheet.removeEventListener("touchstart", start);
        sheet.removeEventListener("touchmove", move);
        sheet.removeEventListener("touchend", end);
        sheet.removeEventListener("touchcancel", end);
      };
    },
    [anyWidth],
  );
}
