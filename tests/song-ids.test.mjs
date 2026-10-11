// Moving to song ids that keep artist and title apart (favorites.js): what
// was saved, and what the playlist sync recorded, under the old ids carries
// over, and two songs the old ids ran together can both be saved.
import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map([
  [
    "xpn.favorites.v1",
    JSON.stringify({
      songs: { "a-b-c": { title: "C", artist: "A-B", savedAt: 1 } },
    }),
  ],
  [
    "xpn.playlistSync",
    JSON.stringify({
      service: "apple",
      playlistId: "p1",
      verified: true,
      matched: { "a-b-c": "track:1" },
      missing: ["gone-x"],
    }),
  ],
]);
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
};

const { getFavorite, getSavedSongs, songId, toggleFavorite } = await import("../favorites.js");
const { migrateSongIds } = await import("../playlist-sync.js");
const stored = (key) => JSON.parse(memory.get(key));

test("a song saved under the old id is kept, under its new one", () => {
  const ab = { title: "C", artist: "A-B" };
  assert.equal(getFavorite("songs", ab)?.id, songId(ab));
  assert.deepEqual(Object.keys(stored("xpn.favorites.v1").songs), [songId(ab)], "and so stored");
});

test("the playlist's record moves to the new id, so the song isn't looked up or taken out", () => {
  const sync = stored("xpn.playlistSync");
  assert.deepEqual(sync.matched, { [songId({ title: "C", artist: "A-B" })]: "track:1" });
  assert.deepEqual(sync.missing, ["gone-x"], "an id with no saved song stays as it was");
  const moved = migrateSongIds(sync, getSavedSongs());
  assert.equal(moved, sync, "already moved: left alone");
});

test("the two songs the old id ran together can both be saved", () => {
  toggleFavorite("songs", { title: "B-C", artist: "A" });
  assert.ok(getFavorite("songs", { title: "C", artist: "A-B" }), "the first is still saved");
  assert.ok(getFavorite("songs", { title: "B-C", artist: "A" }), "beside the second");
});
