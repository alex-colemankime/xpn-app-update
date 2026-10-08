// CarPlay and Android Auto (iOS and Android apps). The car shows the three
// stations; choosing one plays it, and the car's play and pause buttons work
// as the app's do. The native side (native/ios, native/android; see README)
// lists the stations and hands the listener's choices to the app here
// through a small plugin, "CarAudio", since the audio itself plays in the
// app. On CarPlay, what's playing comes from the lock screen's information,
// which the app already keeps current; Android Auto gets it from here.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { STREAMS } from "./streams.js";

const CarAudio = registerPlugin("CarAudio");

// What a command from the car does. Pure, so it can be tested.
//   { action: "play", stationId }   that station, playing
//   { action: "play" }              the current station, playing
//   { action: "pause" }
export function carCommand(event, { select, play, pause }) {
  if (event?.action === "pause") return pause();
  if (event?.action !== "play") return;
  if (event.stationId) {
    if (!STREAMS[event.stationId]) return;
    select(event.stationId);
  }
  play();
}

// What the car shows as playing: the station, and the song when one is
// known. Pure, so it can be tested.
export function carNowPlaying({ streamId, playing, track }) {
  const station = STREAMS[streamId] || STREAMS.xpn;
  return {
    stationId: station.id,
    playing: Boolean(playing),
    title: track?.title || station.label,
    artist: track?.title ? `${track.artist} · ${station.label}` : station.tagline,
    artwork: track?.img || "",
  };
}

// At launch (phone apps only). `player` gives the app's own actions and its
// store; the car follows the store.
export function startCarAudio({ select, play, pause, subscribe, getSnapshot }) {
  if (!Capacitor.isNativePlatform()) return;
  CarAudio.addListener("command", (event) => carCommand(event, { select, play, pause })).catch(
    () => {}, // a build without the native side: nothing to do
  );
  let last = "";
  const report = () => {
    const now = carNowPlaying(getSnapshot());
    const key = JSON.stringify(now);
    if (key === last) return;
    last = key;
    CarAudio.setNowPlaying(now).catch(() => {});
  };
  subscribe(report);
  report();
}
