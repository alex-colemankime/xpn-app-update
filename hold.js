import { createStore } from "./storage.js";
import { tap } from "./haptics.js";

// Press and hold a song, show, episode, concert or video for its menu (save,
// share, add to a playlist or a calendar), as on a phone's own lists. Touch
// only: a mouse works as it always has, and every choice in the menu is also
// a button on the row or the page it opens.
//
// One set of listeners on the page serves every row: a row registers what
// its menu shows with `holdable` (a ref), and HoldMenu draws the menu.

const HOLD_MS = 450;
const SLOP = 10; // px a finger may wander and still be holding

const handlers = new WeakMap();
const menu = createStore(null);
export const subscribeHoldMenu = menu.subscribe;
export const getHoldMenu = menu.getSnapshot;
export const closeHoldMenu = () => menu.set(null);

// Opens the menu over whatever is in front: a sheet that is open (a modal
// sheet makes the rest of the page inert), or the page.
export function openHoldMenu(item) {
  const sheets = document.querySelectorAll("dialog[open]");
  menu.set({ ...item, container: sheets[sheets.length - 1] || document.body });
}

// A ref for an element that opens a menu when held: `open()` says what the
// menu shows (and calls openHoldMenu).
export const holdable = (open) => (el) => {
  if (!el) return;
  handlers.set(el, open);
  el.dataset.hold = "";
  return () => {
    handlers.delete(el);
    delete el.dataset.hold;
  };
};

let started = false;
export function startHold() {
  if (started || typeof document === "undefined") return;
  started = true;
  let press = null; // { el, x, y, timer }
  let fired = false;
  let lastTouch = 0;
  // The row eases down into a raised fill while held (data-holding,
  // styles/gestures.css), so the menu is the end of something visible; let
  // go early and it springs back at once.
  const clear = () => {
    if (press) {
      clearTimeout(press.timer);
      delete press.el.dataset.holding;
    }
    press = null;
  };
  document.addEventListener(
    "touchstart",
    (e) => {
      lastTouch = e.timeStamp;
      fired = false;
      clear();
      if (e.touches.length !== 1) return;
      const el = e.target.closest?.("[data-hold]");
      if (!el || !handlers.has(el) || e.target.closest("input, textarea, select")) return;
      const t = e.touches[0];
      el.dataset.holding = "";
      press = {
        el,
        x: t.clientX,
        y: t.clientY,
        timer: setTimeout(() => {
          const open = handlers.get(el);
          delete el.dataset.holding;
          press = null;
          if (!open || !el.isConnected) return;
          fired = true;
          tap("medium");
          open();
        }, HOLD_MS),
      };
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!press) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - press.x, t.clientY - press.y) > SLOP) clear();
    },
    { passive: true, capture: true },
  );
  // Lifting the finger after the menu opened isn't also a tap on the row.
  // (touchend never holds up scrolling, so it may be cancelable.)
  document.addEventListener(
    "touchend",
    (e) => {
      clear();
      if (fired && e.cancelable) e.preventDefault();
      fired = false;
    },
    { capture: true },
  );
  document.addEventListener("touchcancel", clear, { passive: true, capture: true });
  window.addEventListener("scroll", clear, { passive: true, capture: true });
  // The browser's own long-press menu (a link's, Android's) gives way.
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (e.timeStamp - lastTouch < 1500 && e.target.closest?.("[data-hold]")) e.preventDefault();
    },
    { capture: true },
  );
}
