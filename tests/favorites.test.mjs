import { test } from "node:test";
import assert from "node:assert/strict";
import { legacySongId, songId } from "../favorites.js";

test("song ids keep every script and fold accents", () => {
  assert.equal(songId({ artist: "Kim Deal", title: "Coast" }), "kim-deal--coast");
  assert.notEqual(
    songId({ artist: "BTS", title: "봄날" }),
    songId({ artist: "BTS", title: "작은 것들을 위한 시" }),
    "two Korean titles by one artist stay distinct",
  );
  assert.ok(songId({ artist: "坂本龍一", title: "戦場のメリークリスマス" }), "never empty");
  assert.equal(
    songId({ artist: "Beyoncé", title: "Café" }),
    songId({ artist: "Beyonce", title: "Cafe" }),
  );
});

test("artist and title stay apart in a song's id, so two songs never share one", () => {
  const a = { artist: "A-B", title: "C" };
  const b = { artist: "A", title: "B-C" };
  assert.notEqual(songId(a), songId(b));
  assert.equal(legacySongId(a), legacySongId(b), "as they did under the old id");
  assert.equal(songId({ artist: "", title: "" }), "", "nothing to name: no id");
});
