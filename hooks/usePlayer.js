import { useSyncExternalStore } from "react";
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

// Opens the system picker for AirPlay / Chromecast-style outputs.
export async function chooseAudioOutput() {
  try {
    await promptCast();
  } catch (error) {
    if (error.name !== "NotAllowedError") {
      showToast("No audio output is available. Use your device’s audio controls.");
    }
  }
}
