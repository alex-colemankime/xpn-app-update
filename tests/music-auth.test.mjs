import { test } from "node:test";
import assert from "node:assert/strict";
const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  },
  addEventListener() {},
  location: { origin: "https://app.test", pathname: "/" },
};
const { SERVICES, forgetAuth } = await import("../music-services.js");

test("a delayed token response does not undo Disconnect", async () => {
  memory.set("xpn.music.pkce", JSON.stringify({ state: "s", verifier: "v" }));
  let complete;
  globalThis.fetch = () => new Promise((resolve) => (complete = resolve));
  const pending = SERVICES.spotify.finish("https://app.test/?state=s&code=c");
  forgetAuth();
  complete(new Response(JSON.stringify({ access_token: "old", refresh_token: "old-refresh" })));
  await pending.catch(() => {});
  assert.equal(JSON.parse(memory.get("xpn.music.auth")), null);
});

test("Disconnect also invalidates a pending Spotify return", async () => {
  memory.set("xpn.music.pkce", JSON.stringify({ state: "s", verifier: "v" }));
  forgetAuth();
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: "unexpected" }));
  assert.equal(await SERVICES.spotify.finish("https://app.test/?state=s&code=c"), false);
});

test("a late Spotify 401 cannot restore the credentials needed for a refresh", async () => {
  memory.set(
    "xpn.music.auth",
    JSON.stringify({
      service: "spotify",
      access: "old",
      refresh: "old-refresh",
      expires: Date.now() + 3600e3,
    }),
  );
  let complete;
  globalThis.fetch = () => new Promise((resolve) => (complete = resolve));
  const pending = SERVICES.spotify.find({ artist: "A", title: "Song" });
  forgetAuth();
  complete(new Response("{}", { status: 401 }));
  await assert.rejects(pending);
  assert.equal(JSON.parse(memory.get("xpn.music.auth")), null);
});

test("a late Apple authorization cannot save credentials after Disconnect", async () => {
  let complete, started;
  const authorizing = new Promise((resolve) => (started = resolve));
  globalThis.window.MusicKit = {
    configure: async () => {},
    getInstance: () => ({
      authorize: () => {
        started();
        return new Promise((resolve) => (complete = resolve));
      },
    }),
  };
  const pending = SERVICES.apple.connect();
  await authorizing;
  forgetAuth();
  complete("old-user-token");
  await assert.rejects(pending);
  assert.equal(JSON.parse(memory.get("xpn.music.auth")), null);
});

test("a delayed Apple storefront lookup cannot restore an old account", async () => {
  memory.set(
    "xpn.music.auth",
    JSON.stringify({ service: "apple", userToken: "user", developerToken: "developer" }),
  );
  let complete;
  globalThis.fetch = () => new Promise((resolve) => (complete = resolve));
  const pending = SERVICES.apple.find({ artist: "A", title: "Song" });
  forgetAuth();
  complete(new Response(JSON.stringify({ data: [{ id: "us" }] })));
  await assert.rejects(pending);
  assert.equal(JSON.parse(memory.get("xpn.music.auth")), null);
});
