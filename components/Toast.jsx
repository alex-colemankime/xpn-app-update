import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { holdToast, showToast, useToast } from "../toast.js";
import { createStore } from "../storage.js";

// A modal sheet makes everything outside it inert, so while one is open the
// toast is drawn inside it instead (Modal renders <Toast inModal />); the
// app's own copy steps aside.
const openModals = createStore(0);
export const modalOpened = () => openModals.set((n) => n + 1);
export const modalClosed = () => openModals.set((n) => Math.max(0, n - 1));

// How long a cleared notice takes to fade out (styles/notices.css).
const LEAVE_MS = 180;

export function Toast({ inModal = false }) {
  const message = useToast();
  const modals = useSyncExternalStore(openModals.subscribe, openModals.getSnapshot);
  const shown = Boolean(message.text || message.title);
  // The last notice stays drawn a moment after it's cleared, so it fades
  // out rather than vanishing. (A timer, not animationend: with reduced
  // motion there is no animation to end.)
  const [last, setLast] = useState(null);
  if (shown && last !== message) setLast(message);
  const leaving = !shown && last !== null;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLast(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!inModal && modals > 0) return null;
  const m = shown ? message : last;
  const classes = [
    "toast",
    m?.brief && "brief",
    m?.action && "has-action",
    m?.action && m.title && m.text && "stacked",
  ].filter(Boolean);
  return (
    <div role="status" aria-live="polite">
      {m && (
        <div
          className={classes.join(" ")}
          data-leaving={leaving || undefined}
          onPointerEnter={() => holdToast(true)}
          onPointerLeave={() => holdToast(false)}
          onFocus={() => holdToast(true)}
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
              {/* A pill goes on its own in a moment; a bar can be closed. */}
              {!m.brief && (
                <button
                  className="toast-close icon-button"
                  aria-label="Dismiss"
                  onClick={() => showToast("")}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
