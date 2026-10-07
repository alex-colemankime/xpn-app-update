import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeHash } from "../hooks/useRoute.js";

const route = (screen, showId = null, episodeId = null, videoId = null) => ({
  screen,
  showId,
  episodeId,
  videoId,
});

test("routes parse, round-trip, and fall back to Listen", () => {
  assert.deepEqual(parseRoute(""), route("listen"));
  assert.deepEqual(parseRoute("#/nonsense"), route("listen"));
  assert.deepEqual(
    parseRoute("#/favorites/show/worldcafe/episode/a-b"),
    route("favorites", "worldcafe", "a-b"),
  );
  assert.equal(parseRoute("#/shows/episode/x").episodeId, null, "episode needs a show");
  for (const hash of ["#/settings", "#/shows/show/funky", "#/favorites/show/x%20y/episode/e"]) {
    assert.equal(routeHash(parseRoute(hash)), hash);
  }
});

test("a video opens over a screen, by its Brightcove id", () => {
  assert.deepEqual(parseRoute("#/shows/video/6406083303112"), {
    ...route("shows"),
    videoId: "6406083303112",
  });
  assert.equal(parseRoute("#/shows/video/not-an-id").videoId, null);
  assert.equal(
    routeHash(route("listen", null, null, "6406083303112")),
    "#/listen/video/6406083303112",
  );
});

test("a malformed shared link falls back instead of throwing", () => {
  assert.doesNotThrow(() => parseRoute("#/shows/show/100%"));
  assert.deepEqual(parseRoute("#/shows/show/100%"), route("shows"));
});
