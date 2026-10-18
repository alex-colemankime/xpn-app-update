import { test } from "node:test";
import assert from "node:assert/strict";
import { getToast, showToast, holdToast } from "../toast.js";

test("Undo is a small pill that goes quickly, and waits while it's in use", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", onClick() {} });
  assert.equal(timer.mock.callCount(), 1);
  assert.equal(timer.mock.calls[0].arguments[1], 3000);
  holdToast(true);
  assert.equal(timer.mock.callCount(), 1);
  holdToast(false);
  assert.equal(timer.mock.callCount(), 2);
  showToast("");
});

test("a longer notice with an action is a bar, given longer", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast(
    { title: "World Cafe starts in 5 minutes", text: "Raina Douris" },
    { label: "Listen", onClick() {} },
  );
  assert.equal(timer.mock.calls.at(-1).arguments[1], 4500);
  showToast("To ring on time, WXPN needs Alarms & reminders turned on.", {
    label: "Turn on",
    onClick() {},
  });
  assert.equal(timer.mock.calls.at(-1).arguments[1], 4500);
  showToast("");
});

test("informational notices still expire, with a pause while focused", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Copied to clipboard.");
  assert.equal(timer.mock.callCount(), 1);
  assert.equal(timer.mock.calls[0].arguments[1], 2000);
  holdToast(true);
  assert.equal(timer.mock.callCount(), 1);
  holdToast(false);
  assert.equal(timer.mock.callCount(), 2);
  showToast("Couldn’t connect to Spotify. Please try again in a moment or two.");
  assert.equal(timer.mock.calls.at(-1).arguments[1], 3000);
  showToast("");
});

test("a toast closed under the pointer doesn't stop the next one expiring", (t) => {
  const timer = t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", onClick() {} });
  holdToast(true); // pointer on it; Undo clears it, with no pointer leave
  showToast("");
  showToast("Copied to clipboard.");
  assert.equal(timer.mock.calls.at(-1).arguments[1], 2000);
  showToast("");
});

test("only a short line without a title or picture is a pill", (t) => {
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  showToast("Removed from Favorites", { label: "Undo", onClick() {} });
  assert.equal(getToast().brief, true);
  showToast("Notifications are off for WXPN. You can allow them in your phone’s Settings.");
  assert.equal(getToast().brief, false);
  showToast({ title: "Saved to Favorites", text: "Your songs are kept there." });
  assert.equal(getToast().brief, false);
  showToast({ text: "Free at Noon", image: "https://example.com/a.jpg" });
  assert.equal(getToast().brief, false);
  showToast("");
  assert.equal(getToast().brief, false);
});
