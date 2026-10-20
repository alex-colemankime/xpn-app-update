// The home screen widget (widget.js): what it shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { widgetNowPlaying } from "../widget.js";

test("the widget names the stream, the song and the show on the air", () => {
  const track = { title: "Motion Sickness", artist: "Phoebe Bridgers", img: "https://a/b.jpg" };
  assert.deepEqual(
    widgetNowPlaying({ streamId: "xpn", playing: true, track }, null, "World Cafe"),
    {
      stationId: "xpn",
      station: "WXPN",
      title: "Motion Sickness",
      artist: "Phoebe Bridgers",
      show: "World Cafe",
      artwork: "https://a/b.jpg",
      playing: true,
    },
  );
});

test("without a song it shows the stream; only WXPN has a show on the air", () => {
  const w = widgetNowPlaying({ streamId: "xpn2", playing: false, track: null }, null, "World Cafe");
  assert.equal(w.station, "XPN2");
  assert.equal(w.title, "XPN2");
  assert.equal(w.artist, "XPoNential Radio");
  assert.equal(w.show, "");
  assert.equal(w.artwork, "");
});

test("an archived episode in the player bar is shown as the episode", () => {
  const w = widgetNowPlaying(
    { streamId: "xpn", playing: false, track: null },
    {
      episode: { title: "Sunday, October 18", showName: "Sleepy Hollow", image: "i.jpg" },
      status: "loading",
    },
    "World Cafe",
  );
  assert.equal(w.station, "Sleepy Hollow");
  assert.equal(w.stationId, "");
  assert.equal(w.title, "Sunday, October 18");
  assert.equal(w.playing, true);
  assert.equal(w.show, "");
  assert.equal(w.artwork, "", "the app's own show art isn't reachable from native code");
});
