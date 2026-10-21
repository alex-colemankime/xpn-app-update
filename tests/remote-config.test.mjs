// Remote config (remote-config.js): only safe changes get through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { configFrom, normalizeConfig, versionBelow, updateNotice } from "../remote-config.js";
import { STREAMS, applyStreamOverrides } from "../streams.js";

test("stream addresses: https on WXPN's or StreamGuys' hosts only", () => {
  const config = normalizeConfig({
    streams: {
      xpn: { url: "https://wxpnhi.xpn.org/new-mount", backupUrl: "https://x.streamguys1.com/b" },
      xpn2: { url: "http://wxpnhi.xpn.org/plain-http" },
      homegrown: { url: "https://evil.example.com/stream" },
    },
  });
  assert.deepEqual(config.streams, {
    xpn: { url: "https://wxpnhi.xpn.org/new-mount", backupUrl: "https://x.streamguys1.com/b" },
  });
});

test("a changed address is used, and removing the change restores the built one", () => {
  const built = STREAMS.xpn.url;
  applyStreamOverrides({ xpn: { url: "https://wxpnhi.xpn.org/new-mount" } });
  assert.equal(STREAMS.xpn.url, "https://wxpnhi.xpn.org/new-mount");
  applyStreamOverrides({});
  assert.equal(STREAMS.xpn.url, built);
});

test("only known features can be turned off; an update needs a version", () => {
  const config = normalizeConfig({
    off: ["videos", "everything", "push"],
    update: { minVersion: "1.2", message: "Please update", required: true },
  });
  assert.deepEqual(config.off, ["videos", "push"]);
  assert.equal(config.update.minVersion, "1.2");
  assert.equal(config.update.required, true);
  assert.match(config.update.android, /play\.google\.com.*com\.jacobsmedia\.wxpn/);
  assert.equal(normalizeConfig({ update: { minVersion: "soon" } }).update, null);
});

test("versions compare by number", () => {
  assert.equal(versionBelow("1.0.0", "1.2"), true);
  assert.equal(versionBelow("1.10.0", "1.9.9"), false);
  assert.equal(versionBelow("1.2.0", "1.2"), false);
  assert.equal(versionBelow("2.0", "10.0"), true);
});

test("the config is found in the file or in an Advanced Ads ad", () => {
  assert.deepEqual(configFrom({ updates: [], config: { off: ["concerts"] } }).off, ["concerts"]);
  const ads = [
    { id: 1, content: "<p>The drive is on.</p>" },
    { id: 2, content: "<p>{“config”: {“off”: [“archive”]}}</p>" },
  ];
  assert.deepEqual(configFrom(ads).off, ["archive"]);
  // Read the same ways as the updates in an ad group: { ads: [...] }, and a
  // single ad (the REST address of one ad) with its content rendered.
  assert.deepEqual(configFrom({ ads }).off, ["archive"]);
  assert.deepEqual(configFrom({ id: 3, content: { rendered: ads[1].content } }).off, ["archive"]);
  assert.deepEqual(configFrom({ updates: [] }), { streams: {}, off: [], update: null });
});

test("store addresses must be the stores' own", () => {
  const config = normalizeConfig({
    update: { minVersion: "2", ios: "https://example.com/app", android: "https://evil.test/x" },
  });
  assert.equal(config.update.ios, "");
  assert.match(config.update.android, /^https:\/\/play\.google\.com\//);
  const apple = normalizeConfig({
    update: { minVersion: "2", ios: "https://apps.apple.com/app/id1" },
  });
  assert.equal(apple.update.ios, "https://apps.apple.com/app/id1");
});

test("a required update with nowhere to update from can still be set aside", () => {
  const request = {
    minVersion: "2.0.0",
    required: true,
    ios: "",
    android: "https://play.google.com/x",
  };
  const ask = (platform, dismissed = "") =>
    updateNotice({ request, platform, version: "1.0.0", dismissed });
  // Android has its store: required, and set aside does nothing.
  assert.deepEqual(ask("android", "2.0.0"), { store: "https://play.google.com/x", required: true });
  // iOS has none: a notice the listener can dismiss, and once dismissed it's gone.
  assert.deepEqual(ask("ios"), { store: "", required: false });
  assert.equal(ask("ios", "2.0.0"), null);
  // Up to date, or on the web: nothing.
  assert.equal(updateNotice({ request, platform: "ios", version: "2.0.0", dismissed: "" }), null);
  assert.equal(ask("web"), null);
});
