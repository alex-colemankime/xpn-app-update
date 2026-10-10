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
