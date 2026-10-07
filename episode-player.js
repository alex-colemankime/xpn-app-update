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
import { findEpisode, freshCopy, linkIsFresh } from "./archive.js";
import { tap } from "./haptics.js";
import { showToast } from "./toast.js";

const IDLE = { episode: null, status: "idle", position: 0, duration: 0, error: null };
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

// What the listener is told when an episode can't play.
const CANT_PLAY = {
  gone: "That broadcast is no longer in the xpn.org archive.",
  offline: "Couldn’t reach xpn.org to start that broadcast. Check your connection and try again.",
  audio: "That broadcast couldn’t play. Try again in a moment.",
};

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
  // Signed archive links run out: one read too long ago is read again from
  // the show's page first (archive.js).
  needsRefresh: (episode) => !linkIsFresh(episode),
  refresh: findEpisode,
  onError: (reason) => showToast(CANT_PLAY[reason] || CANT_PLAY.audio),
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
  // The archive's own copy, when its link is fresh, plays without a wait
  // (a saved episode keeps no link of its own).
  const playable = withShow({ ...episode, ...freshCopy(episode) });
  core.play(playable, resumeAt(progressStore.getSnapshot()[episode.id], playable.duration));
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
export const getEpisodeState = () => core.getState();
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
