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

// The audio archive (archive.js): podcast feeds whose episodes listeners can
// play on demand, as "show=feed URL" pairs separated by commas, where show
// is a show id from shows.json. Default: World Cafe's NPR podcast. "off"
// removes the Archive tab.
export const DEFAULT_ARCHIVE_FEEDS = "worldcafe=https://feeds.npr.org/510008/podcast.xml";
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
// Where the World Cafe podcast lives, for when the archive can't load.
export const ARCHIVE_HOME =
  "https://www.npr.org/podcasts/510008/world-cafe-words-and-music-from-wxpn";
