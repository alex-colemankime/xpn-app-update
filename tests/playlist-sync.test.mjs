import { test } from "node:test";
import assert from "node:assert/strict";

// A minimal localStorage, so the stores behave as in the app.
const memory = new Map([["xpn.playlistSync", JSON.stringify({ service: "spotify" })]]);
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
};

const { songId, toggleFavorite, getSavedSongs } = await import("../favorites.js");
const { syncPlan, syncNow, usePlaylistSync } = await import("../playlist-sync.js");
const { SERVICES, plainTitle, leadArtist, sameSong } = await import("../music-services.js");
const { connect } = await import("../playlist-sync.js");
void usePlaylistSync;

test("station titles and artists are simplified for the second search", () => {
  assert.equal(plainTitle("Rein Me In (ft. Olivia Dean)"), "Rein Me In");
  assert.equal(plainTitle("Heroes - 2017 Remaster"), "Heroes");
  assert.equal(plainTitle("Lost Boys (Live at the Fillmore)"), "Lost Boys");
  assert.equal(plainTitle("Good Times // End Times"), "Good Times // End Times");
  // The ways the services mark another version of the same recording.
  assert.equal(plainTitle("Gimme Shelter (2019 Remaster)"), "Gimme Shelter");
  assert.equal(plainTitle("Here Comes The Sun (2019 Mix)"), "Here Comes The Sun");
  assert.equal(plainTitle("Waterloo Sunset - Mono"), "Waterloo Sunset");
  assert.equal(plainTitle("Wichita Lineman - Single Version"), "Wichita Lineman");
  assert.equal(plainTitle("Hard to Say (Mono Version)"), "Hard to Say");
  // Words that are part of a title, and remixes, stay.
  assert.equal(plainTitle("Mixed Up Confusion"), "Mixed Up Confusion");
  assert.equal(plainTitle("With or Without You"), "With or Without You");
  assert.equal(plainTitle("Live Forever"), "Live Forever");
  assert.equal(plainTitle("Electric Feel (Justice Remix)"), "Electric Feel (Justice Remix)");
  assert.equal(
    plainTitle("Get Lucky (Daft Punk Remix - Radio Edit)"),
    "Get Lucky (Daft Punk Remix - Radio Edit)",
  );
  assert.equal(plainTitle("Blue Monday (Extended Mix)"), "Blue Monday (Extended Mix)");
  assert.equal(plainTitle("Song - X Remix / Radio Edit"), "Song - X Remix / Radio Edit");
  assert.equal(leadArtist("Prince & The Revolution"), "Prince");
  assert.equal(leadArtist("Kyle Dixon, Michael Stein"), "Kyle Dixon");
  assert.equal(leadArtist("Bright Eyes"), "Bright Eyes");
});

test("a catalog track matches only the same title by the same lead artist", () => {
  const song = { title: "First Day Of My Life", artist: "Bright Eyes" };
  assert.ok(sameSong(song, { title: "First Day of My Life", artists: ["Bright Eyes"] }));
  assert.ok(
    sameSong(song, { title: "First Day of My Life - 2005 Remaster", artists: ["Bright Eyes"] }),
  );
  assert.ok(
    sameSong(
      { title: "Rein Me In (ft. Olivia Dean)", artist: "Sam Fender & Olivia Dean" },
      {
        title: "Rein Me In (with Olivia Dean)",
        artists: ["Sam Fender", "Olivia Dean"],
      },
    ),
  );
  assert.ok(
    sameSong(
      { title: "Heroes", artist: "The National" },
      { title: "Heroes", artists: ["National"] },
    ),
  );
  assert.ok(!sameSong(song, { title: "First Day of My Life", artists: ["A Cover Band"] }));
  assert.ok(!sameSong(song, { title: "Lua", artists: ["Bright Eyes"] }));
  assert.ok(!sameSong({ title: "", artist: "" }, { title: "", artists: [""] }));
});

test("a run adds new saves, removes unsaved songs, and skips known misses", () => {
  const saved = [
    { title: "Lost Boys", artist: "Phoebe Bridgers" },
    { title: "First Day of My Life", artist: "Bright Eyes" },
    { title: "Obscure B-side", artist: "Nobody" },
  ];
  const state = {
    matched: {
      [songId(saved[1])]: "uri:bright",
      [songId({ title: "Old", artist: "Gone" })]: "uri:old",
    },
    missing: [songId(saved[2]), songId({ title: "Also gone", artist: "X" })],
  };
  const plan = syncPlan(saved, state, true);
  assert.deepEqual(
    plan.toFind.map((s) => s.title),
    ["Lost Boys"],
  );
  assert.deepEqual(plan.toRemove, [songId({ title: "Old", artist: "Gone" })]);
  assert.deepEqual(plan.missing, [songId(saved[2])], "misses are forgotten once unsaved");
  assert.deepEqual(syncPlan(saved, state, false).toRemove, [], "Apple Music cannot remove");
});

test("syncing keeps the playlist in step with saves, against a fake service", async () => {
  const calls = [];
  const fake = {
    available: () => true,
    account: async () => "listener-1",
    owns: async () => true,
    ensurePlaylist: async (s) =>
      s.playlistId ? s : { playlistId: "pl1", playlistUrl: "https://open.spotify.test/pl1" },
    find: async (song) => (song.title === "Missing" ? null : `uri:${song.title}`),
    add: async (id, refs) => calls.push(["add", id, refs]),
    remove: async (id, refs) => calls.push(["remove", id, refs]),
  };
  Object.assign(SERVICES.spotify, fake);

  toggleFavorite("songs", { title: "Lost Boys", artist: "Phoebe Bridgers" });
  toggleFavorite("songs", { title: "Missing", artist: "Nobody" });
  await syncNow();
  assert.deepEqual(calls.at(-1), ["add", "pl1", ["uri:Lost Boys"]]);
  let state = JSON.parse(memory.get("xpn.playlistSync"));
  assert.equal(state.missing.length, 1);
  assert.equal(state.status, "idle");

  await syncNow();
  assert.equal(calls.length, 1, "nothing new, nothing sent");

  toggleFavorite("songs", { title: "Lost Boys", artist: "Phoebe Bridgers" });
  await syncNow();
  assert.deepEqual(calls.at(-1), ["remove", "pl1", ["uri:Lost Boys"]]);
  state = JSON.parse(memory.get("xpn.playlistSync"));
  assert.deepEqual(state.matched, {});
});

// A fake service whose calls are recorded, and which can be told to fail or
// to wait.
function fakeService(overrides = {}) {
  const calls = [];
  return {
    calls,
    available: () => true,
    account: async () => "listener-1",
    owns: async () => true,
    ensurePlaylist: async (s) => (s.playlistId ? s : { playlistId: "pl-new", playlistUrl: "" }),
    find: async (song) => `uri:${song.title}`,
    add: async (id, refs) => calls.push(["add", id, refs]),
    remove: async (id, refs) => calls.push(["remove", id, refs]),
    ...overrides,
  };
}
const clearSongs = () => getSavedSongs().forEach((s) => toggleFavorite("songs", s));
const syncState = () => JSON.parse(memory.get("xpn.playlistSync"));

test("a failed removal never makes the next run add the same songs again", async () => {
  clearSongs();
  await syncNow();
  let failRemove = true;
  const svc = fakeService({
    remove: async (id, refs) => {
      svc.calls.push(["remove", id, refs]);
      if (failRemove) throw new Error("network");
    },
  });
  Object.assign(SERVICES.spotify, svc);
  toggleFavorite("songs", { title: "Keep", artist: "A" });
  toggleFavorite("songs", { title: "Drop", artist: "B" });
  await syncNow();
  toggleFavorite("songs", { title: "Drop", artist: "B" });
  toggleFavorite("songs", { title: "New", artist: "C" });
  await syncNow(); // adds New, then the removal of Drop fails
  failRemove = false;
  await syncNow();
  const adds = svc.calls.filter((c) => c[0] === "add").flatMap((c) => c[2]);
  assert.equal(adds.filter((r) => r === "uri:New").length, 1, "New added once");
  assert.ok(!syncState().matched[songId({ title: "Drop", artist: "B" })], "Drop removed on retry");
  assert.equal(syncState().status, "idle");
});

test("where songs can't be removed, saving one again doesn't add a second copy", async () => {
  clearSongs();
  const svc = fakeService({ remove: null });
  Object.assign(SERVICES.spotify, svc);
  await syncNow();
  const song = { title: "Twice", artist: "Apple" };
  toggleFavorite("songs", song);
  await syncNow();
  toggleFavorite("songs", song); // unsave: stays in the playlist
  await syncNow();
  toggleFavorite("songs", song); // save again
  await syncNow();
  const adds = svc.calls.filter((c) => c[0] === "add").flatMap((c) => c[2]);
  assert.deepEqual(
    adds.filter((r) => r === "uri:Twice"),
    ["uri:Twice"],
  );
});

test("reconnecting the same service keeps its playlist; a run from an old connection writes nothing", async () => {
  clearSongs();
  const { connect, disconnect } = await import("../playlist-sync.js");
  await syncNow();
  const before = syncState();
  assert.ok(before.playlistId, "has a playlist");
  Object.assign(SERVICES.spotify, { connect: async () => "redirect" });
  await connect("spotify");
  assert.equal(syncState().playlistId, before.playlistId, "same playlist after reconnect");
  assert.deepEqual(syncState().matched, before.matched);

  // A slow add from the old connection resolves after the listener switched.
  let release;
  Object.assign(SERVICES.spotify, fakeService({ add: () => new Promise((r) => (release = r)) }));
  toggleFavorite("songs", { title: "Slow", artist: "S" });
  const pending = syncNow();
  await new Promise((r) => setTimeout(r, 0));
  disconnect();
  release();
  await pending;
  assert.deepEqual(syncState().matched, {}, "the old run's result never lands");
  assert.equal(syncState().service, null);
});

test("while a run is under way its status reads syncing", async () => {
  let release;
  Object.assign(
    SERVICES.spotify,
    fakeService({ ensurePlaylist: (s) => new Promise((r) => (release = () => r(s))) }),
  );
  const { connect } = await import("../playlist-sync.js");
  Object.assign(SERVICES.spotify, { connect: async () => "redirect" });
  await connect("spotify");
  const pending = syncNow();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(syncState().status, "syncing", "Settings can say “Adding your songs…”");
  release();
  await pending;
  assert.equal(syncState().status, "idle");
});

test("signing in again mid-sync keeps the run's work: no song added twice", async () => {
  clearSongs();
  const { connect } = await import("../playlist-sync.js");
  Object.assign(SERVICES.spotify, fakeService(), { connect: async () => "redirect" });
  await connect("spotify");
  await syncNow();
  let release;
  const svc = fakeService({
    add: (id, refs) => {
      svc.calls.push(["add", id, refs]);
      return new Promise((r) => (release = r));
    },
    connect: async () => "redirect",
  });
  Object.assign(SERVICES.spotify, svc);
  toggleFavorite("songs", { title: "Mid", artist: "M" });
  const pending = syncNow();
  await new Promise((r) => setTimeout(r, 0));
  await connect("spotify"); // reconnect while the add is in flight
  release();
  await pending;
  await syncNow();
  const adds = svc.calls.filter((c) => c[0] === "add").flatMap((c) => c[2]);
  assert.deepEqual(adds, ["uri:Mid"], "added once");
  assert.equal(syncState().status, "idle");
});

test("a failed switch to another service goes back to the old one, not stuck syncing", async () => {
  const { connect } = await import("../playlist-sync.js");
  Object.assign(SERVICES.spotify, fakeService(), { connect: async () => "redirect" });
  await connect("spotify");
  await syncNow();
  const before = syncState();
  const apple = SERVICES.apple;
  const saved = { available: apple.available, connect: apple.connect };
  Object.assign(apple, {
    available: () => true,
    connect: async () => {
      throw new Error("cancelled");
    },
  });
  await connect("apple");
  Object.assign(apple, saved);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(syncState().service, "spotify");
  assert.equal(syncState().playlistId, before.playlistId);
  assert.notEqual(syncState().status, "syncing");
});

test("title variants share one remote track until the last favorite is removed", async () => {
  const { connect, disconnect } = await import("../playlist-sync.js");
  disconnect();
  clearSongs();
  const remote = [];
  Object.assign(
    SERVICES.spotify,
    fakeService({
      connect: async () => "redirect",
      find: async () => "uri:shared-track",
      add: async (_, refs) => remote.push(...refs),
      remove: async (_, refs) => {
        for (const ref of refs) {
          const index = remote.indexOf(ref);
          if (index >= 0) remote.splice(index, 1);
        }
      },
    }),
  );
  await connect("spotify");
  const original = { artist: "Artist", title: "Song" };
  const variant = { artist: "Artist", title: "Song (Radio Edit)" };
  toggleFavorite("songs", original);
  toggleFavorite("songs", variant);
  await syncNow();
  assert.deepEqual(remote, ["uri:shared-track"], "one catalog entry for both favorites");
  toggleFavorite("songs", original);
  await syncNow();
  assert.deepEqual(remote, ["uri:shared-track"], "the remaining favorite still owns this entry");
  toggleFavorite("songs", variant);
  await syncNow();
  assert.deepEqual(remote, [], "only removed once no favorite references it");
});

test("more than 60 saved songs keep newest-first order across sync batches", async (t) => {
  const { connect, disconnect } = await import("../playlist-sync.js");
  disconnect();
  clearSongs();
  const remote = [];
  Object.assign(
    SERVICES.spotify,
    fakeService({
      connect: async () => "redirect",
      prepends: true,
      add: async (_, refs) => remote.unshift(...refs),
    }),
  );
  await connect("spotify");
  let savedAt = 1000;
  t.mock.method(Date, "now", () => savedAt++);
  for (let i = 1; i <= 65; i++) toggleFavorite("songs", { artist: "Artist", title: `Track ${i}` });
  const expected = getSavedSongs().map((song) => `uri:${song.title}`);
  await syncNow();
  await syncNow();
  assert.deepEqual(remote, expected);
});

test("signing in again as someone else starts their own playlist", async () => {
  clearSongs();
  await syncNow();
  let signedIn = "listener-a";
  let made = 0;
  const owner = new Map();
  const svc = fakeService({
    account: async () => signedIn,
    owns: async (id, account) => owner.get(id) === account,
    ensurePlaylist: async (s) => {
      if (s.playlistId) return s;
      const playlistId = `pl-${++made}`;
      owner.set(playlistId, signedIn);
      return { playlistId, playlistUrl: "" };
    },
    connect: async () => "connected",
  });
  Object.assign(SERVICES.spotify, svc);

  await connect("spotify");
  toggleFavorite("songs", { title: "Lost Boys", artist: "Phoebe Bridgers" });
  await syncNow();
  assert.equal(syncState().account, "listener-a");
  assert.equal(
    syncState().playlistId,
    "pl-1",
    "the earlier playlist wasn't A's, so A has a new one",
  );
  assert.deepEqual(svc.calls.at(-1), ["add", "pl-1", ["uri:Lost Boys"]]);

  signedIn = "listener-b";
  await connect("spotify");
  await syncNow();
  assert.equal(syncState().account, "listener-b");
  assert.equal(syncState().playlistId, "pl-2", "B gets a playlist of their own");
  assert.deepEqual(svc.calls.at(-1), ["add", "pl-2", ["uri:Lost Boys"]], "B's gets the songs too");

  // B signs in again: same account, same playlist, nothing added twice.
  const sent = svc.calls.length;
  await connect("spotify");
  await syncNow();
  assert.equal(syncState().playlistId, "pl-2");
  assert.equal(svc.calls.length, sent);
});

test("the station's playlist-sync switch stops a connected sync from running", async () => {
  const { applySwitches } = await import("../features.js");
  const calls = [];
  Object.assign(SERVICES.spotify, {
    available: () => true,
    account: async () => "listener-1",
    owns: async () => true,
    ensurePlaylist: async (s) => (calls.push("ensure"), s.playlistId ? s : { playlistId: "pl9" }),
    find: async (song) => (calls.push("find"), `uri:${song.title}`),
    add: async () => calls.push("add"),
    remove: async () => calls.push("remove"),
  });
  applySwitches(["playlistSync"]);
  toggleFavorite("songs", { title: "Switched Off", artist: "Nobody" });
  await syncNow();
  assert.deepEqual(calls, [], "no request reaches the service while it's off");
  applySwitches([]);
  await syncNow();
  assert.ok(calls.includes("add"), "back on, it catches up");
});

test("switching playlist sync off mid-run stops it before its next request", async () => {
  const { applySwitches } = await import("../features.js");
  const calls = [];
  let release;
  const searching = new Promise((r) => (release = r));
  Object.assign(SERVICES.spotify, {
    available: () => true,
    account: async () => "listener-1",
    owns: async () => true,
    ensurePlaylist: async (s) => (s.playlistId ? s : { playlistId: "pl9" }),
    find: async (song) => (await searching, `uri:${song.title}`),
    add: async () => calls.push("add"),
    remove: async () => calls.push("remove"),
  });
  applySwitches([]);
  toggleFavorite("songs", { title: "Mid Run", artist: "Somebody" });
  const run = syncNow();
  await new Promise((r) => setTimeout(r, 5)); // the run is waiting on its search
  applySwitches(["playlistSync"]);
  release();
  await run;
  assert.deepEqual(calls, [], "nothing added after it was switched off");
  applySwitches([]);
});

test("switched off while a song is being added, it's still recorded: no second copy", async () => {
  const { applySwitches } = await import("../features.js");
  const added = [];
  let release;
  const adding = new Promise((r) => (release = r));
  Object.assign(SERVICES.spotify, {
    available: () => true,
    account: async () => "listener-1",
    owns: async () => true,
    ensurePlaylist: async (s) => (s.playlistId ? s : { playlistId: "pl9" }),
    find: async (song) => `uri:${song.title}`,
    add: async (id, refs) => (added.push(...refs), await adding),
    remove: async () => {},
  });
  applySwitches([]);
  toggleFavorite("songs", { title: "In Flight", artist: "Somebody" });
  const run = syncNow();
  await new Promise((r) => setTimeout(r, 5)); // the add is under way
  applySwitches(["playlistSync"]);
  release();
  await run;
  applySwitches([]);
  await syncNow();
  assert.equal(added.filter((r) => r === "uri:In Flight").length, 1, "added once");
});
