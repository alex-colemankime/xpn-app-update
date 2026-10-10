// Settings › Share app usage: off forgets this install's id; on again
// configures a fresh one, even with gtag already loaded this session.
import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
const configs = [];
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
  // gtag already loaded, as it is after launch with reporting on.
  gtag: (...args) => args[0] === "config" && configs.push(args[2]),
};

const { configureGtag, setReporting } = await import("../analytics.js");
const client = () => JSON.parse(memory.get("xpn.analytics.client") ?? "null");

test("reporting off then on gets a new anonymous id, configured into gtag", () => {
  configureGtag("G-TEST");
  const first = client();
  assert.ok(first);
  setReporting(false, { id: "G-TEST" });
  assert.equal(client(), null, "off forgets the id");
  setReporting(true, { id: "G-TEST" });
  const second = client();
  assert.ok(second, "on again makes one");
  assert.notEqual(second, first);
  assert.equal(configs.at(-1).client_id, second, "and gtag uses it");
});
