import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  },
  addEventListener() {},
};
const { connect, disconnect, finishConnect } = await import("../playlist-sync.js");
const { SERVICES } = await import("../music-services.js");
const state = () => JSON.parse(memory.get("xpn.playlistSync"));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
Object.assign(SERVICES.spotify, { available: () => true, connect: async () => "redirect" });

test("a failed sign-in cannot restore a connection after Disconnect", async () => {
  await connect("spotify");
  const auth = deferred();
  Object.assign(SERVICES.apple, { available: () => true, connect: () => auth.promise });
  const pending = connect("apple");
  disconnect();
  auth.reject(new Error("cancelled"));
  await pending;
  assert.equal(state().service, null);
});

test("a superseded sign-in cannot restore the previous service", async () => {
  disconnect();
  const auth = deferred();
  SERVICES.apple.connect = () => auth.promise;
  const pending = connect("apple");
  await connect("spotify");
  auth.reject(new Error("older sign-in failed"));
  await pending;
  assert.equal(state().service, "spotify");
});

test("an OAuth return completing after Disconnect cannot reconnect the app", async () => {
  await connect("spotify");
  memory.set("xpn.music.pkce", JSON.stringify({ state: "pending", verifier: "v" }));
  const auth = deferred();
  SERVICES.spotify.finish = () => auth.promise;
  const pending = finishConnect("https://app.test/?code=valid&state=pending");
  disconnect();
  auth.resolve(true);
  await pending;
  assert.equal(state().service, null);
});

test("the current OAuth return still connects and starts synchronization", async () => {
  disconnect();
  await connect("spotify");
  memory.set("xpn.music.pkce", JSON.stringify({ state: "current", verifier: "v" }));
  Object.assign(SERVICES.spotify, {
    finish: async () => true,
    account: async () => "listener",
    owns: async () => true,
    ensurePlaylist: async () => ({ playlistId: "current-playlist", playlistUrl: "" }),
  });
  await finishConnect("https://app.test/?code=valid&state=current");
  const { syncNow } = await import("../playlist-sync.js");
  await syncNow();
  assert.equal(state().service, "spotify");
  assert.equal(state().playlistId, "current-playlist");
  assert.equal(state().status, "idle");
});

test("an account check that straddles a new sign-in doesn't vouch for the new account", async () => {
  const { syncNow } = await import("../playlist-sync.js");
  disconnect();
  // Signed in to Apple Music as one listener, with a playlist on record.
  Object.assign(SERVICES.apple, {
    available: () => true,
    connect: async () => "connected",
    ensurePlaylist: async (s) => ({ playlistId: s.playlistId || "first-playlist" }),
    owns: async () => true,
  });
  let whoAsked = 0;
  const firstCheck = deferred();
  SERVICES.apple.account = () => (whoAsked++ === 0 ? firstCheck.promise : Promise.resolve("b"));
  await connect("apple");
  // The run's account check is still out when the listener signs in again.
  const reconnect = connect("apple");
  firstCheck.resolve("a");
  await reconnect;
  await syncNow();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state().account, "b", "the account is the one signed in now");
  assert.ok(whoAsked >= 2, "the new sign-in's account was checked");
});
