import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlaylist,
  mergeTracks,
  isFresh,
  playedLabel,
  playedAt,
  durationMinutes,
  withNowPlaying,
} from "../nowplaying.js";
import { shiftDate } from "../time.js";

test("playlist normalization filters invalid records and sorts by reported time", () => {
  const rows = normalizePlaylist([
    { artist: "A", song: "Earlier", timeslice: "2026-09-07 10:01:00", image: "javascript:bad" },
    {
      artist: "B",
      song: "Latest",
      timeslice: "2026-09-07 10:02:00",
      image: "https://x.test/i.jpg",
    },
    { artist: "", song: "Empty" },
    null,
  ]);
  assert.deepEqual(
    rows.map((r) => [r.title, r.time, r.date]),
    [
      ["Latest", "10:02", "2026-09-07"],
      ["Earlier", "10:01", "2026-09-07"],
    ],
  );
  assert.equal(rows[1].img, "", "non-http artwork is dropped");
  assert.deepEqual(normalizePlaylist({}), []);
});

test("playlist days merge, deduplicate, and stay newest first", () => {
  assert.equal(shiftDate("2026-09-08", -1), "2026-09-07");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2026-03-09", -1), "2026-03-08");
  const yesterday = [
    { date: "2026-09-07", time: "23:58", title: "Late", artist: "A" },
    { date: "2026-09-07", time: "23:40", title: "Earlier", artist: "B" },
  ];
  const today = [
    { date: "2026-09-08", time: "00:04", title: "First", artist: "C" },
    { date: "2026-09-07", time: "23:58", title: "Late", artist: "A" },
  ];
  assert.deepEqual(
    mergeTracks([today, yesterday]).map((t) => t.title),
    ["First", "Late", "Earlier"],
  );
});

test("freshness holds across midnight and expires after 15 minutes", () => {
  const at = (iso) => new Date(iso); // UTC instants; ET is UTC-4 in September
  const track = { date: "2026-09-07", time: "23:58" };
  assert.equal(isFresh(track, at("2026-09-08T04:01:00Z")), true, "00:01 ET next day");
  assert.equal(isFresh(track, at("2026-09-08T04:13:00Z")), false, "00:13 ET is 15 min on");
  assert.equal(isFresh(track, at("2026-09-08T03:50:00Z")), false, "reported in the future");
  assert.equal(isFresh(null), false);
  assert.equal(isFresh({ date: "", time: "" }), false);
});

test("report times read as minutes ago for the last hour", () => {
  const track = { date: "2026-09-28", time: "14:00" };
  const et = (hhmm) => new Date(`2026-09-28T${hhmm}:00-04:00`);
  assert.equal(playedLabel(track, et("14:00")), "Played just now");
  assert.equal(playedLabel(track, et("14:03")), "Played 3 min ago");
  assert.equal(playedLabel(track, et("15:30"), "America/New_York"), "Played at 2pm");
  // In the listener's own zone.
  assert.equal(playedLabel(track, et("15:30"), "America/Los_Angeles"), "Played at 11am");
  assert.equal(playedAt(track, "Europe/London"), "7pm");
  assert.equal(playedLabel({}), "");
});

test("song lengths from the now-playing file", () => {
  assert.equal(durationMinutes("04:22"), 5);
  assert.equal(durationMinutes("21:00"), 21);
  assert.equal(durationMinutes("1:02:30"), 63);
  assert.equal(durationMinutes(""), null);
  assert.equal(durationMinutes("soon"), null);
  assert.equal(durationMinutes("00:00"), null);
});

test("the now-playing file adds length and missing art to the same song only", () => {
  const tracks = [
    { title: "Dark Star", artist: "Grateful Dead", img: "", date: "2026-10-05", time: "21:00" },
    { title: "Earlier", artist: "B", img: "", date: "2026-10-05", time: "20:50" },
  ];
  const now = [
    {
      artist: "grateful dead ",
      song: "Dark Star",
      duration: "23:10",
      image: "https://i.test/a.jpg",
    },
  ];
  const [first, second] = withNowPlaying(tracks, now);
  assert.equal(first.minutes, 24);
  assert.equal(first.img, "https://i.test/a.jpg");
  assert.equal(second, tracks[1]);
  assert.equal(
    withNowPlaying(tracks, [{ artist: "Other", song: "Song" }]),
    tracks,
    "a different song changes nothing",
  );
  assert.equal(withNowPlaying(tracks, null), tracks);
  assert.equal(withNowPlaying([], now).length, 0);
});

test("a long song stays now playing until it should have ended", () => {
  const at = (hhmm) => new Date(`2026-10-05T${hhmm}:00-04:00`);
  const jam = {
    title: "Dark Star",
    artist: "Grateful Dead",
    date: "2026-10-05",
    time: "21:00",
    minutes: 24,
  };
  assert.equal(isFresh(jam, at("21:20")), true, "20 minutes into a 24-minute song");
  assert.equal(isFresh(jam, at("21:28")), false, "over once its length and slack have passed");
  const plain = { ...jam, minutes: undefined };
  assert.equal(isFresh(plain, at("21:14")), true);
  assert.equal(isFresh(plain, at("21:16")), false, "without a length, 15 minutes");
  const short = { ...jam, minutes: 4 };
  assert.equal(isFresh(short, at("21:06")), true, "a 4-minute song, 5 minutes on");
  assert.equal(isFresh(short, at("21:08")), false, "over once its length and slack have passed");
});

test("encoded playlist titles display as text and still match song duration", () => {
  const tracks = normalizePlaylist([
    { song: "Dark Star -&gt; The Other One", artist: "A &amp; B", album: "Live &#8217;26" },
  ]);
  assert.equal(tracks[0].title, "Dark Star -> The Other One");
  assert.equal(tracks[0].artist, "A & B");
  assert.equal(tracks[0].album, "Live ’26");
  const [track] = withNowPlaying(tracks, [
    { song: "Dark Star -&gt; The Other One", artist: "A &amp; B", duration: "25:00" },
  ]);
  assert.equal(track.minutes, 25);
});

test("decoding malformed feed characters is safe and preserves literal text", () => {
  const [track] = normalizePlaylist([
    { song: "&lt;3 &#x1f3b5; &#99999999; &#xD800; &unknown;", artist: "Artist" },
  ]);
  assert.equal(track.title, "<3 🎵 &#99999999; &#xD800; &unknown;");
});
