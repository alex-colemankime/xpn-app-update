// Archive episodes in the app: the episode core (episode-core.js) wired to a
// real <audio> element, the lock screen, the listener's volume and saved
// places, and handing over to and from the live station.
import { useSyncExternalStore } from "react";
import { promptCast } from "./cast.js";
import { createEpisodePlayer, resumeAt } from "./episode-core.js";
import { createLocalStore, createStore } from "./storage.js";
import {
  getFocus,
  getVolume,
  mediaControls,
  pauseStream,
  setAudioFocus,
  stationIsOn,
  subscribeFocus,
  subscribeVolume,
  togglePlayback,
} from "./player.js";
import { SHOWS } from "./catalog.js";
import { findEpisode, freshCopy, linkIsFresh } from "./archive.js";
import { tap } from "./haptics.js";
import { showToast } from "./toast.js";
import { track } from "./analytics.js";

// Where each episode was left: { [id]: { at, of, done, t } } in seconds, the
// 300 most recent.
const KEEP = 300;
const progressStore = createLocalStore("xpn.episodes.progress", {}, (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(
    ([, p]) => p && Number.isFinite(p.at) && Number.isFinite(p.t),
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

// The episode's own <audio> element, kept for the AirPlay / Cast picker.
let episodeAudio = null;
const core = createEpisodePlayer({
  createAudio: () => (episodeAudio = typeof Audio === "undefined" ? null : new Audio()),
  mediaSession: mediaControls,
  // The station took the controls back: the episode no longer writes there.
  ownsControls: () => getFocus() === "episode",
  onChange: (state) => episodeStore.set(state),
  onProgress: (id, place) =>
    progressStore.set((all) => ({ ...all, [id]: { ...place, t: Date.now() } })),
  // An episode starting pauses the station and takes the bar.
  onStart: () => {
    setAudioFocus("episode");
    if (stationIsOn()) pauseStream();
  },
  // Signed archive links run out: one read too long ago is read again from
  // the show's page first (archive.js).
  needsRefresh: (episode) => !linkIsFresh(episode),
  refresh: findEpisode,
  onError: (reason) => showToast(CANT_PLAY[reason] || CANT_PLAY.audio),
  resolveUrl: (src) => new URL(src, window.location.href).href,
});
// What the player bar and the archive draw from. The core only reports
// changes once something plays, so this starts from its idle state.
const episodeStore = createStore(core.getState());
export const subscribeEpisode = episodeStore.subscribe;
export const getEpisodeSnapshot = episodeStore.getSnapshot;

// Whether an episode is playing, or on its way (its key shows Pause).
export const episodeIsOn = ({ episode, status }) =>
  Boolean(episode) && (status === "playing" || status === "loading");

if (typeof window !== "undefined") {
  // The station starting again pauses the episode (it keeps its place).
  subscribeFocus(() => {
    if (getFocus() === "live" && episodeIsOn(core.getState())) core.pause();
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
  track("episode_play", { show: episode.show || "" });
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
  const state = core.getState();
  if (state.episode?.id === episode.id && episodeIsOn(state)) {
    tap("medium");
    core.pause();
  } else {
    playEpisode(episode);
  }
}

// Play or pause whatever has the player bar: the episode while it does,
// otherwise the station (the Space key, useSpaceToPlay).
export function togglePlayer() {
  if (getFocus() !== "episode" || !core.getState().episode) {
    togglePlayback();
    return;
  }
  tap("medium");
  core.toggle();
}

export const pauseEpisode = () => core.pause();
// Opens AirPlay or Cast for the episode (cast.js).
export const castEpisode = () => promptCast(episodeAudio);
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
