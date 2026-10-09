// Links that open the app (deep-links.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeForUrl } from "../deep-links.js";

test("xpn.org addresses open the matching screen", () => {
  assert.equal(routeForUrl("https://xpn.org/program/world-cafe/"), "#/shows/show/worldcafe");
  assert.equal(routeForUrl("https://www.xpn.org/program/funky-friday"), "#/shows/show/funky");
  assert.equal(routeForUrl("https://xpn.org/listen/?utm_source=x"), "#/listen");
  assert.equal(routeForUrl("https://xpn.org/wxpn-playlists/"), "#/listen");
  assert.equal(routeForUrl("https://xpn.org/concert-and-events/"), "#/concerts");
});

test("anything else is left to the website", () => {
  assert.equal(routeForUrl("https://xpn.org/donate/"), null, "giving stays on xpn.org");
  assert.equal(routeForUrl("https://xpn.org/program/not-a-show/"), null);
  assert.equal(routeForUrl("https://example.com/program/world-cafe/"), null);
  assert.equal(routeForUrl("http://xpn.org/listen/"), null);
  assert.equal(routeForUrl("org.xpn.wxpn://callback?code=1"), null, "the Spotify return");
  assert.equal(routeForUrl("not a url"), null);
});
