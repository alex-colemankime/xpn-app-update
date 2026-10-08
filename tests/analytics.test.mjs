// Usage and crash reporting (analytics.js): queued until started, dropped
// when off, errors anonymous and reported once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalytics, describeError } from "../analytics.js";

test("events wait for the start, and are dropped while reporting is off", () => {
  const sent = [];
  let on = true;
  const a = createAnalytics({ send: (n, p) => sent.push([n, p]), enabled: () => on });
  a.track("page_view", { page_title: "Listen" });
  assert.equal(sent.length, 0, "not yet started");
  a.start();
  assert.deepEqual(sent, [["page_view", { page_title: "Listen" }]]);
  on = false;
  a.track("save", { item_type: "songs" });
  assert.equal(sent.length, 1, "off: nothing sent");
});

test("the same error is reported once a session", () => {
  const sent = [];
  const a = createAnalytics({ send: (n, p) => sent.push([n, p]) });
  a.start();
  a.error(new TypeError("x is undefined"), { where: "screen", fatal: true });
  a.error(new TypeError("x is undefined"), { where: "screen", fatal: true });
  assert.deepEqual(sent, [
    ["exception", { description: "screen: TypeError: x is undefined", fatal: true }],
  ]);
});

test("errors are described without addresses, emails or long numbers", () => {
  assert.equal(
    describeError(
      new Error("GET https://xpn.org/a?token=abc failed for jo@example.com id 1234567"),
    ),
    "Error: GET <url> failed for <email> id <n>",
  );
  assert.equal(describeError({ reason: { message: "boom" } }, "promise"), "promise: boom");
  assert.ok(describeError("x".repeat(500)).length <= 150);
});
