import { useSyncExternalStore } from "react";
import { createStore } from "./storage.js";

// One transient message at a time ("Copied to clipboard."), readable from
// anywhere without threading a callback through every screen. Every message
// clears itself: a plain one after a few seconds, one with an action (Undo)
// a little later so there's time to use it. Never while the pointer or
// keyboard focus is on it, so no one races the timer mid-action.
const EMPTY = { text: "", title: "", image: "", icon: "", action: null };
const toastStore = createStore(EMPTY);
const HIDE_AFTER_MS = 5000;
const HIDE_ACTION_AFTER_MS = 8000;
let timer = null;
let held = false;

const schedule = () => {
  clearTimeout(timer);
  const { text, title, action } = toastStore.getSnapshot();
  if (!(text || title) || held) return;
  timer = setTimeout(() => showToast(""), action ? HIDE_ACTION_AFTER_MS : HIDE_AFTER_MS);
};

// `message` is a line of text, or { title, text, image, icon } for a richer
// notice (a show reminder with the show's artwork, a saved concert).
export function showToast(message, action = null) {
  const m = typeof message === "string" ? { text: message } : message || {};
  // Any new message (or clearing) lets go of the hold: the old toast, or
  // the button under the pointer or focus, may be gone with no pointer
  // leave or blur to say so. Pointing at or focusing the new one holds it.
  held = false;
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
