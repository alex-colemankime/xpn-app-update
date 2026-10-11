// The player's policy key (videos.js): read once and shared, and read again
// when Brightcove refuses it because the player has replaced it, for a
// single video as for a playlist. Its own file, so the key starts unread.
import { test } from "node:test";
import assert from "node:assert/strict";

let key = "first";
let configReads = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.pathname.endsWith("config.json")) {
    configReads++;
    return new Response(JSON.stringify({ video_cloud: { policy_key: key } }), { status: 200 });
  }
  const sent = /pk=(.+)$/.exec(init.headers?.Accept || "")?.[1];
  if (sent !== key) return new Response("", { status: 403 });
  const id = u.pathname.split("/").pop();
  if (u.pathname.includes("/videos/")) {
    return new Response(JSON.stringify({ id, name: `Artist ${id} | Session`, tags: [] }));
  }
  return new Response(JSON.stringify({ videos: [{ id: "1", name: "A | B", tags: [] }] }));
};

const { fetchVideo, loadVideos } = await import("../videos.js");

test("opening a video after the player replaced its key reads the new key and plays", async () => {
  assert.equal((await fetchVideo("100")).id, "100");
  assert.equal(configReads, 1);
  key = "second"; // the player's key is replaced
  assert.equal((await fetchVideo("101")).id, "101", "the refused key is read again, once");
  assert.equal(configReads, 2);
  assert.equal((await fetchVideo("102")).id, "102");
  assert.equal(configReads, 2, "and kept");
});

test("playlists do the same", async () => {
  key = "third";
  await loadVideos({ force: true });
  assert.equal(configReads, 3);
});

test("a key refused even when just read gives up rather than asking forever", async () => {
  const real = globalThis.fetch;
  let videoRequests = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/videos/")) {
      videoRequests++;
      return new Response("", { status: 403 });
    }
    return real(url, init);
  };
  try {
    await assert.rejects(fetchVideo("103"));
    assert.equal(videoRequests, 2, "tried once more, no more");
  } finally {
    globalThis.fetch = real;
  }
});
