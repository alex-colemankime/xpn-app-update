// player.js — real audio for the WXPN app.
//
// One shared <audio> element does the actual playback on every platform
// (plain HTTPS MP3/AAC from StreamGuys — no HLS library needed).
//
// Media session handling goes through @capgo/capacitor-media-session,
// which gives one code path everywhere:
//   - iOS (Capacitor): lock screen / control center controls + metadata
//   - Android (Capacitor): media notification with controls, PLUS a
//     foreground service so Android doesn't kill audio when the app
//     is backgrounded — this is the part a bare WebView can't do
//   - Web/PWA: thin wrapper over the standard Media Session API
//
// iOS background audio additionally needs two native-side settings,
// already applied in the ios/ project (see README):
//   1. UIBackgroundModes: audio in Info.plist
//   2. AVAudioSession category .playback in AppDelegate

import { MediaSession as MS } from "@capgo/capacitor-media-session";

const noop = () => {};
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

// A media-controls failure should degrade silently (no lock screen
// metadata), never crash audio or the app.
const MediaSession = new Proxy(
  {},
  {
    get:
      (_, method) =>
      (...args) => {
        try {
          const r = MS[method]?.(...args);
          if (r?.catch) r.catch(() => {});
          return r;
        } catch {
          /* unsupported platform — ignore */
        }
      },
  },
);

export const STREAMS = {
  xpn: {
    id: "xpn",
    label: "WXPN",
    short: "WXPN",
    tagline: "88.5 FM · Public Radio",
    // Verified 2026-06-15. This no-preroll mount is suitable for app playback.
    url: "https://wxpnhi.xpn.org/xpnhi-nopreroll",
  },
  xpn2: {
    id: "xpn2",
    label: "XPN2",
    short: "XPN2",
    tagline: "XPoNential Radio",
    // Verified 2026-06-15 via StreamGuys response headers.
    url: "https://wxpnhi.xpn.org/xpn2mp3hi",
  },
  kids: {
    id: "kids",
    label: "Kids Corner",
    short: "Kids Corner",
    tagline: "Family music, all day",
    // Verified 2026-06-15 from kidscorner.org playlist 6107.
    url: "https://wxpnhi.xpn.org/kidscornermp3hi",
  },
};

const ARTWORK = [
  { src: publicAsset("icons/icon-192.png"), sizes: "192x192", type: "image/png" },
  { src: publicAsset("icons/icon-512.png"), sizes: "512x512", type: "image/png" },
];

let audio = null;
let currentStream = STREAMS.xpn;
let onPlayingChange = noop;
let onStatusChange = noop;
let playRequest = 0;
let currentTrack = null;

const setPlayingState = (playing) => {
  onPlayingChange(Boolean(playing));
  MediaSession.setPlaybackState({ playbackState: playing ? "playing" : "paused" });
};

export function initPlayer(setPlaying = noop, setStatus = noop) {
  onPlayingChange = setPlaying;
  onStatusChange = setStatus;
  if (audio) return audio;
  if (typeof Audio === "undefined") return null;

  audio = new Audio();
  audio.preload = "none"; // don't buffer a live stream until play is tapped

  // Keep React state honest if playback is interrupted (network drop,
  // a phone call, another app taking the audio session, etc.)
  audio.addEventListener("pause", () => {
    setPlayingState(false);
  });
  audio.addEventListener("playing", () => {
    setPlayingState(true);
    onStatusChange("playing");
  });
  audio.addEventListener("waiting", () => onStatusChange("loading"));
  // A live stream that errors or runs dry should flip the UI back to
  // paused — otherwise the app shows "playing" over dead air. (Ignore
  // the error fired by intentional source detach in pauseStream.)
  audio.addEventListener("error", () => {
    if (audio.getAttribute("src")) {
      setPlayingState(false);
      onStatusChange("error");
    }
  });
  audio.addEventListener("ended", () => {
    setPlayingState(false);
    onStatusChange("paused");
  });

  // Lock screen / notification / headset buttons drive the same state
  // as the on-screen play button.
  MediaSession.setActionHandler({ action: "play" }, () => playStream());
  MediaSession.setActionHandler({ action: "pause" }, () => pauseStream());
  MediaSession.setActionHandler({ action: "stop" }, () => pauseStream());

  setMetadata();
  return audio;
}

export function playStream() {
  if (!audio) initPlayer();
  if (!audio || !currentStream.url) {
    setPlayingState(false);
    return;
  }
  // For a live stream, re-attach the source on every play so listeners
  // rejoin "now" instead of resuming a stale buffer.
  const request = ++playRequest;
  onStatusChange("loading");
  audio.src = currentStream.url;
  audio.play().catch(() => {
    if (request !== playRequest) return;
    setPlayingState(false);
    onStatusChange("error");
  });
  setMetadata(currentTrack);
}

export function pauseStream() {
  ++playRequest;
  if (!audio) return;
  audio.pause();
  // Detach the source so the stream stops buffering in the background
  // (saves listener data on mobile).
  audio.removeAttribute("src");
  audio.load();
  setPlayingState(false);
  onStatusChange("paused");
}

export function setStream(id) {
  const next = STREAMS[id];
  if (!next || !next.url) return false;
  if (next.id === currentStream.id) return true;
  const wasPlaying = audio && !audio.paused;
  currentStream = next;
  currentTrack = null;
  if (wasPlaying) playStream();
  else {
    setMetadata();
    onStatusChange("paused");
  }
  return true;
}

export function getCurrentStream() {
  return currentStream;
}

export function setPlayerVolume(percent) {
  if (!audio) initPlayer();
  if (!audio) return;
  const value = Number(percent);
  audio.volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value / 100 : 0.7));
}

// Hook point for live "now playing" data. Poll the playlist feed and
// call this with {title, artist, album} — the lock screen and the
// Android notification will show the current song.
export function setMetadata(track) {
  currentTrack = track || null;
  let artwork = ARTWORK;
  if (track?.img && typeof window !== "undefined") {
    try {
      artwork = [{ src: new URL(track.img, window.location.href).href }];
    } catch {
      /* Use station art if the track art is invalid. */
    }
  }
  MediaSession.setMetadata({
    title: track?.title || currentStream.label,
    artist: track?.artist || currentStream.tagline,
    album: track?.album || "",
    artwork,
  });
}

export function canCast() {
  return Boolean(audio?.remote?.prompt || audio?.webkitShowPlaybackTargetPicker);
}

export async function promptCast() {
  if (audio?.remote?.prompt) return audio.remote.prompt();
  if (audio?.webkitShowPlaybackTargetPicker) return audio.webkitShowPlaybackTargetPicker();
  throw new Error("Audio output selection is not available in this browser.");
}
