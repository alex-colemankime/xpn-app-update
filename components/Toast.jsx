import { useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { holdToast, showToast, useToast } from "../toast.js";
import { createStore } from "../storage.js";

// A modal sheet makes everything outside it inert, so while one is open the
// toast is drawn inside it instead (Modal renders <Toast inModal />); the
// app's own copy steps aside.
const openModals = createStore(0);
export const modalOpened = () => openModals.set((n) => n + 1);
export const modalClosed = () => openModals.set((n) => Math.max(0, n - 1));

export function Toast({ inModal = false }) {
  const message = useToast();
  const modals = useSyncExternalStore(openModals.subscribe, openModals.getSnapshot);
  if (!inModal && modals > 0) return null;
  const shown = message.text || message.title;
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {shown && (
        <div
          className={`toast ${message.action ? "has-action" : ""}`}
          onPointerEnter={() => holdToast(true)}
          onPointerLeave={() => holdToast(false)}
          onFocus={() => holdToast(true)}
          onBlur={() => holdToast(false)}
        >
          {message.image ? (
            <img className="toast-media" src={message.image} alt="" />
          ) : message.icon ? (
            <span className="toast-media toast-icon">
              <Icon name={message.icon} size={18} />
            </span>
          ) : null}
          <span className="toast-text">
            {message.title && <strong>{message.title}</strong>}
            {message.text && <span>{message.text}</span>}
          </span>
          {message.action && (
            <>
              <button
                className="toast-action"
                onClick={() => {
                  message.action.onClick();
                  showToast("");
                }}
              >
                {message.action.label}
              </button>
              <button
                className="toast-close icon-button"
                aria-label="Dismiss"
                onClick={() => showToast("")}
              >
                <Icon name="close" size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
