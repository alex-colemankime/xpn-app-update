import { test } from "node:test";
import assert from "node:assert/strict";

// Spotify's Web API as changed in February 2026 (required for new apps and
// apps in Development Mode). These pin the real request URLs and bodies.
const memory = new Map([
  [
    "xpn.music.auth",
    JSON.stringify({ service: "spotify", access: "tok", expires: Date.now() + 3600e3 }),
  ],
]);
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
  location: { origin: "https://app.test", pathname: "/" },
};
const requests = [];
let reply = () => new Response(JSON.stringify({}), { status: 200 });
globalThis.fetch = async (url, init = {}) => {
  requests.push({
    url: String(url),
    method: init.method || "GET",
    body: init.body ? JSON.parse(init.body) : null,
  });
  return reply(url, init);
};
const { SERVICES, NotAllowedError, AuthError, isSpotifyReturn } =
  await import("../music-services.js");
const spotify = SERVICES.spotify;

test("the playlist is created at /me/playlists, private", async () => {
  reply = () =>
    new Response(
      JSON.stringify({
        id: "pl1",
        external_urls: { spotify: "https://open.spotify.com/playlist/pl1" },
      }),
      {
        status: 201,
      },
    );
  requests.length = 0;
  const made = await spotify.ensurePlaylist({ playlistId: "", playlistUrl: "" });
  assert.deepEqual(made, {
    playlistId: "pl1",
    playlistUrl: "https://open.spotify.com/playlist/pl1",
  });
  assert.equal(requests.length, 1, "no /me lookup first");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].url, "https://api.spotify.com/v1/me/playlists");
  assert.equal(requests[0].body.public, false);
  assert.equal(requests[0].body.name, "WXPN Favorites");
});

test("songs are added and removed through /playlists/{id}/items", async () => {
  reply = () => new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
  requests.length = 0;
  await spotify.add("pl1", ["spotify:track:a", "spotify:track:b"]);
  await spotify.remove("pl1", ["spotify:track:a"]);
  assert.deepEqual(requests[0], {
    url: "https://api.spotify.com/v1/playlists/pl1/items",
    method: "POST",
    body: { uris: ["spotify:track:a", "spotify:track:b"], position: 0 },
  });
  assert.deepEqual(requests[1], {
    url: "https://api.spotify.com/v1/playlists/pl1/items",
    method: "DELETE",
    body: { items: [{ uri: "spotify:track:a" }] },
  });
  assert.ok(requests.every((r) => !r.url.includes("/tracks") && !r.url.includes("/users/")));
});

test("search stays within the new limit of 10", async () => {
  reply = () =>
    new Response(JSON.stringify({ tracks: { items: [{ uri: "spotify:track:x" }] } }), {
      status: 200,
    });
  requests.length = 0;
  assert.equal(
    await spotify.find({ title: "Lost Boys", artist: "Phoebe Bridgers" }),
    "spotify:track:x",
  );
  assert.ok(Number(new URL(requests[0].url).searchParams.get("limit")) <= 10);
});

test("403 means this account isn't allowed (Development Mode), not signed out", async () => {
  reply = () => new Response("{}", { status: 403 });
  await assert.rejects(spotify.add("pl1", ["spotify:track:a"]), NotAllowedError);
  reply = () => new Response("{}", { status: 401 });
  memory.set(
    "xpn.music.auth",
    JSON.stringify({ service: "spotify", access: "tok", expires: Date.now() + 3600e3 }),
  );
  await assert.rejects(spotify.add("pl1", ["spotify:track:a"]), AuthError);
});

test("only a sign-in the app is waiting for counts as Spotify's return", () => {
  memory.delete("xpn.music.pkce");
  assert.equal(isSpotifyReturn("https://app.test/?code=abc&state=xyz"), false, "nothing pending");
  memory.set("xpn.music.pkce", JSON.stringify({ verifier: "v", state: "xyz" }));
  assert.equal(isSpotifyReturn("https://app.test/?code=abc&state=other"), false, "wrong state");
  assert.equal(isSpotifyReturn("https://app.test/?code=abc&state=xyz"), true);
  assert.equal(isSpotifyReturn("org.xpn.wxpn://spotify-callback?code=abc&state=xyz"), true);
  assert.equal(
    isSpotifyReturn("org.xpn.wxpn://spotify-callback?code=old&state=stale"),
    false,
    "an old return from an earlier sign-in doesn't count",
  );
});

test("a multi-request addition preserves the caller's order", async () => {
  memory.set(
    "xpn.music.auth",
    JSON.stringify({ service: "spotify", access: "tok", expires: Date.now() + 3600e3 }),
  );
  const remote = [];
  reply = (_, init) => {
    const body = JSON.parse(init.body);
    remote.splice(body.position, 0, ...body.uris);
    return new Response(JSON.stringify({ snapshot_id: "s" }));
  };
  const refs = Array.from({ length: 125 }, (_, i) => `spotify:track:${i}`);
  await spotify.add("pl1", refs);
  assert.deepEqual(remote, refs);
});
