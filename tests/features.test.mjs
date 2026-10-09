// Feature switches (features.js): the station's "off" list over the build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { featureSet } from "../features.js";

const built = { videos: true, concerts: true, archive: false, push: false, reviewPrompt: true };

test("a switched-off feature is off; others keep what the build has", () => {
  assert.deepEqual(featureSet(["videos"], built), {
    videos: false,
    concerts: true,
    archive: false,
    push: false,
    reviewPrompt: true,
  });
});

test("switching on can't add what the build doesn't have", () => {
  assert.equal(featureSet([], built).archive, false);
  assert.equal(featureSet([], built).push, false);
});

test("an empty or missing list leaves the build as it is", () => {
  assert.deepEqual(featureSet([], built), built);
  assert.deepEqual(featureSet(undefined, built), built);
});
