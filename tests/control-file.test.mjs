// The control file phone apps read (control/updates.json): every push checks
// it, so a typo can't reach listeners. Anything the app would quietly drop
// fails here instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeUpdates } from "../updates.js";
import { normalizeConfig, FEATURES } from "../remote-config.js";

const file = JSON.parse(readFileSync(new URL("../control/updates.json", import.meta.url), "utf8"));

test("control/updates.json: every update is complete", () => {
  const raw = file.updates || [];
  assert.ok(Array.isArray(raw), '"updates" is a list');
  const ok = normalizeUpdates(file);
  const kept = new Set(ok.map((u) => u.id));
  for (const u of raw) assert.ok(kept.has(u.id), `update "${u.id}" is incomplete or malformed`);
  assert.equal(new Set(raw.map((u) => u.id)).size, raw.length, "ids are unique");
});

test("control/updates.json: the switches are all ones the app knows", () => {
  const raw = file.config || {};
  for (const f of raw.off || []) assert.ok(FEATURES.includes(f), `unknown feature "${f}"`);
  const config = normalizeConfig(raw);
  for (const id of Object.keys(raw.streams || {})) {
    assert.ok(config.streams[id], `stream "${id}": https on xpn.org or StreamGuys only`);
  }
  if (raw.update) assert.ok(config.update, 'update needs a "minVersion" like "1.2.0"');
});

test("the default address is where the deploy publishes the file", async () => {
  const { UPDATES_DEFAULT, updatesUrl } = await import("../config.js");
  assert.match(UPDATES_DEFAULT, /\/xpn-app-update\/updates\.json$/);
  assert.equal(updatesUrl(undefined, true), UPDATES_DEFAULT);
  assert.equal(updatesUrl("off", true), "");
  assert.equal(updatesUrl(undefined, false), "", "development and the preview use samples");
});
