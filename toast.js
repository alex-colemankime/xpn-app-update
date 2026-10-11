import { useSyncExternalStore } from "react";
import { createStore } from "./storage.js";

// One transient message at a time ("Copied to clipboard."), readable from
// anywhere without threading a callback through every screen. Every message
// clears itself. A short line ("Removed from Favorites", with Undo) is a
// small pill that goes quickly; a longer notice is a bar that stays a few
// seconds, a little longer with an action so there's time to use it. Never
// while the pointer or keyboard focus is on it, so no one races the timer
// mid-action.
const EMPTY = { text: "", title: "", image: "", icon: "", action: null, brief: false };
const toastStore = createStore(EMPTY);
// Up to this many characters, a line without a title or picture is a pill.
const BRIEF_CHARS = 40;
const HIDE_AFTER_MS = { brief: 2500, briefAction: 3500, plain: 5000, action: 8000 };
let timer = null;
let held = false;

const schedule = () => {
  clearTimeout(timer);
  const { text, title, action, brief } = toastStore.getSnapshot();
  if (!(text || title) || held) return;
  const wait = brief
    ? HIDE_AFTER_MS[action ? "briefAction" : "brief"]
    : HIDE_AFTER_MS[action ? "action" : "plain"];
  timer = setTimeout(() => showToast(""), wait);
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
          brief: !m.title && !m.image && !m.icon && (m.text || "").length <= BRIEF_CHARS,
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

export const getToast = toastStore.getSnapshot;
export const useToast = () => useSyncExternalStore(toastStore.subscribe, getToast);
