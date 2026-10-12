// Video pages (videos.js): whether there's another page, and where it
// starts, go by what the server sent, not by what was left to show.
import { test } from "node:test";
import assert from "node:assert/strict";

const WORLD_CAFE = "1876180529963365406";
const replies = {};
// A page held back until the test lets it through.
const waits = {};
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  if (u.pathname.endsWith("config.json")) {
    return new Response(JSON.stringify({ video_cloud: { policy_key: "k" } }), { status: 200 });
  }
  const playlist = u.pathname.split("/").pop();
  const offset = Number(u.searchParams.get("offset") || 0);
  const reply = offset ? replies[`${playlist}@${offset}`] : replies[playlist];
  const wait = waits[`${playlist}@${offset}`];
  if (wait) await wait;
  if (reply === undefined) return new Response("", { status: 500 });
  return new Response(JSON.stringify({ videos: reply }), { status: 200 });
};
const video = (id) => ({
  id: String(id),
  name: `Artist ${id} | Session`,
  tags: [],
  published_at: "2026-09-01T00:00:00Z",
});
const page = (from, n) => Array.from({ length: n }, (_, i) => video(from + i));

const { getVideos, loadMoreVideos, loadVideos } = await import("../videos.js");
const section = (playlist) => getVideos().sections.find((s) => s.playlist === playlist);

test("a full page with a duplicate still leads to the next page, from the right place", async () => {
  const first = page(1, 48);
  first[47] = video(47); // the server repeats one: 47 to show, 48 sent
  replies[WORLD_CAFE] = first;
  await loadVideos({ force: true });
  assert.equal(section(WORLD_CAFE).videos.length, 47);
  assert.equal(section(WORLD_CAFE).more, true, "48 came back, so there may be more");
  replies[`${WORLD_CAFE}@48`] = page(49, 3);
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).videos.at(-1).id, "51", "the next page starts at 48");
  assert.equal(section(WORLD_CAFE).videos.length, 50);
  assert.equal(section(WORLD_CAFE).more, false);
});

test("a page and a refresh take turns: neither undoes the other", async () => {
  // 96 videos open: two full pages.
  replies[WORLD_CAFE] = page(1, 48);
  replies[`${WORLD_CAFE}@48`] = page(49, 48);
  await loadVideos({ force: true });
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).videos.length, 96);

  // "Show more" is slow to answer, with the list's third page.
  let release;
  waits[`${WORLD_CAFE}@96`] = new Promise((resolve) => (release = resolve));
  replies[`${WORLD_CAFE}@96`] = page(97, 48);
  const more = loadMoreVideos(WORLD_CAFE);

  // Meanwhile a refresh is asked for; it waits for the page. By its turn a
  // video has gone in just past the first 96.
  // (The held page already has its answer; the refresh will read these.)
  const refresh = loadVideos({ force: true });
  replies[`${WORLD_CAFE}@96`] = [video(5000), ...page(97, 47)];
  replies[`${WORLD_CAFE}@144`] = page(144, 2);
  delete waits[`${WORLD_CAFE}@96`];
  release();
  await more;
  assert.equal(section(WORLD_CAFE).videos.length, 144, "the page landed");
  await refresh;
  const ids = section(WORLD_CAFE).videos.map((v) => v.id);
  assert.equal(ids.length, 144, "the refresh read as far as the listener had gone");
  assert.ok(ids.includes("5000"), "the new video is in the list");
  assert.equal(section(WORLD_CAFE).offset, 144);
  assert.equal(section(WORLD_CAFE).more, true, "143 and on are still to come");
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).videos.at(-1).id, "145", "nothing skipped");
});
