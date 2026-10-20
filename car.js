// CarPlay and Android Auto (iOS and Android apps). The car shows the three
// stations; choosing one plays it, and the car's play and pause buttons work
// as the app's do. The native side (ios/App/App, android/app/src/main; see
// README) lists the stations and hands the listener's choices to the app
// here through a small plugin, "CarAudio", since the audio itself plays in
// the app. On CarPlay, what's playing comes from the lock screen's information,
// which the app already keeps current; Android Auto gets it from here.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { STREAMS } from "./streams.js";
import { webUrl } from "./text.js";

const CarAudio = registerPlugin("CarAudio");

// What a command from the car does. Pure, so it can be tested.
//   { action: "play", stationId }   that station, playing
//   { action: "play" }              whatever has the player bar, playing
//   { action: "pause" }             whatever has the player bar, paused
//   { action: "toggle" }            whatever has the player bar, played if
//                                   it was stopped, else paused (the home
//                                   screen widget's key, widget.js)
// `live` is the station's actions ({ select, play, pause, getSnapshot }); `episode` the
// archive player's ({ current, play, pause }), whose `current()` is its state
// while an episode has the bar, else null.
export function carCommand(event, { live, episode }) {
  const action = event?.action;
  if (action === "play" && event.stationId) {
    if (!STREAMS[event.stationId]) return;
    live.select(event.stationId);
    return live.play();
  }
  const current = episode?.current();
  const target = current ? episode : live;
  if (action === "toggle") {
    const snap = current || live.getSnapshot?.() || {};
    const on = current
      ? current.status === "playing" || current.status === "loading"
      : Boolean(snap.playing) || snap.status === "loading" || snap.status === "reconnecting";
    return on ? target.pause() : target.play();
  }
  if (action === "pause") return target.pause();
  if (action === "play") return target.play();
}

// What the car shows as playing: the episode while one has the bar (no
// station marked in the car's list), else the station, and the song when one
// is known. Pure, so it can be tested.
export function carNowPlaying({ streamId, playing, track }, episode = null) {
  if (episode?.episode) {
    const { episode: ep, status } = episode;
    return {
      stationId: "",
      playing: status === "playing" || status === "loading",
      title: ep.title || "WXPN",
      artist: ep.showName || "WXPN",
      // Native code fetches the art itself: only a web address will do (the
      // app's own show art isn't one; the station tile stands in).
      artwork: webUrl(ep.image),
    };
  }
  const station = STREAMS[streamId] || STREAMS.xpn;
  return {
    stationId: station.id,
    playing: Boolean(playing),
    title: track?.title || station.label,
    artist: track?.title ? `${track.artist} · ${station.label}` : station.tagline,
    artwork: track?.img || "",
  };
}

// At launch (phone apps only). `live` and `episode` are the two players'
// actions (as for carCommand), each with `subscribe`; the car follows them.
export function startCarAudio({ live, episode }) {
  if (!Capacitor.isNativePlatform()) return;
  CarAudio.addListener("command", (event) => carCommand(event, { live, episode })).catch(
    () => {}, // a build without the native side: nothing to do
  );
  let last = "";
  const report = () => {
    const now = carNowPlaying(live.getSnapshot(), episode.current());
    const key = JSON.stringify(now);
    if (key === last) return;
    last = key;
    CarAudio.setNowPlaying(now).catch(() => {});
  };
  live.subscribe(report);
  episode.subscribe(report);
  report();
}
