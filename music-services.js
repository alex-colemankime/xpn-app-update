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
import { featureOn } from "./features.js";

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
// A playlist (or anything else) the service no longer has. Marked with the
// status, so the sync can tell a deleted playlist from other failures.
const notFound = () => Object.assign(new Error("Not found"), { status: 404 });

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
  // Disconnecting starts Apple Music afresh too (a new developer token).
  musicKitLoader.reset();
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
  if (response.status === 404) throw notFound();
  if (!response.ok) throw new Error(`Spotify: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

// One batch of a multi-request change. If it fails, the error carries the
// refs already sent (`done`), so what reached the playlist is still recorded.
async function sendBatch(done, path, options) {
  try {
    await spotifyFetch(path, options);
  } catch (error) {
    if (error && typeof error === "object") error.done = [...done];
    throw error;
  }
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
  // Adding and removing go 100 at a time. Before each batch `shouldContinue`
  // is asked (playlist sync switched off stops between batches); each
  // resolves to the refs it actually sent, so what was done is recorded.
  async add(playlistId, refs, { shouldContinue = () => true } = {}) {
    // Every request inserts at the front. Send the oldest chunk first so
    // a multi-request addition retains the supplied newest-first order.
    const done = [];
    for (let end = refs.length; end > 0;) {
      if (!shouldContinue()) break;
      const start = Math.max(0, end - 100);
      const batch = refs.slice(start, end);
      await sendBatch(done, `/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: "POST",
        body: JSON.stringify({ uris: batch, position: 0 }),
      });
      done.push(...batch);
      end = start;
    }
    return done;
  },
  async remove(playlistId, refs, { shouldContinue = () => true } = {}) {
    const done = [];
    for (let i = 0; i < refs.length; i += 100) {
      if (!shouldContinue()) break;
      const batch = refs.slice(i, i + 100);
      await sendBatch(done, `/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: "DELETE",
        body: JSON.stringify({ items: batch.map((uri) => ({ uri })) }),
      });
      done.push(...batch);
    }
    return done;
  },
};

// --- Apple Music --------------------------------------------------------------

const APPLE_API = "https://api.music.apple.com";
const MUSICKIT_SRC = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
// MusicKit, configured with a developer token: loaded once and kept, until
// Apple refuses the token or the listener disconnects, when it's let go so
// the next sign-in fetches a fresh token and configures MusicKit again.
// (`getToken`, `load` and `configure` are passed in so it can be tested.)
export function createMusicKitLoader({ getToken, load, configure }) {
  let ready = null;
  // A load let go while still under way: the next one waits for it to
  // settle, so two configurations never run at once.
  let previous = Promise.resolve();
  return {
    get() {
      ready ||= (async () => {
        await previous.catch(() => {});
        const token = await getToken();
        await load();
        const kit = await configure(token);
        return { kit, token };
      })().catch((error) => {
        ready = null;
        throw error;
      });
      return ready;
    },
    reset() {
      if (ready) previous = ready;
      ready = null;
    },
  };
}

async function developerToken() {
  if (APPLE_MUSIC_TOKEN_URL) {
    // Never a cached copy: after a refusal, the endpoint's current token.
    const response = await fetch(APPLE_MUSIC_TOKEN_URL, {
      cache: "no-store",
      signal: withTimeout(),
    });
    if (!response.ok) throw new Error("Apple Music token unavailable");
    return (await response.json()).token;
  }
  return APPLE_MUSIC_DEVELOPER_TOKEN;
}

const musicKitLoader = createMusicKitLoader({
  getToken: developerToken,
  load: async () => {
    if (window.MusicKit) return;
    await new Promise((resolve, reject) => {
      document.addEventListener("musickitloaded", resolve, { once: true });
      const script = document.createElement("script");
      script.src = MUSICKIT_SRC;
      script.async = true;
      script.onerror = reject;
      document.head.append(script);
    });
  },
  configure: async (token) => {
    await window.MusicKit.configure({ developerToken: token, app: { name: "WXPN", build: "1" } });
    return window.MusicKit.getInstance();
  },
});
const musicKit = () => musicKitLoader.get();
// For the tests: the app's own loader, to see refusals and Disconnect reset it.
export const appleMusicKit = musicKitLoader;

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
  if (response.status === 401) {
    // The developer token may be what was refused: fetch it afresh next time.
    musicKitLoader.reset();
    throw new AuthError("Apple Music refused");
  }
  if (response.status === 403) throw new NotAllowedError("Apple Music does not allow this");
  if (response.status === 404) throw notFound();
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
    // One request for all of them: nothing to stop between.
    await appleFetch(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      body: JSON.stringify({ data: refs.map((id) => ({ id, type: "songs" })) }),
    });
    return refs;
  },
  // Apple Music's API cannot take songs out of a library playlist.
  remove: null,
};

export const SERVICES = { spotify, apple: appleMusic };
// Playlist sync can be turned off remotely (remote-config.js).
export const availableServices = () =>
  !featureOn("playlistSync") ? [] : Object.values(SERVICES).filter((s) => s.available());

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
