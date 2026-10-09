import { savedConfig } from "./remote-config.js";

// The station's live mounts. Plain HTTPS MP3 from StreamGuys, so one <audio>
// element plays them everywhere with no HLS library. Each station has a
// backup: the mount xpn.org's own web player uses. A failed connection tries
// the other URL (player-core.js). All six answered with live audio/mpeg on
// 2026-10-05. `songFeed` is where a station publishes what it plays: its day
// playlist (one file per Eastern date, with times) and its now-playing file
// (the song on air, with its length), the same sources xpn.org's player
// reads. Homegrown has none.
export const STREAMS = {
  xpn: {
    id: "xpn",
    label: "WXPN",
    tagline: "88.5 FM · Public Radio",
    // Lettering on the station's own artwork tiles: full and compact.
    mark: "wxpn",
    shortMark: "xpn",
    // The no-preroll mount suits app playback: reconnecting never replays an ad.
    url: "https://wxpnhi.xpn.org/xpnhi-nopreroll",
    backupUrl: "https://wxpn.xpn.org/xpnmp3hi",
    songFeed: {
      day: "https://origin.xpn.org/utils/playlist/json/",
      now: "https://origin.xpn.org/utils/nowplaying/json/xpnNowPlaying.json",
    },
  },
  xpn2: {
    id: "xpn2",
    label: "XPN2",
    tagline: "XPoNential Radio",
    mark: "xpn2",
    shortMark: "xpn2",
    url: "https://wxpnhi.xpn.org/xpn2mp3hi",
    backupUrl: "https://wxpn.xpn.org/xpn2mp3hi",
    songFeed: {
      day: "https://origin.xpn.org/xpn2/json/",
      now: "https://origin.xpn.org/xpn2/json/nowplaying/xpn2NowPlaying.json",
    },
  },
  homegrown: {
    id: "homegrown",
    label: "Homegrown",
    tagline: "Philadelphia's local music",
    mark: "homegrown",
    shortMark: "HG",
    // The former Kids Corner stream, renamed ahead of its new programming.
    url: "https://wxpnhi.xpn.org/kidscornermp3hi",
    backupUrl: "https://wxpn.xpn.org/kidscornermp3hi",
    songFeed: null,
  },
};

// The addresses as built, so a remote change can be undone by removing it.
const BUILT = Object.fromEntries(
  Object.entries(STREAMS).map(([id, s]) => [id, { url: s.url, backupUrl: s.backupUrl }]),
);

// Addresses the station has changed remotely (remote-config.js, already
// checked to be WXPN's or StreamGuys'). Applied in place, so the player
// uses them from its next connection.
export function applyStreamOverrides(overrides = {}) {
  for (const [id, stream] of Object.entries(STREAMS)) {
    Object.assign(stream, BUILT[id], overrides[id]);
  }
}
applyStreamOverrides(savedConfig().streams);

export const STREAM_IDS = Object.keys(STREAMS);

// The stations as a choice (the station tabs, the alarm's Wake up to).
export const STATION_OPTIONS = Object.values(STREAMS).map((s) => ({ value: s.id, label: s.label }));
