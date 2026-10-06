import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockTime,
  lengthLabel,
  normalizeEpisodes,
  parseDuration,
  parsePodcastFeed,
} from "../archive.js";
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

test("archive feeds: World Cafe by default, a list, or off", () => {
  assert.deepEqual(parseArchiveFeeds(undefined), [
    { show: "worldcafe", url: "https://feeds.npr.org/510008/podcast.xml" },
  ]);
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
