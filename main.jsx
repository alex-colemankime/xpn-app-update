import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./error-boundary.jsx";
import { startPlaylistSync } from "./playlist-sync.js";
// Bundled with the app rather than loaded from Google Fonts: no third-party
// request on launch, and text renders the same offline.
import "@fontsource-variable/figtree";
import "./global.css";
import { reportError, startAnalytics, track } from "./analytics.js";
import { startListeningMeter } from "./listening.js";
import { startDeepLinks } from "./deep-links.js";
import { startReviewPrompts } from "./review.js";
import { getSavedSongs, subscribeFavorites } from "./favorites.js";
import { getEpisodeSnapshot, subscribeEpisode } from "./episode-player.js";
import { onAirAt } from "./catalog.js";
import { followTextSize } from "./text-size.js";
import { startCarAudio } from "./car.js";
import { fixInsets } from "./fixed-insets.js";
import {
  getPlayerSnapshot,
  pauseStream,
  playStream,
  selectStream,
  subscribePlayer,
} from "./player.js";

// Menus (song, sleep timer, calendar) use the Popover API, which Safari has
// from 17. Older iPhones (iOS 15–16) get a small polyfill, loaded only there.
if (!("popover" in HTMLElement.prototype)) {
  await import("@oddbird/popover-polyfill").catch(() => {});
}

// The shared design preview (VITE_DEVICE_PREVIEW, GitHub Pages only): on a
// computer, the link opens the app inside a phone, tablet or laptop frame,
// and the app itself runs in that frame (?frame=1). Phones and tablets, and
// every other build, get the app directly.
const devicePreview =
  __DEVICE_PREVIEW__ &&
  window.self === window.top &&
  !new URLSearchParams(window.location.search).has("frame") &&
  window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)").matches;

if (devicePreview) {
  const { mountDevicePreview } = await import("./preview-shell.js");
  // This build's entry file name changes with every release, so the frame
  // asks for the same release as the page around it, never a cached older one.
  mountDevicePreview(document.getElementById("root"), {
    build: new URL(import.meta.url).pathname.split("/").pop(),
  });
} else {
  // Hearted songs follow to Spotify or Apple Music once connected.
  startPlaylistSync();
  startAnalytics();
  followTextSize();
  startDeepLinks();
  // A store rating is asked for after a heart, once the listener knows the app.
  let songs = getSavedSongs().length;
  const reviews = startReviewPrompts({
    version: __APP_VERSION__,
    subscribeSaves: (onSave) =>
      subscribeFavorites(() => {
        const now = getSavedSongs().length;
        if (now > songs) onSave();
        songs = now;
      }),
  });
  startListeningMeter({
    track: (name, params) => {
      track(name, params);
      reviews.addMinutes(params.minutes);
    },
    live: { subscribe: subscribePlayer, getSnapshot: getPlayerSnapshot },
    episode: { subscribe: subscribeEpisode, getSnapshot: getEpisodeSnapshot },
    // The FM schedule names WXPN's shows; XPN2 and Homegrown have none.
    showOnAir: (station) => (station === "xpn" ? onAirAt()?.show.id || "" : ""),
  });
  fixInsets();
  startCarAudio({
    select: selectStream,
    play: playStream,
    pause: pauseStream,
    subscribe: subscribePlayer,
    getSnapshot: getPlayerSnapshot,
  });
  createRoot(document.getElementById("root"), {
    onCaughtError: (error, info) => {
      console.error("WXPN app error:", error, info.componentStack);
      reportError(error, { where: "screen", fatal: true });
    },
    onUncaughtError: (error) => reportError(error, { where: "app", fatal: true }),
  }).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
