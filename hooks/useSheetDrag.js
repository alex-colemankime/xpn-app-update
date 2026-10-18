import { useCallback } from "react";
import { swallowNextClick } from "../click-guard.js";
import { createVelocityTracker, project, rubberband, springTo } from "../motion.js";
import { tap } from "../haptics.js";

// A sheet that rises from the bottom of a phone (a show, a video, a song's
// menu) follows a finger pulled down from its top, one to one, and when let
// go it carries on at the finger's speed: thrown or pulled past halfway it
// leaves, otherwise it springs back. A moving sheet can be caught again
// mid-flight. Pulled up past its top it resists. Its backdrop lightens as
// it is pulled away, and a tick marks the point where letting go would
// close it. Its close button, a tap outside, Escape and Back all still
// close it.
//
// The drag starts only when the sheet is scrolled to its top and the
// finger's first move is down, so scrolling the sheet works as before. The
// listener that holds the page still while dragging is on the sheet alone,
// never on the page, so nothing else waits on it.

const PHONE = "(max-width: 767px)";
const SLOP = 4; // px before the first move counts
const LINE = 0.28; // of the sheet's height: past it, a slow let-go closes
const LINE_MIN = 96; // px
const UPWARD = -300; // px/s: moving up this fast at let-go never closes

// Where a pull this far down must reach for a slow let-go to close it.
export const closeLine = (height) => Math.max(LINE_MIN, height * LINE);

// Whether letting go at `y` px down, moving at `velocity` px/s (down is
// positive), closes a sheet `height` px tall: if the throw would come to
// rest past halfway, or if it is already past the line and not moving back
// up. Pure, so it can be tested.
export function releaseCloses({ y, velocity, height }) {
  if (velocity < UPWARD) return false;
  if (y + project(velocity) > height * 0.5) return true;
  return y > closeLine(height) && velocity >= 0;
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

// A ref callback for the sheet. `anyWidth` lets a sheet that is a sheet on
// every screen (the press-and-hold menu) be pulled down there too.
export function useSheetDrag({ anyWidth = false } = {}) {
  return useCallback(
    (sheet) => {
      if (!sheet) return;
      let drag = null;
      let offset = 0; // where the sheet is now, px below its resting place
      let stopSpring = () => {};
      const tracker = createVelocityTracker();
      const height = () => sheet.getBoundingClientRect().height || 1;
      const place = (y) => {
        offset = y;
        sheet.style.transition = "none";
        sheet.style.translate = `0 ${y}px`;
        sheet.style.setProperty("--sheet-pull", String(Math.max(0, Math.min(1, y / height()))));
      };
      const reset = () => {
        offset = 0;
        sheet.style.transition = "";
        sheet.style.translate = "";
        sheet.style.removeProperty("--sheet-pull");
      };
      const stillOpen = () => sheet.isConnected && (sheet.open || sheet.matches?.(":popover-open"));
      // Back to rest, carrying the finger's speed; a little give only if it
      // was thrown.
      const settle = (velocity = 0) => {
        stopSpring = springTo({
          from: offset,
          to: 0,
          velocity,
          damping: Math.abs(velocity) > 500 ? 0.8 : 1,
          onFrame: place,
          onDone: reset,
        });
      };
      // Off the bottom at the finger's speed, then closed. A sheet that is
      // still open a moment later couldn't be dismissed, and comes back; one
      // that closed is put back in place, out of sight, for next time.
      const leave = (velocity = 0) => {
        stopSpring = springTo({
          from: offset,
          to: height(),
          velocity: Math.max(velocity, 0),
          response: 0.3,
          onFrame: place,
          onDone: () => {
            dismiss(sheet);
            requestAnimationFrame(() => (stillOpen() ? settle() : reset()));
          },
        });
      };
      const start = (e) => {
        drag = null;
        if (e.touches.length !== 1) return;
        if (!anyWidth && !window.matchMedia?.(PHONE).matches) return;
        const t = e.touches[0];
        if (!startsDrag(e.target, sheet, t.clientY)) return;
        // Catch a moving sheet where it is, never where it was going.
        stopSpring();
        drag = { x: t.clientX, y: t.clientY, from: offset, on: offset !== 0, past: false };
        tracker.reset();
        tracker.add(e.timeStamp, offset);
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
        const raw = drag.from + dy;
        tracker.add(e.timeStamp, raw);
        // Above its resting place it resists, more the further it goes.
        place(raw >= 0 ? raw : rubberband(raw, height()));
        const past = raw > closeLine(height());
        if (past !== drag.past) {
          drag.past = past;
          tap("selection");
        }
      };
      // Interrupted (the system took the touch): back in place, never closed,
      // however far it had come.
      const cancel = () => {
        const was = drag;
        drag = null;
        if (was?.on) settle();
      };
      const end = () => {
        const was = drag;
        drag = null;
        if (!was?.on) return;
        const velocity = tracker.velocity();
        if (releaseCloses({ y: offset, velocity, height: height() })) leave(velocity);
        else settle(velocity);
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
        move({
          touches: [e],
          cancelable: true,
          timeStamp: e.timeStamp,
          preventDefault: () => e.preventDefault(),
        });
        if (!was && drag?.on) {
          try {
            sheet.setPointerCapture(e.pointerId);
          } catch {
            // a pointer the browser no longer tracks: the drag works without
          }
        }
      };
      const mouseUp = (e) => {
        if (drag?.pointer !== e.pointerId) return;
        const dragged = drag.on;
        end();
        // A drag isn't also a click on whatever it started over.
        if (dragged) swallowNextClick(sheet);
      };
      const mouseCancel = (e) => {
        if (drag?.pointer === e.pointerId) cancel();
      };
      sheet.addEventListener("pointerdown", mouseDown);
      sheet.addEventListener("pointermove", mouseMove);
      sheet.addEventListener("pointerup", mouseUp);
      sheet.addEventListener("pointercancel", mouseCancel);
      sheet.addEventListener("touchstart", start, { passive: true });
      sheet.addEventListener("touchmove", move, { passive: false });
      sheet.addEventListener("touchend", end, { passive: true });
      sheet.addEventListener("touchcancel", cancel, { passive: true });
      return () => {
        stopSpring();
        sheet.removeEventListener("pointerdown", mouseDown);
        sheet.removeEventListener("pointermove", mouseMove);
        sheet.removeEventListener("pointerup", mouseUp);
        sheet.removeEventListener("pointercancel", mouseCancel);
        sheet.removeEventListener("touchstart", start);
        sheet.removeEventListener("touchmove", move);
        sheet.removeEventListener("touchend", end);
        sheet.removeEventListener("touchcancel", cancel);
      };
    },
    [anyWidth],
  );
}
