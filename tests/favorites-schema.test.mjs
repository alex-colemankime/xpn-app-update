// Saved items are rebuilt from explicit rules when read back (favorites.js),
// so a damaged record can't break a screen: a concert with an impossible
// date, an episode keeping an expired audio link, or optional fields of the
// wrong type.
import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map([
  [
    "xpn.favorites.v1",
    JSON.stringify({
      concerts: {
        bad: { id: "bad", artist: "Wilco", date: "zzzz" },
        feb30: { id: "feb30", artist: "Wilco", date: "2026-02-30" },
        good: {
          id: "good",
          artist: "Wilco",
          date: "2026-11-02",
          venue: { name: "not text" },
          ticketUrl: "javascript:alert(1)",
          pageUrl: "https://xpn.org/event/1/",
          regions: "Philadelphia",
          savedAt: 5,
        },
      },
      episodes: {
        e1: {
          id: "e1",
          title: "Sunday, October 4",
          show: "sleepyhollow",
          audio: "https://dylan.streamguys1.com/a.mp3?key=secret&ttl=1",
          duration: "long",
          page: "not a url",
        },
      },
      videos: {
        v1: { id: "not-digits", name: "x" },
        123: { id: "123", name: "Session", tags: [1, "worldcafe"] },
      },
      songs: { s: { title: "Coast", artist: "Kim Deal", img: { src: 1 }, time: "noon" } },
    }),
  ],
]);
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
};
const { calendarDay, getFavorite, toggleFavorite } = await import("../favorites.js");

test("a concert with an impossible date is dropped; the rest are repaired", () => {
  assert.equal(getFavorite("concerts", { id: "bad" }), null);
  assert.equal(getFavorite("concerts", { id: "feb30" }), null);
  const good = getFavorite("concerts", { id: "good" });
  assert.equal(good.venue, "", "a venue that isn't text is emptied");
  assert.equal(good.ticketUrl, "", "only web links survive");
  assert.equal(good.pageUrl, "https://xpn.org/event/1/");
  assert.deepEqual(good.regions, []);
  assert.equal(good.savedAt, 5);
  // What the row does with it now works.
  assert.doesNotThrow(() =>
    new Intl.DateTimeFormat("en-US").format(new Date(`${good.date}T12:00:00`)),
  );
});

test("a saved episode keeps no audio link, and its damaged fields are emptied", () => {
  const episode = getFavorite("episodes", { id: "e1" });
  assert.equal(episode.audio, undefined);
  assert.equal(episode.duration, null);
  assert.equal(episode.page, "");
  assert.equal(episode.show, "sleepyhollow");
  assert.doesNotMatch(memory.get("xpn.favorites.v1") || "", /secret/, "nor is it written back");
});

test("other types are checked the same way", () => {
  assert.equal(getFavorite("videos", { id: "not-digits" }), null);
  assert.deepEqual(getFavorite("videos", { id: "123" }).tags, ["worldcafe"]);
  const song = getFavorite("songs", { title: "Coast", artist: "Kim Deal" });
  assert.equal(song.img, "");
  assert.equal(song.time, "");
  assert.equal(calendarDay("2028-02-29"), "2028-02-29");
  assert.equal(calendarDay("2027-02-29"), "");
});

test("new saves pass through the same rules", () => {
  toggleFavorite("concerts", { id: "new", artist: "Waxahatchee", date: "nope" });
  assert.equal(getFavorite("concerts", { id: "new" }), null);
});
