import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { holdToast, showToast, useToast } from "../toast.js";
import { createStore } from "../storage.js";
import { swallowNextClick } from "../click-guard.js";

// A modal sheet makes everything outside it inert, so while one is open the
// toast is drawn inside it instead (Modal renders <Toast inModal />); the
// app's own copy steps aside.
const openModals = createStore(0);
export const modalOpened = () => openModals.set((n) => n + 1);
export const modalClosed = () => openModals.set((n) => Math.max(0, n - 1));

// How long a cleared notice takes to fade out (styles/notices.css).
const LEAVE_MS = 180;

// A notice follows a finger (or a mouse) pulled down or to either side, and
// goes when let go far enough; otherwise it settles back. Up does nothing.
// A press that never moves is still a tap on whatever it pressed.
const SLOP = 6;
const AWAY_Y = 32;
const AWAY_X = 72;
function useSwipeAway() {
  const drag = useRef(null);
  const [shift, setShift] = useState(null);
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, dx: 0, dy: 0 };
    holdToast(true);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : dy > 0 ? "y" : "none";
      if (d.axis !== "none") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // a pointer the browser no longer tracks: the drag works without
        }
      }
    }
    if (d.axis === "x") d.dx = dx;
    else if (d.axis === "y") d.dy = Math.max(0, dy);
    else return;
    setShift({ x: d.dx, y: d.dy });
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    holdToast(false);
    if (!d.axis || d.axis === "none") return;
    swallowNextClick(e.currentTarget);
    const away = d.axis === "x" ? Math.abs(d.dx) > AWAY_X : d.dy > AWAY_Y;
    if (away) {
      setShift(d.axis === "x" ? { x: Math.sign(d.dx) * 480, y: 0 } : { x: 0, y: 160 });
      showToast("");
    } else setShift(null);
  };
  // Interrupted (the system took the touch, a call came in): the notice
  // settles back, and nothing waits to swallow a click that never comes.
  const onPointerCancel = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    holdToast(false);
    setShift(null);
  };
  return {
    shift,
    reset: () => setShift(null),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

export function Toast({ inModal = false }) {
  const message = useToast();
  const modals = useSyncExternalStore(openModals.subscribe, openModals.getSnapshot);
  const shown = Boolean(message.text || message.title);
  // The last notice stays drawn a moment after it's cleared, so it fades
  // out rather than vanishing. (A timer, not animationend: with reduced
  // motion there is no animation to end.)
  const [last, setLast] = useState(null);
  const swipe = useSwipeAway();
  if (shown && last !== message) {
    setLast(message);
    if (swipe.shift) swipe.reset();
  }
  const leaving = !shown && last !== null;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLast(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!inModal && modals > 0) return null;
  const m = shown ? message : last;
  const classes = ["toast", m?.brief && "brief", m?.action && "has-action"].filter(Boolean);
  const { shift } = swipe;
  // Following the finger: no easing while held, a quick glide once let go.
  const moved = shift && {
    translate: `${shift.x}px ${shift.y}px`,
    opacity: Math.max(0, 1 - Math.max(Math.abs(shift.x) / 260, shift.y / 120)),
    transition: leaving ? "translate 0.18s ease-in, opacity 0.18s" : "none",
  };
  return (
    <div role="status" aria-live="polite">
      {m && (
        <div
          className={classes.join(" ")}
          data-leaving={leaving || undefined}
          style={moved || undefined}
          {...swipe.handlers}
          onFocus={(e) => e.target.matches(":focus-visible") && holdToast(true)}
          onBlur={() => holdToast(false)}
        >
          {m.image ? (
            <img className="toast-media" src={m.image} alt="" />
          ) : m.icon ? (
            <span className="toast-media toast-icon">
              <Icon name={m.icon} size={18} />
            </span>
          ) : null}
          <span className="toast-text">
            {m.title && <strong>{m.title}</strong>}
            {m.text && <span>{m.text}</span>}
          </span>
          {m.action && (
            <>
              <button
                className="toast-action"
                onClick={() => {
                  m.action.onClick();
                  showToast("");
                }}
              >
                {m.action.label}
              </button>
              {/* A swipe clears a bar; this is the same for a keyboard or a
                  screen reader, unseen otherwise. */}
              {!m.brief && (
                <button className="toast-close sr-only" onClick={() => showToast("")}>
                  Dismiss
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
