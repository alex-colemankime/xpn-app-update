import { useSyncExternalStore } from "react";
import { createStore } from "./storage.js";

// One transient message at a time ("Copied to clipboard."), readable from
// anywhere without threading a callback through every screen.
//   - A plain message clears itself after a few seconds, but never while the
//     pointer or keyboard focus is on it.
//   - Every actionable message, including Undo, stays until it is used or
//     dismissed so keyboard and screen-reader users never race a timer.
const EMPTY = { text: "", title: "", image: "", icon: "", action: null };
const toastStore = createStore(EMPTY);
const HIDE_AFTER_MS = 5000;
let timer = null;
let held = false;

const schedule = () => {
  clearTimeout(timer);
  const { text, title, action } = toastStore.getSnapshot();
  if (!(text || title) || held || action) return;
  timer = setTimeout(() => showToast(""), HIDE_AFTER_MS);
};

// `message` is a line of text, or { title, text, image, icon } for a richer
// notice (a show reminder with the show's artwork, a saved concert).
export function showToast(message, action = null) {
  const m = typeof message === "string" ? { text: message } : message || {};
  toastStore.set(
    m.text || m.title
      ? {
          text: m.text || "",
          title: m.title || "",
          image: m.image || "",
          icon: m.icon || "",
          action,
        }
      : EMPTY,
  );
  schedule();
}

// Called while the listener is pointing at or focused on the toast.
export function holdToast(hold) {
  held = hold;
  schedule();
}

export const useToast = () => useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
