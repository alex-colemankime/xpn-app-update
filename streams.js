// The station's live mounts. Plain HTTPS MP3 from StreamGuys, so one <audio>
// element plays them everywhere with no HLS library. Each station has a
// backup: the mount xpn.org's own web player uses. A failed connection tries
// the other URL (player-core.js). All six answered with live audio/mpeg on
// 2026-10-05. `songFeed` marks a station that publishes what it plays.
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
    songFeed: true,
  },
  xpn2: {
    id: "xpn2",
    label: "XPN2",
    tagline: "XPoNential Radio",
    mark: "xpn2",
    shortMark: "xpn2",
    url: "https://wxpnhi.xpn.org/xpn2mp3hi",
    backupUrl: "https://wxpn.xpn.org/xpn2mp3hi",
    songFeed: true,
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
    songFeed: false,
  },
};

export const STREAM_IDS = Object.keys(STREAMS);
