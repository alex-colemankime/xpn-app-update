// Archive episodes in the app: the episode core (episode-core.js) wired to a
// real <audio> element, the lock screen, the listener's volume and saved
// places, and handing over to and from the live station.
import { useSyncExternalStore } from "react";
import { createEpisodePlayer, resumeAt } from "./episode-core.js";
import { createLocalStore, createStore } from "./storage.js";
import {
  getFocus,
  getPlayerSnapshot,
  getVolume,
  isConnecting,
  mediaControls,
  pauseStream,
  setAudioFocus,
  subscribeFocus,
  subscribeVolume,
} from "./player.js";
import { SHOWS } from "./catalog.js";
import { tap } from "./haptics.js";

const IDLE = { episode: null, status: "idle", position: 0, duration: 0 };
const episodeStore = createStore(IDLE);

// Where each episode was left: { [id]: { at, of, done, t } } in seconds, the
// 300 most recent.
const KEEP = 300;
const progressStore = createLocalStore("xpn.episodes.progress", {}, (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(
    ([id, p]) => typeof id === "string" && p && Number.isFinite(p.at) && Number.isFinite(p.t),
  );
  if (entries.length <= KEEP) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => b[1].t - a[1].t).slice(0, KEEP));
});

const core = createEpisodePlayer({
  createAudio: () => (typeof Audio === "undefined" ? null : new Audio()),
  mediaSession: mediaControls,
  onChange: (state) => episodeStore.set(state),
  onProgress: (id, place) =>
    progressStore.set((all) => ({ ...all, [id]: { ...place, t: Date.now() } })),
  // An episode starting pauses the station and takes the bar.
  onStart: () => {
    setAudioFocus("episode");
    const { playing, status } = getPlayerSnapshot();
    if (playing || isConnecting(status)) pauseStream();
  },
  resolveUrl: (src) => new URL(src, window.location.href).href,
});

if (typeof window !== "undefined") {
  // The station starting again pauses the episode (it keeps its place).
  subscribeFocus(() => {
    const { status } = core.getState();
    if (getFocus() === "live" && (status === "playing" || status === "loading")) core.pause();
  });
  // Episodes play at the listener's volume.
  subscribeVolume(() => core.setVolume(getVolume()));
}

const withShow = (episode) => ({
  ...episode,
  showName: episode.showName || SHOWS[episode.show]?.name || "WXPN",
});

export function playEpisode(episode) {
  tap("medium");
  const current = core.getState().episode;
  core.setVolume(getVolume());
  if (current?.id === episode.id) {
    core.play(current);
    return;
  }
  core.play(withShow(episode), resumeAt(progressStore.getSnapshot()[episode.id], episode.duration));
}

export function toggleEpisode(episode) {
  const { episode: current, status } = core.getState();
  if (current?.id === episode.id && (status === "playing" || status === "loading")) {
    tap("medium");
    core.pause();
  } else {
    playEpisode(episode);
  }
}

export const pauseEpisode = () => core.pause();
export const resumeEpisode = () => {
  tap("medium");
  core.resume();
};
export const seekEpisode = (seconds) => core.seek(seconds);
export const skipEpisode = (delta) => {
  tap();
  core.skip(delta);
};
// Put the episode away; the bar shows the station again.
export function closeEpisode() {
  core.stop();
  setAudioFocus("live");
}

export const useEpisodePlayer = () =>
  useSyncExternalStore(episodeStore.subscribe, episodeStore.getSnapshot);
export const useAudioFocus = () => useSyncExternalStore(subscribeFocus, getFocus);
// An episode's saved place ({ at, of, done }), or null.
export const useEpisodeProgress = (id) =>
  useSyncExternalStore(progressStore.subscribe, () => progressStore.getSnapshot()[id] || null);
