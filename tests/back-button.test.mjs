import { test } from "node:test";
import assert from "node:assert/strict";
import { backAction } from "../back-button.js";

test("Back closes what's open first, and never closes the app", () => {
  const at = (o) => backAction({ popoverOpen: false, dialogOpen: false, canGoBack: false, ...o });
  assert.equal(at({ popoverOpen: true, dialogOpen: true, canGoBack: true }), "close-menu");
  assert.equal(at({ dialogOpen: true, canGoBack: true }), "close-sheet");
  assert.equal(at({ canGoBack: true }), "back");
  assert.equal(at({}), "background", "at the start: to the background, still playing");
});
