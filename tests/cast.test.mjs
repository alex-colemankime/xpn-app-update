import { test } from "node:test";
import assert from "node:assert/strict";
import { castKind, promptCast } from "../cast.js";

const airplay = { webkitShowPlaybackTargetPicker: () => "airplay picker" };
const chrome = { remote: { prompt: async () => "cast picker" } };

test("Apple devices get AirPlay, Chrome gets Cast, others nothing", () => {
  assert.equal(castKind(airplay), "airplay");
  assert.equal(castKind(chrome), "cast");
  // Safari has both; its picker is AirPlay.
  assert.equal(castKind({ ...airplay, ...chrome }), "airplay");
  assert.equal(castKind({}), null);
  assert.equal(castKind(null), null);
});

test("the picker opens for the element it's given", async () => {
  assert.equal(await promptCast(airplay), "airplay picker");
  assert.equal(await promptCast(chrome), "cast picker");
  await assert.rejects(promptCast({}));
});
