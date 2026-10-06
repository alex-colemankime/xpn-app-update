import { useSyncExternalStore } from "react";

// One shared clock for labels that go stale as time moves ("until 4pm",
// "Played 3 min ago", what is on air). A single timer serves every
// component, runs only while something is listening, pauses while the app
// is hidden (unless audio is playing: the lock screen still shows the song,
// and judging new songs needs the real time), and catches up the moment it
// is visible again.
const TICK_MS = 15000;
let now = Date.now();
let timer = null;
const listeners = new Set();

const tick = () => {
  now = Date.now();
  listeners.forEach((listener) => listener());
};
let whileHidden = false;
const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
const sync = () => {
  clearInterval(timer);
  timer = null;
  if (listeners.size && (visible() || whileHidden)) {
    tick();
    timer = setInterval(tick, TICK_MS);
  }
};
if (typeof document !== "undefined") document.addEventListener("visibilitychange", sync);

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) sync();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) sync();
  };
}

const getNow = () => now;
export const useNow = () => useSyncExternalStore(subscribe, getNow);
// For code outside React (and tests).
export { subscribe as subscribeClock, getNow };

// Keep the clock running while the app is hidden (true while audio plays).
export function keepClockRunning(on) {
  if (whileHidden === on) return;
  whileHidden = on;
  sync();
}
