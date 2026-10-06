import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeHash } from "../hooks/useRoute.js";

test("routes parse, round-trip, and fall back to Listen", () => {
  assert.deepEqual(parseRoute(""), { screen: "listen", showId: null, episodeId: null });
  assert.deepEqual(parseRoute("#/nonsense"), { screen: "listen", showId: null, episodeId: null });
  assert.deepEqual(parseRoute("#/favorites/show/worldcafe/episode/a-b"), {
    screen: "favorites",
    showId: "worldcafe",
    episodeId: "a-b",
  });
  assert.equal(parseRoute("#/shows/episode/x").episodeId, null, "episode needs a show");
  for (const hash of ["#/settings", "#/shows/show/funky", "#/favorites/show/x%20y/episode/e"]) {
    assert.equal(routeHash(parseRoute(hash)), hash);
  }
});

test("a malformed shared link falls back instead of throwing", () => {
  assert.doesNotThrow(() => parseRoute("#/shows/show/100%"));
  assert.deepEqual(parseRoute("#/shows/show/100%"), {
    screen: "shows",
    showId: null,
    episodeId: null,
  });
});
