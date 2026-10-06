import { test } from "node:test";
import assert from "node:assert/strict";
import { songId } from "../favorites.js";

test("song ids keep every script and fold accents", () => {
  assert.equal(songId({ artist: "Kim Deal", title: "Coast" }), "kim-deal-coast");
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
