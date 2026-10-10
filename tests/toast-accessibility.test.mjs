import { test } from "node:test";
import assert from "node:assert/strict";
import { showToast, holdToast } from "../toast.js";

test("Undo clears itself too, given longer, and waits while it's in use", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", onClick() {} });
  assert.equal(timer.mock.callCount(), 1);
  assert.equal(timer.mock.calls[0].arguments[1], 8000);
  holdToast(true);
  assert.equal(timer.mock.callCount(), 1);
  holdToast(false);
  assert.equal(timer.mock.callCount(), 2);
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

test("a toast closed under the pointer doesn't stop the next one expiring", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", onClick() {} });
  holdToast(true); // pointer on it; its close key clears it, no pointer leave
  showToast("");
  showToast("Copied to clipboard.");
  assert.equal(timer.mock.calls.at(-1).arguments[1], 5000);
  showToast("");
});
