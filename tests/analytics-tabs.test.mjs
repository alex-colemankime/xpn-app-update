// Reporting switched off in one tab of the web app stops Google's tag in the
// others too, not only the app's own events.
import { test } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
const listeners = [];
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener: (type, fn) => type === "storage" && listeners.push(fn),
  gtag: () => {},
};
// Another tab writing the setting: the browser tells this one.
const otherTab = (key, value) => {
  memory.set(key, JSON.stringify(value));
  listeners.forEach((fn) => fn({ key }));
};

const { followReportingInOtherTabs, reportingStore } = await import("../analytics.js");

test("another tab switching reporting off and on sets Google's own switch here", () => {
  const id = "G-TABS";
  let configured = 0;
  followReportingInOtherTabs({ id, configure: () => configured++ });
  otherTab("xpn.analytics", { on: false });
  assert.equal(reportingStore.getSnapshot().on, false);
  assert.equal(globalThis.window[`ga-disable-${id}`], true, "gtag's own collection stops");
  otherTab("xpn.analytics", { on: true });
  assert.equal(globalThis.window[`ga-disable-${id}`], false);
  assert.equal(configured, 1, "and picks up the other tab's fresh id");
  otherTab("xpn.volume", 40);
  assert.equal(configured, 1, "other settings leave it alone");
});
