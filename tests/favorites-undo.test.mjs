import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
};
const { getFavorite, getSavedSongs, restoreFavorite, toggleFavorite } =
  await import("../favorites.js");

test("undoing a removal puts the song back where it was", () => {
  const a = { title: "First Day Of My Life", artist: "Bright Eyes" };
  const b = { title: "Lost Boys", artist: "Phoebe Bridgers" };
  toggleFavorite("songs", a);
  toggleFavorite("songs", b);
  const before = getFavorite("songs", a);
  toggleFavorite("songs", a); // removed
  assert.equal(getFavorite("songs", a), null);
  restoreFavorite("songs", before);
  assert.deepEqual(getFavorite("songs", a), before, "same record, same saved time");
  assert.deepEqual(
    getSavedSongs().map((s) => s.title),
    ["Lost Boys", "First Day Of My Life"],
    "its old place in the list",
  );
  restoreFavorite("songs", null); // nothing to restore
  assert.equal(getSavedSongs().length, 2);
});
