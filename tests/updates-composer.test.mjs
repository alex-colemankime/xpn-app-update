// The composer's publishing rules (tools/updates-composer.html, the
// "publish-rules" script) against the app's own modules and CI's check of
// the control file, so a file the composer publishes is one the app reads
// in full and CI lets through. The block is inline (the composer opens
// straight from the file, where browsers won't load modules), so it is read
// out of the page and run here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import prettier from "prettier";
import { normalizeUpdates } from "../updates.js";
import { normalizeConfig, FEATURES } from "../remote-config.js";

const html = readFileSync(new URL("../tools/updates-composer.html", import.meta.url), "utf8");
const block = /<script id="publish-rules">([\s\S]*?)<\/script>/.exec(html)[1];
// Node has the browser globals it uses (URL, TextEncoder, btoa).
const rules = new Function(`${block}\nreturn PublishRules;`)();

// tests/control-file.test.mjs, as a yes or no.
function ciAccepts(file) {
  try {
    const raw = file.updates || [];
    assert.ok(Array.isArray(raw));
    const kept = new Set(normalizeUpdates(file).map((u) => u.id));
    for (const u of raw) assert.ok(kept.has(u.id));
    assert.equal(new Set(raw.map((u) => u.id)).size, raw.length);
    const c = file.config || {};
    for (const f of c.off || []) assert.ok(FEATURES.includes(f));
    const config = normalizeConfig(c);
    for (const id of Object.keys(c.streams || {})) assert.ok(config.streams[id]);
    if (c.update) assert.ok(config.update);
    return true;
  } catch {
    return false;
  }
}

const banner = {
  id: "fall-drive-2026",
  kind: "banner",
  text: "The Fall Member Drive is on.",
  action: { label: "Donate", url: "https://xpn.org/donate/" },
  starts: "2026-10-05T06:00:00-04:00",
  ends: "2026-10-17T00:00:00-04:00",
  notify: [{ at: "2026-10-16T08:00:00-04:00", title: "Last day" }],
};
const live = {
  id: "fan-2026-10-09",
  kind: "live",
  title: "Free at Noon: Wesley Stace",
  watch: "https://www.youtube.com/watch?v=abcdefghijk",
  starts: "2026-10-09T12:00:00-04:00",
};

const files = {
  "both kinds": { updates: [banner, live] },
  empty: { updates: [], config: {} },
  "a banner with no text": { updates: [{ ...banner, text: " " }] },
  "a live video without a start": { updates: [{ ...live, starts: undefined }] },
  "a live video with an http link": { updates: [{ ...live, watch: "http://youtube.com/x" }] },
  "an unknown kind": { updates: [{ ...banner, kind: "popup" }] },
  "a bad date": { updates: [{ ...banner, ends: "next Tuesday" }] },
  "a number for an id": { updates: [{ ...banner, id: 5 }] },
  "an id the app shortens": { updates: [{ ...banner, id: "x".repeat(81) }] },
  "an id with spaces around it": { updates: [{ ...banner, id: " fall " }] },
  "two of one id": { updates: [banner, { ...banner }] },
  "features off": { updates: [], config: { off: ["videos", "archive"] } },
  "an unknown feature": { updates: [], config: { off: ["radio"] } },
  "a StreamGuys stream": {
    updates: [],
    config: { streams: { xpn: { url: "https://wxpnhi.xpn.org/xpnhi" } } },
  },
  "a stream elsewhere": {
    updates: [],
    config: { streams: { xpn: { url: "https://example.com/xpn" } } },
  },
  "an update request": { updates: [], config: { update: { minVersion: "1.2.0" } } },
  "an update request without a version": {
    updates: [],
    config: { update: { message: "Update" } },
  },
};

test("publishes exactly what CI accepts (the composer may be stricter, never looser)", () => {
  for (const [name, file] of Object.entries(files)) {
    const ok = rules.fileProblems(file).length === 0;
    if (!ciAccepts(file)) assert.equal(ok, false, `${name}: CI refuses it, so publishing must`);
    else assert.equal(ok, true, `${name}: CI takes it, and so should publishing`);
  }
});

test("stricter than CI only where the app would quietly drop something", () => {
  const backup = { url: "https://wxpnhi.xpn.org/xpnhi", backupUrl: "https://example.com/" };
  assert.equal(ciAccepts({ config: { streams: { xpn: backup } } }), true);
  assert.notEqual(rules.fileProblems({ config: { streams: { xpn: backup } } }).length, 0);
  const ios = { minVersion: "1.2", ios: "https://example.com/app" };
  assert.notEqual(rules.fileProblems({ config: { update: ios } }).length, 0);
});

test("the kept id is the app's", () => {
  for (const u of [banner, live, { ...banner, id: "  a  b " }]) {
    assert.equal(rules.keptId(u), normalizeUpdates({ updates: [u] })[0]?.id ?? null);
  }
});

test("changes: by id, ignoring how a time is written and key order", () => {
  const moved = { ...banner, starts: "2026-10-05T10:00:00Z", text: banner.text };
  const reordered = Object.fromEntries(Object.entries(moved).reverse());
  assert.equal(rules.changes({ updates: [banner] }, { updates: [reordered] }).none, true);

  const edited = { ...banner, text: "Last day of the drive." };
  const added = { ...live, id: "fan-2026-10-16" };
  const ch = rules.changes(
    { updates: [banner, live], config: { off: ["videos"] } },
    { updates: [edited, added], config: { off: ["archive"] } },
  );
  assert.deepEqual(
    [ch.added, ch.changed, ch.removed].map((l) => l.map((u) => u.id)),
    [["fan-2026-10-16"], ["fall-drive-2026"], ["fan-2026-10-09"]],
  );
  assert.deepEqual(ch.switches, ["turns off archive", "turns videos back on"]);
  assert.equal(ch.none, false);

  const swapped = rules.changes({ updates: [banner, live] }, { updates: [live, banner] });
  assert.equal(swapped.reordered, true);
  assert.equal(rules.changes({ updates: [] }, { updates: [], config: {} }).none, true);
});

test("the commit message names the changes, briefly", () => {
  const ch = rules.changes({ updates: [banner] }, { updates: [live] });
  const message = rules.commitMessage(ch);
  assert.equal(
    message.split("\n")[0],
    "Station updates: add fan-2026-10-09; remove fall-drive-2026",
  );
  const many = rules.changes(
    { updates: [] },
    { updates: [1, 2, 3, 4].map((n) => ({ ...live, id: `free-at-noon-week-${n}` })) },
  );
  const subject = rules.commitMessage(many).split("\n")[0];
  assert.equal(subject, "Station updates: 4 added");
  assert.match(rules.commitMessage(many), /free-at-noon-week-4/);
});

test("the saved file is laid out as Prettier would, so CI's format check passes", async () => {
  const long = { off: [...FEATURES, ...FEATURES] };
  const exact = (n) => ({ k: ["x".repeat(n)] }); // around the 100-column edge
  for (const value of [
    { updates: [banner, live], config: { off: ["videos", "archive"], streams: {} } },
    { updates: [], config: {} },
    { config: long, updates: [] },
    ...[86, 87, 88, 89, 90].map(exact),
    { a: { b: { c: ["one", "two"] }, d: [] }, e: '’quotes’ and "escapes"' },
  ]) {
    const ours = rules.prettyJson(value);
    const theirs = await prettier.format(JSON.stringify(value, null, 2), {
      parser: "json",
      printWidth: 100,
    });
    assert.equal(ours, theirs);
  }
});

test("base64 both ways keeps every character", () => {
  const s = "Fall Member Drive — there’s still time. 🎶\n";
  assert.equal(rules.fromBase64(rules.toBase64(s)), s);
  assert.equal(rules.toBase64(s), Buffer.from(s).toString("base64"));
  // GitHub wraps its base64 at 60 columns.
  const wrapped = Buffer.from(s.repeat(5))
    .toString("base64")
    .replace(/(.{60})/g, "$1\n");
  assert.equal(rules.fromBase64(wrapped), s.repeat(5));
});
