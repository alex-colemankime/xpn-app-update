// The station's archive switch (features.js) stops archive requests, not
// only the screens that show it.
import { test } from "node:test";
import assert from "node:assert/strict";

let requests = 0;
globalThis.fetch = async () => {
  requests++;
  return new Response("<rss></rss>", { status: 200 });
};

const { applySwitches } = await import("../features.js");
const { loadArchive } = await import("../archive.js");

test("switched off, the archive fetches nothing; back on, it loads", async () => {
  applySwitches(["archive"]);
  assert.equal(loadArchive({ force: true }), null);
  assert.equal(requests, 0);
  applySwitches([]);
  await loadArchive({ force: true });
  assert.ok(requests > 0);
});
