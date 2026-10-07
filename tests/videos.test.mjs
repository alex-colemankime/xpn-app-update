import { test } from "node:test";
import assert from "node:assert/strict";
import { matchVideos, normalizeVideo, parsePlaylist, playerUrl, splitTitle } from "../videos.js";
import { parseVideoSections } from "../config.js";

test("video names read as an artist and what it is", () => {
  const cases = [
    [
      "Julia Jacklin on World Cafe | Studio Session & Interview",
      "",
      ["Julia Jacklin", "World Cafe · Studio Session & Interview"],
    ],
    ["The Beths - World Cafe 2025", "", ["The Beths", "World Cafe 2025"]],
    [
      "Phosphorescent - Impossible Housee (World Cafe version)",
      "",
      ["Phosphorescent", "Impossible Housee (World Cafe version)"],
    ],
    [
      "Old 97's - Old 97's - World Cafe - At Home Performance & Interview",
      "",
      ["Old 97's", "World Cafe - At Home Performance & Interview"],
    ],
    [
      'Hudson Freeman - Hudson Freeman performs "If You Know Me" at XPN Studios',
      "",
      ["Hudson Freeman", 'Hudson Freeman performs "If You Know Me" at XPN Studios'],
    ],
    [
      "Iron & Wine - World Cafe: Backtracking | Live Session & Interview",
      "Iron & Wine",
      ["Iron & Wine", "World Cafe: Backtracking · Live Session & Interview"],
    ],
    ['WXPN - "NOU LA - Part 1"', "", ["", "NOU LA - Part 1"]],
    ["35 Years of World Cafe", "", ["", "35 Years of World Cafe"]],
  ];
  for (const [name, performer, [artist, detail]] of cases) {
    assert.deepEqual(splitTitle(name, performer), { artist, detail }, name);
  }
});

test("a playlist becomes videos, each once, in its order", () => {
  const raw = (id, name, extra = {}) => ({
    id,
    name,
    duration: 2196000,
    poster: `https://cf-images.us-east-1.prod.boltdns.net/v1/static/1/${id}/1280x720/match/image.jpg`,
    published_at: "2026-10-01T21:31:00.000Z",
    tags: ["worldcafe", " NPRFeatured "],
    custom_fields: { artist_performer: "The Wiggles" },
    long_description: "  The Wiggles   visit World Cafe. ",
    ...extra,
  });
  const videos = parsePlaylist({
    videos: [
      raw("6406083303112", "The Wiggles on World Cafe | Studio Session & Interview"),
      raw("6406083303112", "The Wiggles on World Cafe | Studio Session & Interview"),
      raw("x", "Bad id"),
      raw("6405549360112", ""),
      raw("6405549360113", "No poster", { poster: "http://insecure/x.jpg", thumbnail: null }),
    ],
  });
  assert.deepEqual(
    videos.map((v) => v.id),
    ["6406083303112", "6405549360113"],
  );
  const [wiggles, noPoster] = videos;
  assert.equal(wiggles.artist, "The Wiggles");
  assert.equal(wiggles.detail, "World Cafe · Studio Session & Interview");
  assert.equal(wiggles.duration, 2196);
  assert.equal(wiggles.description, "The Wiggles visit World Cafe.");
  assert.deepEqual(wiggles.tags, ["worldcafe", "nprfeatured"]);
  assert.equal(wiggles.published, "2026-10-01T21:31:00.000Z");
  assert.equal(noPoster.poster, "", "only https images");
  assert.equal(normalizeVideo(null), null);
  assert.deepEqual(parsePlaylist({ error: "nope" }), []);
});

test("videos play in the account's player, counted as the app", () => {
  const url = new URL(playerUrl("6406083303112", { account: "123", player: "default" }));
  assert.equal(
    url.origin + url.pathname,
    "https://players.brightcove.net/123/default_default/index.html",
  );
  assert.equal(url.searchParams.get("videoId"), "6406083303112");
  assert.equal(url.searchParams.get("autoplay"), "play");
  assert.equal(url.searchParams.get("playsinline"), "true");
  assert.equal(url.searchParams.get("applicationId"), "wxpn-app");
});

test("searching finds artists, titles, descriptions and tags", () => {
  const videos = parsePlaylist({
    videos: [
      { id: "1", name: "Mitski on World Cafe | Live Session", tags: ["worldcafe"] },
      { id: "2", name: "Sotomayor - World Cafe Mini Concert", long_description: "Cumbia." },
      { id: "3", name: "Hudson Freeman - Live at XPN Studios", tags: ["homegrown"] },
    ],
  });
  assert.deepEqual(
    matchVideos(videos, "mitski").map((v) => v.id),
    ["1"],
  );
  assert.deepEqual(
    matchVideos(videos, "cumbia").map((v) => v.id),
    ["2"],
  );
  assert.deepEqual(
    matchVideos(videos, "HOMEGROWN").map((v) => v.id),
    ["3"],
  );
  assert.equal(matchVideos(videos, "  ").length, 3);
});

test("video sections: World Cafe and WXPN by default, a list, or off", () => {
  assert.deepEqual(parseVideoSections(undefined), [
    { label: "World Cafe", playlist: "1876180529963365406" },
    { label: "WXPN", playlist: "1874727417810648125" },
  ]);
  assert.deepEqual(parseVideoSections("Sessions=123, Home Grown=456, broken=abc"), [
    { label: "Sessions", playlist: "123" },
    { label: "Home Grown", playlist: "456" },
  ]);
  assert.deepEqual(parseVideoSections("off"), []);
});
