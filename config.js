// Build-time switches (see README).

// Placeholder content (sample show episodes and sample concerts) exists for
// design review only. It appears in `npm run dev` and in builds made with
// VITE_SHOW_SAMPLES=true, such as the GitHub Pages preview, and never in a
// production build of the app. vite.config.js defines __SHOW_SAMPLES__ as a
// literal, so production builds drop the samples entirely; outside Vite (unit
// tests) it is off.
export const SHOW_SAMPLES = typeof __SHOW_SAMPLES__ === "boolean" && __SHOW_SAMPLES__;

// The concert calendar: The Events Calendar's REST API on xpn.org, the same
// source as the calendar page on the website. VITE_XPN_CONCERTS_ENDPOINT
// points elsewhere, or "off" removes the Concerts tab (Settings then links
// to the calendar on xpn.org).
const concertsSetting = import.meta.env?.VITE_XPN_CONCERTS_ENDPOINT;
export const CONCERTS_ENDPOINT =
  concertsSetting === "off"
    ? ""
    : concertsSetting || "https://xpn.org/wp-json/tribe/events/v1/events";
export const CONCERTS_ENABLED = Boolean(CONCERTS_ENDPOINT);

// Station updates (a member-drive banner, a live video to watch): a small JSON
// file the station hosts and edits; see updates.js and README. Unset: none,
// except sample updates in preview builds.
export const UPDATES_URL = import.meta.env?.VITE_XPN_UPDATES_URL || "";

// The livestream page on xpn.org, read during Free at Noon so the week's
// video appears without a station update (see updates.js). "off" disables.
const livestreamSetting = import.meta.env?.VITE_XPN_LIVESTREAM_PAGE;
export const LIVESTREAM_PAGE_URL =
  livestreamSetting === "off"
    ? ""
    : livestreamSetting ||
      "https://xpn.org/wp-json/wp/v2/pages?slug=livestream&_fields=title,content,modified_gmt";

// Playlist sync for saved songs (see music-services.js). Each service appears
// only when configured:
//   VITE_SPOTIFY_CLIENT_ID             a Spotify app's client ID (no secret)
//   VITE_APPLE_MUSIC_TOKEN_URL         an endpoint that returns { token }, a
//                                      MusicKit developer token, or
//   VITE_APPLE_MUSIC_DEVELOPER_TOKEN   such a token itself (expires; prefer
//                                      the URL)
export const SPOTIFY_CLIENT_ID = import.meta.env?.VITE_SPOTIFY_CLIENT_ID || "";
export const APPLE_MUSIC_TOKEN_URL = import.meta.env?.VITE_APPLE_MUSIC_TOKEN_URL || "";
export const APPLE_MUSIC_DEVELOPER_TOKEN = import.meta.env?.VITE_APPLE_MUSIC_DEVELOPER_TOKEN || "";

// The audio archive (archive.js): where listeners' on-demand episodes come
// from, as "show=URL" pairs separated by commas, where show is a show id from
// shows.json and the URL is the show's page on xpn.org (its archive list) or
// a podcast feed. Default: every show xpn.org archives. "off" removes the
// Archive tab.
export const DEFAULT_ARCHIVE_FEEDS = [
  "sleepyhollow=https://xpn.org/program/sleepy-hollow/",
  "funky=https://xpn.org/program/funky-friday/",
  "landlost=https://xpn.org/program/land-of-the-lost/",
  "worldcafe=https://xpn.org/program/world-cafe/",
].join(",");
export function parseArchiveFeeds(setting) {
  if (setting === "off") return [];
  return String(setting || DEFAULT_ARCHIVE_FEEDS)
    .split(",")
    .map((pair) => pair.trim().split(/=(.+)/))
    .filter(([show, url]) => /^[a-z0-9-]+$/.test(show || "") && /^https:\/\//.test(url || ""))
    .map(([show, url]) => ({ show, url: url.trim() }));
}
export const ARCHIVE_FEEDS = parseArchiveFeeds(import.meta.env?.VITE_XPN_ARCHIVE_FEEDS);
export const ARCHIVE_ENABLED = ARCHIVE_FEEDS.length > 0;

// Videos (videos.js): Brightcove playlists, each a section of the Videos tab,
// read with Brightcove's Playback API and played in a Brightcove Player.
//   VITE_BRIGHTCOVE_ACCOUNT  the account the playlists live in. Default: the
//                            NPR Music Video Network, whose World Cafe and
//                            WXPN collections are livesessions.npr.org's.
//   VITE_BRIGHTCOVE_PLAYER   the account's player (its id; default "default").
//                            The app reads the player's public policy key
//                            from its config, so nothing secret is built in.
//   VITE_BRIGHTCOVE_VIDEOS   "Section name=playlist id" pairs, comma
//                            separated, in order; "off" removes the tab.
export const DEFAULT_VIDEO_SECTIONS = "World Cafe=1876180529963365406,WXPN=1874727417810648125";
export function parseVideoSections(setting) {
  if (setting === "off") return [];
  return String(setting || DEFAULT_VIDEO_SECTIONS)
    .split(",")
    .map((pair) => pair.trim().split(/=(?=\d+$)/))
    .filter(([label, id]) => label?.trim() && /^\d+$/.test(id || ""))
    .map(([label, id]) => ({ label: label.trim(), playlist: id }));
}
export const VIDEO_ACCOUNT = /^\d+$/.test(import.meta.env?.VITE_BRIGHTCOVE_ACCOUNT || "")
  ? import.meta.env.VITE_BRIGHTCOVE_ACCOUNT
  : "6416366397001";
export const VIDEO_PLAYER = /^[\w-]+$/.test(import.meta.env?.VITE_BRIGHTCOVE_PLAYER || "")
  ? import.meta.env.VITE_BRIGHTCOVE_PLAYER
  : "default";
export const VIDEO_SECTIONS = parseVideoSections(import.meta.env?.VITE_BRIGHTCOVE_VIDEOS);
export const VIDEOS_ENABLED = VIDEO_SECTIONS.length > 0;
