import { useSyncExternalStore } from "react";
import { castEpisode } from "../episode-player.js";
import {
  getPlayerSnapshot,
  getSleepEndsAt,
  getVolume,
  isConnecting,
  promptCast,
  subscribePlayer,
  subscribeSleep,
  subscribeVolume,
} from "../player.js";
import { STREAMS } from "../streams.js";
import { showToast } from "../toast.js";

// Playback state for any component, without threading props through the app.
export function usePlayer() {
  const state = useSyncExternalStore(subscribePlayer, getPlayerSnapshot);
  return { ...state, station: STREAMS[state.streamId], connecting: isConnecting(state.status) };
}

export const useVolume = () => useSyncExternalStore(subscribeVolume, getVolume);

// When the sleep timer will stop playback (epoch ms), or null.
export const useSleepTimer = () => useSyncExternalStore(subscribeSleep, getSleepEndsAt);

// Opens the system picker for AirPlay or Google Cast (cast.js): for the
// station, or with `open`, another player's (the episode's).
async function choose(open) {
  try {
    await open();
  } catch (error) {
    // Closing the picker without choosing isn't a failure.
    if (error.name !== "NotAllowedError" && error.name !== "AbortError") {
      showToast("No other speakers or TVs are available. Use your device’s audio controls.");
    }
  }
}
export const chooseAudioOutput = () => choose(promptCast);
export const chooseEpisodeOutput = () => choose(castEpisode);
