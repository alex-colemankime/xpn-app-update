// Fresh audio links for archive episodes (archive.js): the links on xpn.org
// are signed and run out, so a saved or long-listed episode is read again
// from its show's page before it plays. Its own file, so the archive's
// shared state starts empty.
import { test } from "node:test";
import assert from "node:assert/strict";

// What xpn.org serves, per show page; a test changes it as the site would.
const pages = {};
let reads = [];
globalThis.fetch = async (url) => {
  reads.push(String(url));
  const page = pages[String(url)];
  if (page === undefined) return new Response("", { status: 503 });
  return new Response(page, { status: 200 });
};

const { episodesOf, findEpisode, freshCopy, getArchive, hasLeftArchive, linkIsFresh, loadArchive } =
  await import("../archive.js");
const storeState = getArchive;

const SLEEPY_URL = "https://xpn.org/program/sleepy-hollow/";
const FUNKY_URL = "https://xpn.org/program/funky-friday/";
const page = (items, key) =>
  items
    .map(
      ([title, guid]) =>
        `<button data-track-guid="${guid}" data-track-url="https://dylan.streamguys1.com/20261006140615_${guid}.mp3?key=${key}&amp;ttl=1800" data-track-title="${title}"></button>`,
    )
    .join("");

test("a saved episode is played from a fresh link read from its show's page", async () => {
  pages[SLEEPY_URL] = page([["Sleepy Hollow - 10.04.2026", "a1"]], "first");
  reads = [];
  // An earlier read gives the episode its id; favorites keep no link.
  const listed = await findEpisode({ id: "unknown", show: "sleepyhollow" }).catch((e) => e);
  assert.equal(listed.reason, "gone", "an id the page doesn't list has left the archive");
  const [first] = episodesOf(storeState(), "sleepyhollow");
  const saved = { id: first.id, show: "sleepyhollow", title: first.title };

  pages[SLEEPY_URL] = page([["Sleepy Hollow - 10.04.2026", "a1"]], "second");
  reads = [];
  // Within the fresh window the archive's own copy is used, with no read.
  assert.equal((await findEpisode(saved)).audio, first.audio);
  assert.equal(reads.length, 0);
  assert.ok(linkIsFresh(freshCopy(saved)));

  // Twenty-one minutes on, the link is old: the page is read again.
  const realNow = Date.now;
  Date.now = () => realNow() + 21 * 60000;
  try {
    assert.equal(freshCopy(saved), null);
    const fresh = await findEpisode(saved);
    assert.equal(reads.length, 1);
    assert.match(fresh.audio, /key=second/);
    assert.ok(linkIsFresh(fresh));
  } finally {
    Date.now = realNow;
  }
});

test("an episode the page no longer lists is gone; an unreadable page is offline", async () => {
  pages[SLEEPY_URL] = page([["Sleepy Hollow - 10.11.2026", "b2"]], "third");
  const gone = await findEpisode({ id: "sleepyhollow-old", show: "sleepyhollow" }).catch((e) => e);
  assert.equal(gone.reason, "gone");
  assert.ok(
    hasLeftArchive(storeState(), { id: "sleepyhollow-old", show: "sleepyhollow" }),
    "Favorites can say so before a tap",
  );
  delete pages[FUNKY_URL];
  const offline = await findEpisode({ id: "funky-x", show: "funky" }).catch((e) => e);
  assert.equal(offline.reason, "offline");
  assert.equal(hasLeftArchive(storeState(), { id: "funky-x", show: "funky" }), false);
});

test("a show whose page fails keeps its episodes, and the archive tries again soon", async () => {
  pages[SLEEPY_URL] = page([["Sleepy Hollow - 10.11.2026", "b2"]], "fourth");
  pages[FUNKY_URL] = page([["Funky Friday - 10.09.2026", "f1"]], "one");
  await loadArchive({ force: true });
  assert.equal(storeState().complete, false, "Land of the Lost and World Cafe failed");
  assert.equal(storeState().episodes.filter((e) => e.show === "funky").length, 1);

  delete pages[FUNKY_URL];
  await loadArchive({ force: true });
  assert.equal(
    storeState().episodes.filter((e) => e.show === "funky").length,
    1,
    "Funky Friday's failed read leaves its list in place",
  );
  assert.equal(storeState().source, "live");
});
