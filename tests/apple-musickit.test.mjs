// Apple Music's developer token (music-services.js): kept while it works,
// fetched afresh once Apple refuses it or the listener disconnects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeWindow } from "./fake-window.mjs";

const memory = fakeWindow();
const { createMusicKitLoader } = await import("../music-services.js");

test("a refused developer token is fetched again and MusicKit configured with the new one", async () => {
  let current = "token-1";
  let fetched = 0;
  const configured = [];
  const loader = createMusicKitLoader({
    getToken: async () => (fetched++, current),
    load: async () => {},
    configure: async (token) => (configured.push(token), { kit: true }),
  });
  assert.equal((await loader.get()).token, "token-1");
  assert.equal((await loader.get()).token, "token-1", "kept while it works");
  assert.equal(fetched, 1);
  // Apple rotates the token and refuses the old one; the app lets it go.
  current = "token-2";
  loader.reset();
  assert.equal((await loader.get()).token, "token-2");
  assert.equal(fetched, 2);
  assert.deepEqual(configured, ["token-1", "token-2"]);
});

test("a failed token fetch isn't kept either", async () => {
  let fail = true;
  const loader = createMusicKitLoader({
    getToken: async () => {
      if (fail) throw new Error("down");
      return "token-1";
    },
    load: async () => {},
    configure: async () => ({}),
  });
  await assert.rejects(loader.get());
  fail = false;
  assert.equal((await loader.get()).token, "token-1");
});

test("Apple refusing the token, or Disconnect, makes the next sign-in configure MusicKit afresh", async () => {
  memory.clear();
  memory.set(
    "xpn.music.auth",
    JSON.stringify({ service: "apple", userToken: "u", developerToken: "d" }),
  );
  let configures = 0;
  globalThis.window.MusicKit = {
    configure: async () => configures++,
    getInstance: () => ({}),
  };
  globalThis.fetch = async () => new Response("", { status: 401 });
  const { appleMusicKit, SERVICES, forgetAuth } = await import("../music-services.js");
  await appleMusicKit.get();
  await appleMusicKit.get();
  assert.equal(configures, 1);
  await assert.rejects(SERVICES.apple.owns("pl1")); // Apple says 401
  await appleMusicKit.get();
  assert.equal(configures, 2, "configured again after the refusal");
  forgetAuth(); // Disconnect
  await appleMusicKit.get();
  assert.equal(configures, 3, "and again after Disconnect");
});

test("a reset while MusicKit is loading doesn't start a second setup alongside it", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  let running = 0;
  let overlap = false;
  const loader = createMusicKitLoader({
    getToken: async () => "t",
    load: async () => {},
    configure: async () => {
      running++;
      if (running > 1) overlap = true;
      await gate;
      running--;
      return {};
    },
  });
  const first = loader.get();
  await new Promise((r) => setTimeout(r, 0));
  loader.reset();
  const second = loader.get();
  await new Promise((r) => setTimeout(r, 0));
  release();
  await Promise.all([first, second]);
  assert.equal(overlap, false);
});
