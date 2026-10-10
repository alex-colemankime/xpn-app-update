import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEpisodes, parseArchivePage, parsePodcastFeed, parseSource } from "../archive.js";
import { clockTime, lengthLabel, parseDuration } from "../time.js";
import { parseArchiveFeeds } from "../config.js";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>World Cafe Words and Music Podcast</title>
  <itunes:image href="https://media.example.org/show.jpg"/>
  <item>
    <title><![CDATA[Before the Breakthrough: Los Lobos]]></title>
    <description><![CDATA[<p>For Hispanic Heritage Month, World Cafe dives into the band&#8217;s career.</p>]]></description>
    <pubDate>Fri, 02 Oct 2026 16:00:00 +0000</pubDate>
    <guid isPermaLink="false">ep-los-lobos</guid>
    <link>https://www.npr.org/2026/10/02/los-lobos</link>
    <itunes:duration>684</itunes:duration>
    <itunes:image href="https://media.example.org/los-lobos.jpg"/>
    <enclosure url="https://audio.example.org/los-lobos.mp3?a=1&amp;b=2" length="1" type="audio/mpeg"/>
  </item>
  <item>
    <title>John R. Miller takes to the road</title>
    <description>Miller &amp; band.</description>
    <pubDate>Tue, 06 Oct 2026 15:09:06 +0000</pubDate>
    <guid>ep-miller</guid>
    <itunes:duration>37:27</itunes:duration>
    <enclosure type="audio/mpeg" url="https://audio.example.org/miller.mp3"/>
  </item>
  <item>
    <title>A video, not audio</title>
    <pubDate>Mon, 05 Oct 2026 12:00:00 +0000</pubDate>
    <enclosure url="https://audio.example.org/clip.mp4" type="video/mp4"/>
  </item>
  <item>
    <title>Insecure audio</title>
    <pubDate>Mon, 05 Oct 2026 12:00:00 +0000</pubDate>
    <enclosure url="http://audio.example.org/old.mp3" type="audio/mpeg"/>
  </item>
  <item>
    <title>No date</title>
    <enclosure url="https://audio.example.org/nodate.mp3" type="audio/mpeg"/>
  </item>
</channel>
</rss>`;

test("a podcast feed becomes playable episodes, newest first", () => {
  const episodes = parsePodcastFeed(FEED, "worldcafe");
  assert.deepEqual(
    episodes.map((e) => e.title),
    ["John R. Miller takes to the road", "Before the Breakthrough: Los Lobos"],
    "video, http and undated items are skipped",
  );
  const [miller, lobos] = episodes;
  assert.equal(lobos.show, "worldcafe");
  assert.equal(lobos.audio, "https://audio.example.org/los-lobos.mp3?a=1&b=2");
  assert.equal(lobos.duration, 684);
  assert.equal(lobos.image, "https://media.example.org/los-lobos.jpg");
  assert.equal(
    lobos.summary,
    "For Hispanic Heritage Month, World Cafe dives into the band’s career.",
  );
  assert.equal(lobos.page, "https://www.npr.org/2026/10/02/los-lobos");
  assert.equal(lobos.date, "2026-10-02T16:00:00.000Z");
  assert.equal(miller.duration, 37 * 60 + 27);
  assert.equal(miller.image, "https://media.example.org/show.jpg", "falls back to the show's art");
  assert.equal(miller.summary, "Miller & band.");
  // Ids are stable from one load to the next, and distinct.
  assert.equal(parsePodcastFeed(FEED, "worldcafe")[0].id, miller.id);
  assert.notEqual(miller.id, lobos.id);
  assert.match(miller.id, /^worldcafe-/);
});

test("broken feeds and cached lists never break the archive", () => {
  assert.deepEqual(parsePodcastFeed("", "worldcafe"), []);
  assert.deepEqual(parsePodcastFeed("<html>not a feed</html>", "worldcafe"), []);
  assert.deepEqual(normalizeEpisodes(null), []);
  const kept = normalizeEpisodes([
    {
      id: "a",
      show: "worldcafe",
      title: "Ok",
      date: "2026-10-01T00:00:00Z",
      audio: "https://x/a.mp3",
    },
    { id: "b", show: "worldcafe", title: "No audio", date: "2026-10-02T00:00:00Z" },
    { id: "c", show: "worldcafe", title: "Bad date", date: "soon", audio: "https://x/c.mp3" },
    {
      id: "d",
      show: "worldcafe",
      title: "Script",
      date: "2026-10-03T00:00:00Z",
      audio: "javascript:alert(1)",
    },
  ]);
  assert.deepEqual(
    kept.map((e) => e.id),
    ["a"],
  );
});

test("lengths and positions read naturally", () => {
  assert.equal(parseDuration("2247"), 2247);
  assert.equal(parseDuration("1:02:03"), 3723);
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration(""), null);
  assert.equal(lengthLabel(2247), "37 min");
  assert.equal(lengthLabel(3600), "1 hr");
  assert.equal(lengthLabel(3840), "1 hr 4 min");
  assert.equal(lengthLabel(null), "");
  assert.equal(clockTime(65), "1:05");
  assert.equal(clockTime(3723), "1:02:03");
});

// The archive list on an xpn.org show page, as the site renders it.
const item = (title, file, guid) =>
  `<button type="button" class="wxpn-program-detail__archive-item" data-track-guid="${guid}" ` +
  `data-track-url="https://dylan.streamguys1.com/${file}?key=abc&amp;ttl=1800" ` +
  `data-track-title="${title}" data-track-image="https://xpn-rss.streamguys1.com/xpn/player.jpg">` +
  `<span class="wxpn-program-detail__archive-caret">▶</span>` +
  `<span class="wxpn-program-detail__archive-title">${title}</span></button>`;
const PAGE = `<section class="wxpn-program-detail__archive-list">
  ${item("Sleepy Hollow - 10.04.2026", "20261006140615_843187-SleepyHolow-10.04.2026.mp3", "9f6e24a0")}
  ${item("Sleepy Hollow - 10.03.2026", "20261006135818_409025-SleepyHollow-10.03.2026.mp3", "82db8e00")}
  ${item("Sleepy Hollow - 10.03.2026", "20261006135900_409026-SleepyHollow-10.03.2026.mp3", "82db8e01")}
  ${item("Sleepy Hollow - 08.29.26 (Joni Mitchell)", "20260830101500_1-SH.mp3", "aa")}
  ${item("Sleepy Hollow - 02.30.26", "20260302101500_2-SH.mp3", "bb")}
  ${item("", "20260301101500_3-SH.mp3", "cc")}
</section>`;
const SLEEPY = {
  show: "sleepyhollow",
  name: "Sleepy Hollow",
  schedule: [{ days: ["Saturday", "Sunday"], start: "06:00", end: "10:00" }],
};

test("an xpn.org show page's archive becomes broadcasts, by the day they aired", () => {
  const episodes = parseArchivePage(PAGE, SLEEPY);
  assert.deepEqual(
    episodes.map((e) => [e.title, e.feature, e.aired]),
    [
      ["Sunday, October 4", "", "6am–10am"],
      ["Saturday, October 3", "", "6am–10am"],
      ["Saturday, August 29", "Joni Mitchell", "6am–10am"],
    ],
    "the repeat, the impossible date and the untitled item are dropped",
  );
  const [sunday] = episodes;
  assert.equal(sunday.date, "2026-10-04T10:00:00.000Z", "6am Eastern, in its slot");
  assert.equal(
    sunday.audio,
    "https://dylan.streamguys1.com/20261006140615_843187-SleepyHolow-10.04.2026.mp3?key=abc&ttl=1800",
    "the signed link, as given",
  );
  assert.equal(sunday.duration, null);
  assert.equal(parseArchivePage(PAGE, SLEEPY)[0].id, sunday.id, "ids are stable");
  assert.match(sunday.id, /^sleepyhollow-/);
});

test("a feature on a show page keeps its name, dated by its upload", () => {
  const page =
    item("John R. Milleron World Cafe", "20261002065218_069616-JOHNR.mp3", "g1") +
    item("Friko  on World Cafe", "20260930070000_1-FRIKO.mp3", "g2");
  const episodes = parseArchivePage(page, {
    show: "worldcafe",
    name: "World Cafe",
    schedule: [{ days: ["Friday", "Wednesday"], start: "14:00", end: "16:00" }],
  });
  assert.deepEqual(
    episodes.map((e) => [e.title, e.date, e.aired]),
    [
      ["John R. Miller", "2026-10-02T18:00:00.000Z", ""],
      ["Friko", "2026-09-30T18:00:00.000Z", ""],
    ],
  );
});

test("a source is read as a feed or a show page, with the show's own art", () => {
  const fromPage = parseSource(PAGE, "sleepyhollow");
  assert.equal(fromPage[0].title, "Sunday, October 4");
  assert.ok(fromPage[0].image, "the catalog's art for the show");
  const fromFeed = parseSource(FEED, "worldcafe");
  assert.equal(fromFeed[0].title, "John R. Miller takes to the road");
});

test("archive sources: xpn.org's archived shows by default, a list, or off", () => {
  assert.deepEqual(
    parseArchiveFeeds(undefined).map((f) => f.show),
    ["sleepyhollow", "funky", "landlost", "worldcafe"],
  );
  assert.ok(parseArchiveFeeds(undefined).every((f) => f.url.startsWith("https://xpn.org/")));
  assert.deepEqual(parseArchiveFeeds("off"), []);
  assert.deepEqual(
    parseArchiveFeeds("worldcafe=https://a.example/feed.xml?x=1, folkshow=https://b.example/rss"),
    [
      { show: "worldcafe", url: "https://a.example/feed.xml?x=1" },
      { show: "folkshow", url: "https://b.example/rss" },
    ],
  );
  assert.deepEqual(parseArchiveFeeds("bad pair, x=http://insecure"), []);
});

test("two sessions sharing a title on different days are both kept", () => {
  const page =
    item("Friko on World Cafe", "20261007070000_2-FRIKO.mp3", "g-new") +
    item("Friko on World Cafe", "20260930070000_1-FRIKO.mp3", "g-old") +
    // The same broadcast listed twice: kept once.
    item("Friko on World Cafe", "20261007070000_2-FRIKO.mp3", "g-new");
  const episodes = parseArchivePage(page, { show: "worldcafe", name: "World Cafe" });
  assert.deepEqual(
    episodes.map((e) => e.date.slice(0, 10)),
    ["2026-10-07", "2026-09-30"],
  );
  assert.notEqual(episodes[0].id, episodes[1].id);
});

test("a feed's attributes in single quotes are read too", () => {
  const feed = `<?xml version='1.0'?><rss version='2.0'><channel><item>
    <title>Single quotes</title>
    <pubDate>Tue, 06 Oct 2026 15:09:06 +0000</pubDate>
    <guid>ep-single</guid>
    <enclosure url='https://audio.example.org/single.mp3' type='audio/mpeg'/>
  </item></channel></rss>`;
  const [episode] = parsePodcastFeed(feed, "worldcafe");
  assert.equal(episode?.audio, "https://audio.example.org/single.mp3");
});
