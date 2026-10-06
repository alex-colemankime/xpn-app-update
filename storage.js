import { useSyncExternalStore } from "react";

const canUseStorage = () => {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
};

export function readJson(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage quota should not break UI state.
  }
}

// A value that React can read with useSyncExternalStore, and that any module
// can update. The app's shared state (player, sleep timer, toast, clock and
// everything saved on the device) is built on this.
export function createStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      snapshot = typeof next === "function" ? next(snapshot) : next;
      listeners.forEach((listener) => listener());
    },
  };
}

// A store kept in localStorage under `key`. `normalize` repairs whatever is
// read back, so a damaged or outdated value can never reach the UI. Changes
// made in another tab are picked up too.
export function createLocalStore(key, fallback, normalize = (value) => value) {
  const store = createStore(normalize(readJson(key, fallback)));
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === key) store.set(normalize(readJson(key, fallback)));
    });
  }
  return {
    ...store,
    set(next) {
      const value = normalize(typeof next === "function" ? next(store.getSnapshot()) : next);
      writeJson(key, value);
      store.set(value);
    },
  };
}

export function useLocalStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
