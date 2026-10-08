// Wires the playback core to the real <audio> element and to lock-screen
// controls via @capgo/capacitor-media-session, which gives one code path:
//   - iOS (Capacitor): lock screen / Control Center controls and metadata
//   - Android (Capacitor): media notification plus a foreground service, so
//     Android does not kill audio when the app is backgrounded
//   - Web/PWA: a thin wrapper over the standard Media Session API
//
// Background audio on iOS additionally needs two native settings once the
// ios/ project is generated (see README, "Native apps"):
//   1. UIBackgroundModes: audio in Info.plist
//   2. AVAudioSession category .playback in AppDelegate

import { Capacitor } from "@capacitor/core";
import { MediaSession as NativeMediaSession } from "@capgo/capacitor-media-session";
import { publicAsset } from "./assets.js";
import { createPlayer, fadeLevel } from "./player-core.js";
import { createLocalStore, createStore } from "./storage.js";
import { STREAMS } from "./streams.js";
import { tap } from "./haptics.js";

// A media-controls failure should degrade silently (no lock-screen metadata),
// never break audio or the app.
const callMediaSession = (method, args) => {
  try {
    const result = NativeMediaSession[method]?.(...args);
    result?.catch?.(() => {});
    return result;
  } catch {
    /* unsupported platform */
  }
};

// The phone apps' lock screens load artwork themselves, outside the web
// view, so they can't reach the app's own files (the station logo, show
// art). Those go as data: URLs, read once each.
const NATIVE = Capacitor.isNativePlatform();
const artCache = new Map();

// Remote art loads as it is; the app's own (capacitor://localhost on iOS,
// https://localhost on Android) can't be reached from outside the web view.
// An address that can't be read is treated as the app's own.
function isOwnFile(src) {
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return true;
  }
}

async function readAsDataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Artwork: HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadableArt(src) {
  if (!NATIVE || (/^https:/i.test(src) && !isOwnFile(src))) return Promise.resolve(src);
  if (!artCache.has(src)) {
    artCache.set(
      src,
      readAsDataUrl(src).catch(() => {
        // Not kept, so the next song with this artwork tries again.
        artCache.delete(src);
        return null;
      }),
    );
  }
  return artCache.get(src);
}
let metadataCalls = 0;

const mediaSession = new Proxy(
  {},
  {
    get: (_, method) => {
      if (method === "setMetadata" && NATIVE) {
        // The newest call wins, even if an older one's artwork loads later.
        return async (metadata) => {
          const call = ++metadataCalls;
          const artwork = await Promise.all(
            (metadata.artwork || []).map(async (art) => {
              const src = await loadableArt(art.src);
              return src ? { ...art, src } : null;
            }),
          );
          if (call !== metadataCalls) return;
          callMediaSession("setMetadata", [{ ...metadata, artwork: artwork.filter(Boolean) }]);
        };
      }
      if (method === "setPositionState" && NATIVE) {
        // Called with nothing, the web clears the progress bar; the phone
        // apps keep their last values unless given new ones.
        return (state) =>
          callMediaSession("setPositionState", [
            state || { duration: 0, position: 0, playbackRate: 1 },
          ]);
      }
      return (...args) => callMediaSession(method, args);
    },
  },
);

// Which player has the lock screen and the player bar: the station ("live")
// or an archive episode (episode-player.js). Whichever started last.
const focusStore = createStore("live");
export const subscribeFocus = focusStore.subscribe;
export const getFocus = focusStore.getSnapshot;
export const setAudioFocus = (source) => focusStore.set(source);
// The lock-screen controls, shared with the episode player.
export const mediaControls = mediaSession;

const player = createPlayer({
  createAudio: () => (typeof Audio === "undefined" ? null : new Audio()),
  mediaSession,
  isActive: () => focusStore.getSnapshot() === "live",
  streams: STREAMS,
  initialStreamId: "xpn",
  stationArtwork: [
    { src: publicAsset("icons/icon-192.png"), sizes: "192x192", type: "image/png" },
    { src: publicAsset("icons/icon-512.png"), sizes: "512x512", type: "image/png" },
  ],
  resolveUrl: (src) => new URL(src, window.location.href).href,
});

// React reads playback state through useSyncExternalStore (hooks/usePlayer.js),
// so the player stays the single source of truth instead of being mirrored
// into component state.
const playerStore = createStore({
  status: "paused",
  playing: false,
  streamId: "xpn",
  castAvailable: false,
});
const update = (patch) => playerStore.set((current) => ({ ...current, ...patch }));
export const subscribePlayer = playerStore.subscribe;
export const getPlayerSnapshot = playerStore.getSnapshot;

// Volume is remembered across launches under the original key.
const volumeStore = createLocalStore("xpn.volume", 70, (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 70;
});
export const subscribeVolume = volumeStore.subscribe;
export const getVolume = volumeStore.getSnapshot;

// iOS sets volume only with the device's buttons, so the app offers no
// volume slider there.
export const VOLUME_SETTABLE = Capacitor.getPlatform() !== "ios";

// The alarm plays at its own volume without touching the listener's saved
// one, which comes back as soon as playback stops.
let temporaryVolume = false;

export function setVolume(percent) {
  temporaryVolume = false;
  volumeStore.set(percent);
  player.setVolume(volumeStore.getSnapshot());
}

export function setTemporaryVolume(percent) {
  temporaryVolume = true;
  player.setVolume(percent);
}
const AUDIBLE = ["loading", "reconnecting", "playing"];

if (typeof window !== "undefined") {
  // When an episode gives up the lock screen (closed, or the station played
  // again), the station's controls and song info go back on it.
  subscribeFocus(() => {
    if (focusStore.getSnapshot() === "live") player.takeControls();
  });
  // No network is used until play: the element is created with preload=none.
  player.init(
    (playing) => update({ playing }),
    (status) => {
      update({ status });
      if (temporaryVolume && !AUDIBLE.includes(status)) {
        temporaryVolume = false;
        player.setVolume(volumeStore.getSnapshot());
      }
    },
  );
  player.setVolume(volumeStore.getSnapshot());
  update({ castAvailable: player.canCast() });
  // Coming back online skips the rest of a reconnect backoff.
  window.addEventListener("online", () => player.resume());
}

// Playing the station takes the lock screen and the bar back from an episode
// (which pauses itself; see episode-player.js).
export function playStream() {
  focusStore.set("live");
  player.play();
}
export const pauseStream = player.pause;
export const setMetadata = player.setMetadata;
export const promptCast = player.promptCast;

export function selectStream(id) {
  if (id !== getPlayerSnapshot().streamId) tap();
  if (!player.setStream(id)) return false;
  update({ streamId: id });
  return true;
}

// Is the listener waiting on audio (connecting, buffering or retrying)?
export const isConnecting = (status) => status === "loading" || status === "reconnecting";

export function togglePlayback() {
  tap("medium");
  const { playing, status } = getPlayerSnapshot();
  if (playing || isConnecting(status)) {
    pauseStream();
    return;
  }
  playStream();
  // Pressing play is a good moment to refresh the song info.
  window.dispatchEvent(new Event("wxpn:refresh-playlist"));
}

// Sleep timer. Playback fades out over the last 20 seconds and then pauses;
// the saved volume comes back on its own once playback stops (see
// setTemporaryVolume). Stopping playback any other way cancels the timer.
const sleepStore = createStore(null); // when playback will stop (epoch ms)
let sleepTick = null;
let sleepFading = false;
export const subscribeSleep = sleepStore.subscribe;
export const getSleepEndsAt = sleepStore.getSnapshot;

export function cancelSleepTimer() {
  if (sleepStore.getSnapshot() === null) return;
  clearInterval(sleepTick);
  sleepTick = null;
  // Cancelled mid-fade: back to the listener's volume. Harmless when paused,
  // and needed if the stream is reconnecting (it would resume faded).
  if (sleepFading) setVolume(volumeStore.getSnapshot());
  sleepFading = false;
  sleepStore.set(null);
}

// Stop playback at a moment (epoch ms), such as the end of the current show.
// Replacing a timer that is already fading brings the volume back first.
export function sleepUntil(endsAt) {
  clearInterval(sleepTick);
  if (sleepFading) setVolume(volumeStore.getSnapshot());
  sleepFading = false;
  sleepStore.set(endsAt);
  sleepTick = setInterval(() => {
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      pauseStream(); // pause first, so restoring the volume is silent
      cancelSleepTimer();
      return;
    }
    const level = fadeLevel(remaining);
    if (level < 1) {
      sleepFading = true;
      setTemporaryVolume(Math.round(volumeStore.getSnapshot() * level));
    }
  }, 1000);
}

export const startSleepTimer = (minutes) => sleepUntil(Date.now() + minutes * 60000);

// A timer only makes sense while there is audio to stop.
subscribePlayer(() => {
  const { status } = getPlayerSnapshot();
  if (getSleepEndsAt() !== null && ["paused", "error", "blocked"].includes(status)) {
    cancelSleepTimer();
  }
});
