import { test } from "node:test";
import assert from "node:assert/strict";
import { showToast, holdToast } from "../toast.js";

test("Undo actions remain available without a time limit", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", brief: true, onClick() {} });
  holdToast(true);
  holdToast(false);
  assert.equal(timer.mock.callCount(), 0);
  showToast("");
});

test("informational notices still expire, with a pause while focused", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Copied to clipboard.");
  assert.equal(timer.mock.callCount(), 1);
  holdToast(true);
  assert.equal(timer.mock.callCount(), 1);
  holdToast(false);
  assert.equal(timer.mock.callCount(), 2);
  showToast("");
});
