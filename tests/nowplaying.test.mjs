import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlaylist,
  mergeTracks,
  isFresh,
  playedAt,
  durationMinutes,
  withNowPlaying,
  readPlaylist,
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

test("a show's own segments are named by the show, without the bars", () => {
  const [segment, other] = normalizePlaylist([
    {
      artist: "|World Cafe|",
      song: "The Womack Sisters 10-7-2026 Hour 2, Part 7",
      timeslice: "2026-10-07 15:46:50",
    },
    { artist: "|Something Else|", song: "Part 1", timeslice: "2026-10-07 15:40:00" },
  ]);
  assert.equal(segment.artist, "World Cafe");
  assert.equal(segment.show, "worldcafe");
  assert.equal(other.artist, "Something Else");
  assert.equal(other.show, undefined, "only the station's own shows are linked");
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

test("the hour repeated when clocks fall back keeps its order and freshness", () => {
  // Nov. 1, 2026: 1:58am EDT, then the clocks go back, then 1:01am EST.
  const now = new Date("2026-11-01T01:02:00-05:00");
  const earlier = { title: "Before", artist: "A", date: "2026-11-01", time: "01:58" };
  const later = { title: "After", artist: "B", date: "2026-11-01", time: "01:01" };
  assert.equal(isFresh(earlier, now), true, "four minutes ago, not an hour ahead");
  assert.deepEqual(
    mergeTracks([[earlier, later]], now.getTime()).map((t) => t.title),
    ["After", "Before"],
  );
});

test("a song's play time reads in the listener's own zone", () => {
  const track = { date: "2026-09-28", time: "14:00" };
  assert.equal(playedAt(track, "America/New_York"), "2pm");
  assert.equal(playedAt(track, "America/Los_Angeles"), "11am");
  assert.equal(playedAt(track, "Europe/London"), "7pm");
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

test("just after midnight, a day file not made yet leaves yesterday's songs showing", async () => {
  const endpoint = { day: "https://feed.test/day/", now: "https://feed.test/now.json" };
  const files = {
    "https://feed.test/day/2026-10-10.json": [
      { artist: "Late", song: "Last of the night", timeslice: "2026-10-10 23:58:00" },
    ],
  };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) =>
    files[url]
      ? new Response(JSON.stringify(files[url]), { status: 200 })
      : new Response("Not found", { status: 404 });
  try {
    // 12:03am Eastern: the station hasn't logged the new day's first song.
    const early = new Date("2026-10-11T04:03:00Z");
    const { tracks } = await readPlaylist(endpoint, undefined, early);
    assert.deepEqual(
      tracks.map((t) => t.title),
      ["Last of the night"],
    );
    // Later in the day the day's own file is required, as before.
    await assert.rejects(readPlaylist(endpoint, undefined, new Date("2026-10-11T14:00:00Z")));
    // And with neither file there, the read fails.
    delete files["https://feed.test/day/2026-10-10.json"];
    await assert.rejects(readPlaylist(endpoint, undefined, early));
  } finally {
    globalThis.fetch = real;
  }
});

// The hour repeated when clocks fall back (Nov. 1, 2026: 1:00–1:59am twice).
const fallFile = (times) =>
  times.map((time, i) => ({
    song: `Song ${i}`,
    artist: "Artist",
    timeslice: `2026-11-01 ${time}:00`,
  }));

test("a song logged at 1:04am EDT is an hour old at 1:05am EST, not a minute", () => {
  const now = Date.parse("2026-11-01T06:05:00Z"); // 1:05am EST
  for (const order of ["oldest first", "newest first"]) {
    const times = ["00:58", "01:04"];
    const rows = normalizePlaylist(
      fallFile(order === "oldest first" ? times : [...times].reverse()),
      now,
    );
    assert.equal(rows[0].time, "01:04", order);
    assert.equal(new Date(rows[0].at).toISOString(), "2026-11-01T05:04:00.000Z", order);
    assert.equal(isFresh(rows[0], new Date(now)), false, `${order}: not on the air now`);
  }
});

test("after the clocks fall back, the file's order says which 1am a song is", () => {
  const now = Date.parse("2026-11-01T06:05:00Z"); // 1:05am EST
  const rows = normalizePlaylist(fallFile(["00:58", "01:04", "01:58", "01:02"]), now);
  assert.deepEqual(
    rows.map((r) => [r.time, new Date(r.at).toISOString().slice(11, 16)]),
    [
      ["01:02", "06:02"], // EST, the song on the air
      ["01:58", "05:58"], // EDT
      ["01:04", "05:04"], // EDT
      ["00:58", "04:58"],
    ],
  );
  assert.equal(isFresh(rows[0], new Date(now)), true);
});

test("a repeated-hour time with nothing before it in the file goes by the clock", () => {
  const rows = normalizePlaylist(fallFile(["01:04"]), Date.parse("2026-11-01T06:05:00Z"));
  assert.equal(new Date(rows[0].at).toISOString(), "2026-11-01T06:04:00.000Z");
});
