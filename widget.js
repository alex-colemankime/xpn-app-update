// The home screen widget (iOS and Android apps): a block with the stream
// you're listening to, the song's artwork, title and artist, the show on
// the air, and play or pause. The app keeps it current through a small
// plugin, "HomeWidget" (ios/App/App/HomeWidgetPlugin.swift,
// android/app/src/main/java/org/xpn/wxpn/HomeWidgetPlugin.kt), which stores
// what's playing where the widget can read it and asks the system to redraw
// it. The widget's play key opens the app and plays or pauses, as a car's
// play key does (car.js, "toggle"), and a tap on a stream's name in its top
// row opens the app playing that stream (car.js, "play" with a station).

import { Capacitor, registerPlugin } from "@capacitor/core";
import { STREAMS } from "./streams.js";

const HomeWidget = registerPlugin("HomeWidget");

// What the widget shows. Pure, so it can be tested.
//   stationId the stream playing, marked in the widget's row of streams
//             (WXPN, XPN2, Homegrown; a tap on one plays it), or "" while an
//             archived episode has the player
//   station   its name (WXPN, XPN2, Homegrown), or the episode's show
//   title, artist, artwork   the song when one is known, else the station
//   show      the show on the air (WXPN's schedule only), else ""
//   playing   whether the player is playing (or about to)
export function widgetNowPlaying({ streamId, playing, track }, episode = null, onAir = "") {
  if (episode?.episode) {
    const { episode: ep, status } = episode;
    return {
      stationId: "",
      station: ep.showName || "WXPN",
      title: ep.title || "WXPN",
      artist: ep.showName || "",
      show: "",
      artwork: ep.image || "",
      playing: status === "playing" || status === "loading",
    };
  }
  const station = STREAMS[streamId] || STREAMS.xpn;
  const song = Boolean(track?.title);
  return {
    stationId: station.id,
    station: station.label,
    title: song ? track.title : station.label,
    artist: song ? track.artist || "" : station.tagline,
    show: station.id === "xpn" ? onAir : "",
    artwork: (song && track.img) || "",
    playing: Boolean(playing),
  };
}

// At launch (phone apps only), with the same players as the car
// (startCarAudio) and `showOnAir()`, the name of WXPN's show on the air.
// The show changes on the hour without anything else changing, so what the
// widget shows is looked at again each minute too; it's only sent on when
// it differs.
export function startHomeWidget({ live, episode, showOnAir }) {
  if (!Capacitor.isNativePlatform()) return;
  let last = "";
  const report = () => {
    const now = widgetNowPlaying(live.getSnapshot(), episode.current(), showOnAir());
    const key = JSON.stringify(now);
    if (key === last) return;
    last = key;
    HomeWidget.update(now).catch(() => {}); // a build without the widget: nothing to do
  };
  live.subscribe(report);
  episode.subscribe(report);
  setInterval(report, 60000);
  report();
}
