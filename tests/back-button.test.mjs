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

test("Back from a sheet the address opened steps back one entry", () => {
  const at = (o) => backAction({ popoverOpen: false, dialogOpen: true, canGoBack: true, ...o });
  assert.equal(at({ routedDepth: 2 }), "back", "a host opened from a show: back to the show");
  assert.equal(at({ routedDepth: 1 }), "back");
  assert.equal(at({ routedDepth: 0 }), "close-sheet", "opened from a link: closes in place");
  assert.equal(at({}), "close-sheet", "any other sheet: as Escape");
});
