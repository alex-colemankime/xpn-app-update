import { test } from "node:test";
import assert from "node:assert/strict";
import { knownLength, normalizeLengths, rememberLength, requestLength } from "../episode-length.js";

test("kept lengths drop anything damaged", () => {
  assert.deepEqual(normalizeLengths(null), {});
  assert.deepEqual(normalizeLengths([1, 2]), {});
  assert.deepEqual(normalizeLengths({ a: 3600, b: "60", c: -1, d: 0, e: Infinity }), { a: 3600 });
});

test("kept lengths are capped, oldest first out", () => {
  const many = Object.fromEntries(Array.from({ length: 450 }, (_, i) => [`e${i}`, 60]));
  const kept = normalizeLengths(many);
  assert.equal(Object.keys(kept).length, 400);
  assert.equal(kept.e0, undefined);
  assert.equal(kept.e449, 60);
});

test("a length a file reported is remembered by episode, in whole seconds", () => {
  assert.equal(knownLength("worldcafe-abc"), 0);
  rememberLength("worldcafe-abc", 3541.6);
  assert.equal(knownLength("worldcafe-abc"), 3542);
  rememberLength("worldcafe-abc", NaN);
  rememberLength("worldcafe-abc", 0);
  assert.equal(knownLength("worldcafe-abc"), 3542);
});

test("a file is asked only with a fresh link, without Save-Data, when the length is unknown", () => {
  const now = Date.now();
  const episode = { id: "worldcafe-new", audio: "https://audio.example.org/a.mp3", fetchedAt: now };
  assert.equal(requestLength({ ...episode, fetchedAt: now - 60 * 60000 }, { now }), false);
  assert.equal(requestLength(episode, { now, saveData: true }), false);
  assert.equal(requestLength({ ...episode, id: "worldcafe-abc" }, { now }), false);
  // No <audio> outside a browser: nothing to ask with.
  assert.equal(requestLength(episode, { now }), false);
});
