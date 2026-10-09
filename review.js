// Asking for a store rating (iOS and Android apps), the way Apple and Google
// want it: rarely, and at a good moment, never from a button or after a
// problem. The app asks right after a listener hearts a song, once they have
// listened for two hours in all and saved a few things, at most once per
// version and never within 120 days of the last time. The phone itself may
// still decide not to show the request (iOS shows it at most three times a
// year).

import { Capacitor } from "@capacitor/core";
import { InAppReview } from "@capacitor-community/in-app-review";
import { readJson, writeJson } from "./storage.js";
import { featureOn } from "./features.js";

const KEY = "xpn.review";
const MIN_MINUTES = 120;
const MIN_SAVES = 3;
const GAP_MS = 120 * 24 * 3600000;

// Whether now is the moment. Pure, so it can be tested.
export function shouldAskForReview(state, { now, version }) {
  if ((state.minutes || 0) < MIN_MINUTES || (state.saves || 0) < MIN_SAVES) return false;
  if (state.askedVersion === version) return false;
  return !state.askedAt || now - state.askedAt >= GAP_MS;
}

// At launch (phone apps): counts listening minutes (from listening.js's
// reports) and hearts, and asks after a heart when the time is right.
export function startReviewPrompts({ version, subscribeSaves }) {
  if (!Capacitor.isNativePlatform()) return { addMinutes() {} };
  let state = readJson(KEY, {});
  const save = (patch) => writeJson(KEY, (state = { ...state, ...patch }));
  subscribeSaves(() => {
    save({ saves: (state.saves || 0) + 1 });
    if (!featureOn("reviewPrompt")) return;
    if (!shouldAskForReview(state, { now: Date.now(), version })) return;
    save({ askedAt: Date.now(), askedVersion: version });
    // A moment after the heart, so the request doesn't cover it.
    setTimeout(() => InAppReview.requestReview().catch(() => {}), 1500);
  });
  return { addMinutes: (m) => save({ minutes: (state.minutes || 0) + m }) };
}
