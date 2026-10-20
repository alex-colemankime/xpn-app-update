// Crash reporting (crash-reporting.js): stacks and steps as Crashlytics shows them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { breadcrumb, parseStack } from "../crash-reporting.js";

test("stacks from Android's and iOS's web views become frames, file names only", () => {
  const chrome = `TypeError: x is undefined
    at nowPlaying (https://localhost/assets/index-abc.js:12:345)
    at https://localhost/assets/index-abc.js?v=2:1:9`;
  const safari = `play@capacitor://localhost/assets/player-1.js:40:12
@capacitor://localhost/assets/index-abc.js:3:7`;
  assert.deepEqual(parseStack(chrome), [
    { functionName: "nowPlaying", fileName: "index-abc.js", lineNumber: 12, columnNumber: 345 },
    { functionName: "<anonymous>", fileName: "index-abc.js", lineNumber: 1, columnNumber: 9 },
  ]);
  assert.deepEqual(parseStack(safari), [
    { functionName: "play", fileName: "player-1.js", lineNumber: 40, columnNumber: 12 },
    { functionName: "<anonymous>", fileName: "index-abc.js", lineNumber: 3, columnNumber: 7 },
  ]);
  assert.deepEqual(parseStack(undefined), []);
});

test("an event is one short line, without the page address or empty values", () => {
  assert.equal(
    breadcrumb("page_view", { page_title: "Listen", page_location: "https://localhost/#/listen" }),
    "page_view page_title=Listen",
  );
  assert.equal(
    breadcrumb("play_station", { station: "xpn2", show: "" }),
    "play_station station=xpn2",
  );
});
