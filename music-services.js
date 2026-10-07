// Spotify and Apple Music, for keeping a "WXPN Favorites" playlist in step
// with the songs a listener saves (playlist-sync.js does the keeping). Both
// work without a server of our own:
//   - Spotify: OAuth with PKCE, so the app needs only a public client ID.
//   - Apple Music: MusicKit JS, with a developer token from the station.
// Spotify requests follow the Web API as changed in February 2026 (playlists
// are created at /me/playlists and edited at /playlists/{id}/items), which is
// what new apps and apps in Development Mode must use.
// Each service exposes the same small interface:
//   connect()            start signing in (may leave the page and come back)
//   account()            who is signed in (an id), or "" where the service
//                        won't say (Apple Music)
//   owns(id, account)    whether that playlist is this account's
//   ensurePlaylist(s)    { playlistId, playlistUrl }, creating it if needed
//   find(song)           the service's track reference, or null
//   add(id, refs)        add tracks, newest first
//   remove(id, refs)     remove tracks (null where the service cannot)

import { Capacitor } from "@capacitor/core";
import { APPLE_MUSIC_DEVELOPER_TOKEN, APPLE_MUSIC_TOKEN_URL, SPOTIFY_CLIENT_ID } from "./config.js";
import { readJson, writeJson } from "./storage.js";
import { withTimeout } from "./net.js";

export const PLAYLIST_NAME = "WXPN Favorites";
const PLAYLIST_DESCRIPTION =
  "Songs you saved in the WXPN app. Listener-supported radio from Philadelphia.";
const AUTH_KEY = "xpn.music.auth";
const PKCE_KEY = "xpn.music.pkce";
const NATIVE_REDIRECT = "org.xpn.wxpn://spotify-callback";

export class AuthError extends Error {}
// The service answered but will not let this account use the app: Spotify
// apps in Development Mode work only for up to 5 listeners the station has
// allowlisted. Signing in again cannot fix that, so it is not an AuthError.
export class NotAllowedError extends Error {}

// --- Search terms -----------------------------------------------------------

// Station playlists carry featured artists, live tags and remaster notes the
// services file differently, so a second, plainer search follows the exact one.
// Words that mark a version of the same song rather than a different one:
// "(2019 Remaster)", "(feat. X)", "- Mono", "- Single Version", "(Live)".
// A remix, a club or extended mix, or an instrumental stays a different
// recording, whatever else its suffix says.
const VERSION =
  "feat\\.?|ft\\.?|featuring|with|live|remaster(?:ed)?|mix|mono|stereo|version|edit|demo|acoustic";
const BRACKETED = new RegExp(`\\s*[([][^)\\]]*\\b(?:${VERSION})(?:\\b|\\s|$)[^)\\]]*[)\\]]`, "gi");
// A dashed suffix runs to the end of the title, outside any brackets.
const DASHED = new RegExp(`\\s+[-–—]\\s+[^-–—)\\]]*\\b(?:${VERSION})(?:\\b|\\s|$)[^)\\]]*$`, "i");
const DIFFERENT = /\b(?:re-?mix|rmx|extended|club|dub|dance|instrumental|a ?cappella|karaoke)\b/i;
const unlessDifferent = (part) => (DIFFERENT.test(part) ? part : "");
export function plainTitle(title) {
  return String(title || "")
    .replace(BRACKETED, unlessDifferent)
    .replace(DASHED, unlessDifferent)
    .trim();
}
export function leadArtist(artist) {
  return String(artist || "")
    .split(/\s+(?:&|and|feat\.?|ft\.?|featuring|with|x)\s+|,\s*/i)[0]
    .trim();
}

// --- Matching ---------------------------------------------------------------

// For comparing names: lower case, accents and punctuation gone, "&" read as
// "and", a leading "The" dropped.
const fold = (text) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");

// Whether a catalog track is the song the station played: the same title
// (versions and featured artists aside) by the same lead artist. A near miss
// stays unmatched rather than putting the wrong song in someone's playlist.
export function sameSong(song, { title, artists = [] }) {
  const wanted = fold(plainTitle(song.title));
  if (!wanted || fold(plainTitle(title)) !== wanted) return false;
  const lead = fold(leadArtist(song.artist));
  return (
    Boolean(lead) && artists.some((name) => fold(name) === lead || fold(leadArtist(name)) === lead)
  );
}

// --- Spotify ----------------------------------------------------------------

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const SPOTIFY_SCOPES = "playlist-modify-private playlist-modify-public";

const isNative = () => Capacitor.isNativePlatform();
const webRedirect = () => `${window.location.origin}${window.location.pathname}`;
const redirectUri = () => (isNative() ? NATIVE_REDIRECT : webRedirect());

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const auth = () => readJson(AUTH_KEY, null);
const saveAuth = (value) => writeJson(AUTH_KEY, value);
let authorization = 0;
export function cancelAuthorization() {
  authorization++;
  writeJson(PKCE_KEY, null);
}
const assertAuthorization = (attempt) => {
  if (attempt !== authorization) throw new AuthError("Sign-in was cancelled");
};
export function forgetAuth() {
  cancelAuthorization();
  saveAuth(null);
}

async function tokenRequest(params) {
  const attempt = authorization;
  const previous = auth();
  const response = await fetch(SPOTIFY_TOKEN, {
    signal: withTimeout(),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...params }),
  });
  if (!response.ok) throw new AuthError("Spotify sign-in failed");
  const json = await response.json();
  assertAuthorization(attempt);
  saveAuth({
    service: "spotify",
    access: json.access_token,
    refresh:
      json.refresh_token || (params.grant_type === "refresh_token" ? previous?.refresh : undefined),
    expires: Date.now() + (json.expires_in || 3600) * 1000,
  });
}

async function spotifyFetch(path, options = {}, retried = false) {
  const attempt = authorization;
  let a = auth();
  if (a?.service !== "spotify" || !a.access) throw new AuthError("Not signed in to Spotify");
  if (a.expires < Date.now() + 60000) {
    if (!a.refresh) throw new AuthError("Spotify session ended");
    await tokenRequest({ grant_type: "refresh_token", refresh_token: a.refresh });
    a = auth();
  }
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    ...options,
    signal: withTimeout(options.signal),
    headers: { Authorization: `Bearer ${a.access}`, "Content-Type": "application/json" },
  });
  if (response.status === 401 && !retried && a.refresh) {
    assertAuthorization(attempt);
    saveAuth({ ...a, expires: 0 });
    return spotifyFetch(path, options, true);
  }
  if (response.status === 401) throw new AuthError("Spotify refused");
  if (response.status === 403) throw new NotAllowedError("Spotify does not allow this account");
  if (response.status === 429 && !retried) {
    const wait = Math.min(10, Number(response.headers.get("Retry-After")) || 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    assertAuthorization(attempt);
    return spotifyFetch(path, options, true);
  }
  if (response.status === 404) {
    const error = new Error("Not found");
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error(`Spotify: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

const spotify = {
  id: "spotify",
  name: "Spotify",
  prepends: true,
  available: () => Boolean(SPOTIFY_CLIENT_ID),
  async connect() {
    const attempt = authorization;
    const verifier = randomString(64);
    const state = randomString(16);
    writeJson(PKCE_KEY, { verifier, state });
    const url = `https://accounts.spotify.com/authorize?${new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri(),
      code_challenge_method: "S256",
      code_challenge: await pkceChallenge(verifier),
      scope: SPOTIFY_SCOPES,
      state,
    })}`;
    assertAuthorization(attempt);
    if (isNative()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
    } else {
      window.location.assign(url);
    }
    return "redirect";
  },
  // Called with the URL Spotify sent the listener back to. True when signed in.
  async finish(url) {
    const params = new URL(url).searchParams;
    const pending = readJson(PKCE_KEY, null);
    if (!pending || params.get("state") !== pending.state) return false;
    writeJson(PKCE_KEY, null);
    if (!params.get("code")) return false;
    await tokenRequest({
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
    });
    return true;
  },
  async account() {
    return (await spotifyFetch("/me"))?.id || "";
  },
  async owns(playlistId, account) {
    try {
      const playlist = await spotifyFetch(
        `/playlists/${encodeURIComponent(playlistId)}?fields=owner(id)`,
      );
      return Boolean(account) && playlist?.owner?.id === account;
    } catch (error) {
      if (error?.status === 404) return false;
      throw error;
    }
  },
  async ensurePlaylist({ playlistId, playlistUrl }) {
    if (playlistId) return { playlistId, playlistUrl };
    const created = await spotifyFetch("/me/playlists", {
      method: "POST",
      body: JSON.stringify({
        name: PLAYLIST_NAME,
        description: PLAYLIST_DESCRIPTION,
        public: false,
      }),
    });
    return { playlistId: created.id, playlistUrl: created.external_urls?.spotify || "" };
  },
  async find(song) {
    const queries = [
      `track:"${song.title}" artist:"${leadArtist(song.artist)}"`,
      `${plainTitle(song.title)} ${leadArtist(song.artist)}`,
    ];
    for (const q of queries) {
      const json = await spotifyFetch(
        `/search?${new URLSearchParams({ q, type: "track", limit: "5" })}`,
      );
      const track = (json?.tracks?.items || []).find(
        (t) =>
          t?.uri &&
          sameSong(song, { title: t.name, artists: (t.artists || []).map((a) => a?.name) }),
      );
      if (track) return track.uri;
    }
    return null;
  },
  async add(playlistId, refs) {
    // Every request inserts at the front. Send the oldest chunk first so
    // a multi-request addition retains the supplied newest-first order.
    for (let end = refs.length; end > 0;) {
      const start = Math.max(0, end - 100);
      await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: "POST",
        body: JSON.stringify({ uris: refs.slice(start, end), position: 0 }),
      });
      end = start;
    }
  },
  async remove(playlistId, refs) {
    for (let i = 0; i < refs.length; i += 100) {
      await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: "DELETE",
        body: JSON.stringify({ items: refs.slice(i, i + 100).map((uri) => ({ uri })) }),
      });
    }
  },
};

// --- Apple Music --------------------------------------------------------------

const APPLE_API = "https://api.music.apple.com";
const MUSICKIT_SRC = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
let musicKitReady = null;

async function developerToken() {
  if (APPLE_MUSIC_TOKEN_URL) {
    const response = await fetch(APPLE_MUSIC_TOKEN_URL, { signal: withTimeout() });
    if (!response.ok) throw new Error("Apple Music token unavailable");
    return (await response.json()).token;
  }
  return APPLE_MUSIC_DEVELOPER_TOKEN;
}

function musicKit() {
  musicKitReady ||= (async () => {
    const token = await developerToken();
    if (!window.MusicKit) {
      await new Promise((resolve, reject) => {
        document.addEventListener("musickitloaded", resolve, { once: true });
        const script = document.createElement("script");
        script.src = MUSICKIT_SRC;
        script.async = true;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    await window.MusicKit.configure({ developerToken: token, app: { name: "WXPN", build: "1" } });
    return { kit: window.MusicKit.getInstance(), token };
  })().catch((error) => {
    musicKitReady = null;
    throw error;
  });
  return musicKitReady;
}

async function appleFetch(path, options = {}) {
  const a = auth();
  if (a?.service !== "apple" || !a.userToken || !a.developerToken)
    throw new AuthError("Not signed in to Apple Music");
  const response = await fetch(`${APPLE_API}${path}`, {
    ...options,
    signal: withTimeout(options.signal),
    headers: {
      Authorization: `Bearer ${a.developerToken}`,
      "Music-User-Token": a.userToken,
      "Content-Type": "application/json",
    },
  });
  if (response.status === 401) throw new AuthError("Apple Music refused");
  if (response.status === 403) throw new NotAllowedError("Apple Music does not allow this");
  if (response.status === 404) {
    const error = new Error("Not found");
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error(`Apple Music: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json().catch(() => null);
}

const appleMusic = {
  id: "apple",
  name: "Apple Music",
  available: () => Boolean(APPLE_MUSIC_TOKEN_URL || APPLE_MUSIC_DEVELOPER_TOKEN),
  async connect() {
    const attempt = authorization;
    const { kit, token } = await musicKit();
    assertAuthorization(attempt);
    const userToken = await kit.authorize();
    assertAuthorization(attempt);
    if (!userToken) throw new AuthError("Apple Music sign-in was cancelled");
    saveAuth({ service: "apple", userToken, developerToken: token });
    return "connected";
  },
  // Apple Music names no account; whether the playlist is in this library
  // says whether it is the same one.
  async account() {
    return "";
  },
  async owns(playlistId) {
    try {
      await appleFetch(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}`);
      return true;
    } catch (error) {
      if (error?.status === 404) return false;
      throw error;
    }
  },
  async ensurePlaylist({ playlistId, playlistUrl }) {
    if (playlistId) return { playlistId, playlistUrl };
    const json = await appleFetch("/v1/me/library/playlists", {
      method: "POST",
      body: JSON.stringify({
        attributes: { name: PLAYLIST_NAME, description: PLAYLIST_DESCRIPTION },
      }),
    });
    const id = json?.data?.[0]?.id;
    return {
      playlistId: id,
      playlistUrl: id ? `https://music.apple.com/library/playlist/${id}` : "",
    };
  },
  async find(song) {
    const attempt = authorization;
    const a = auth();
    if (a?.service !== "apple") throw new AuthError("Not signed in to Apple Music");
    if (!a.storefront) {
      const json = await appleFetch("/v1/me/storefront");
      assertAuthorization(attempt);
      saveAuth({ ...a, storefront: json?.data?.[0]?.id || "us" });
    }
    const storefront = auth().storefront;
    const term = `${plainTitle(song.title)} ${leadArtist(song.artist)}`;
    const json = await appleFetch(
      `/v1/catalog/${storefront}/search?${new URLSearchParams({ term, types: "songs", limit: "5" })}`,
    );
    const songs = json?.results?.songs?.data || [];
    const best = songs.find((s) =>
      sameSong(song, { title: s.attributes?.name, artists: [s.attributes?.artistName] }),
    );
    return best?.id || null;
  },
  async add(playlistId, refs) {
    await appleFetch(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      body: JSON.stringify({ data: refs.map((id) => ({ id, type: "songs" })) }),
    });
  },
  // Apple Music's API cannot take songs out of a library playlist.
  remove: null,
};

export const SERVICES = { spotify, apple: appleMusic };
export const availableServices = () => Object.values(SERVICES).filter((s) => s.available());

// Spotify's return trip: on the web the app reloads at its own address with
// ?code=…&state=…; in the phone apps the system hands back NATIVE_REDIRECT.
// Only a return the app is waiting for counts (its sign-in is pending and the
// state matches), so a stray link with ?code= cannot disturb anything.
export function isSpotifyReturn(url) {
  try {
    const u = new URL(url);
    const pending = readJson(PKCE_KEY, null);
    return (
      Boolean(pending?.state) &&
      u.searchParams.get("state") === pending.state &&
      (u.searchParams.has("code") || u.searchParams.has("error"))
    );
  } catch {
    return false;
  }
}
