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

test("a page asked for before a refresh is let go, even when the new list ends at the same place", async () => {
  // 96 videos open: two full pages.
  replies[WORLD_CAFE] = page(1, 48);
  replies[`${WORLD_CAFE}@48`] = page(49, 48);
  await loadVideos({ force: true });
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).videos.length, 96);

  // "Show more" is slow to answer, with the old list's third page.
  let release;
  waits[`${WORLD_CAFE}@96`] = new Promise((resolve) => (release = resolve));
  replies[`${WORLD_CAFE}@96`] = page(97, 48);
  const more = loadMoreVideos(WORLD_CAFE);

  // Meanwhile two videos go in at the top, and the list is read again.
  replies[WORLD_CAFE] = [video(1001), video(1002), ...page(1, 46)];
  replies[`${WORLD_CAFE}@48`] = page(47, 48);
  await loadVideos({ force: true });
  assert.equal(section(WORLD_CAFE).offset, 96, "the new list ends at the same place");
  assert.equal(section(WORLD_CAFE).videos.at(-1).id, "94");

  release();
  await more;
  delete waits[`${WORLD_CAFE}@96`];
  assert.equal(section(WORLD_CAFE).videos.at(-1).id, "94", "the old page isn't added");
  assert.equal(section(WORLD_CAFE).more, true, "95 and 96 are still to come");
});
