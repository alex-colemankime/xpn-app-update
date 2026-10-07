// Loading the video collections (videos.js): each collection keeps its own
// state, so an empty one says so, a failing one shows its own error, and a
// further page that fails is marked rather than dropped silently.
import { test } from "node:test";
import assert from "node:assert/strict";

const WORLD_CAFE = "1876180529963365406";
const WXPN = "1874727417810648125";
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

test("a collection that fails shows its own error while the other plays on", async () => {
  replies[WORLD_CAFE] = page(1, 3);
  await loadVideos({ force: true });
  assert.equal(section(WORLD_CAFE).status, "live");
  assert.equal(section(WORLD_CAFE).videos.length, 3);
  assert.equal(section(WXPN).status, "error", "nothing to show, and it says so");
  assert.equal(getVideos().complete, false, "so it is tried again soon");
});

test("an empty collection is empty, not loading forever", async () => {
  replies[WXPN] = [];
  await loadVideos({ force: true });
  assert.equal(section(WXPN).status, "live");
  assert.deepEqual(section(WXPN).videos, []);
});

test("a collection that fails to refresh keeps its list, marked as earlier", async () => {
  delete replies[WORLD_CAFE];
  await loadVideos({ force: true });
  assert.equal(section(WORLD_CAFE).status, "cache");
  assert.equal(section(WORLD_CAFE).videos.length, 3);
});

test("a further page that fails is marked, and can be tried again", async () => {
  replies[WORLD_CAFE] = page(1, 48); // a full page: there may be more
  await loadVideos({ force: true });
  assert.equal(section(WORLD_CAFE).more, true);
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).moreFailed, true);
  replies[`${WORLD_CAFE}@48`] = page(49, 4);
  await loadMoreVideos(WORLD_CAFE);
  assert.equal(section(WORLD_CAFE).moreFailed, false);
  assert.equal(section(WORLD_CAFE).videos.length, 52);
  assert.equal(section(WORLD_CAFE).more, false);
});

test("a refresh while a further page loads leaves no gap and keeps the list", async () => {
  // The WXPN collection, empty until now, gains a full history.
  replies[WXPN] = page(1, 48);
  await loadVideos({ force: true });
  replies[`${WXPN}@48`] = page(49, 48);
  await loadMoreVideos(WXPN);
  assert.equal(section(WXPN).videos.length, 96);
  // The last page is slow; meanwhile the app refreshes the first page.
  let release;
  waits[`${WXPN}@96`] = new Promise((resolve) => (release = resolve));
  replies[`${WXPN}@96`] = page(97, 4);
  const last = loadMoreVideos(WXPN);
  await loadVideos({ force: true });
  assert.equal(section(WXPN).videos.length, 96, "the refresh doesn't shrink the list");
  release();
  await last;
  const ids = section(WXPN).videos.map((v) => Number(v.id));
  assert.deepEqual(
    ids,
    Array.from({ length: 100 }, (_, i) => i + 1),
    "every video, in order, none missing",
  );
  assert.equal(section(WXPN).more, false);
});
