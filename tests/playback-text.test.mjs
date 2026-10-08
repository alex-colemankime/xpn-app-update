import { test } from "node:test";
import assert from "node:assert/strict";
import { playbackText, statusLine } from "../playback-text.js";
import { STREAMS } from "../streams.js";

const station = STREAMS.xpn;

test("the play control always says what a tap will do", () => {
  assert.equal(playbackText({ status: "paused", playing: false, station }).button, "Listen live");
  assert.equal(playbackText({ status: "playing", playing: true, station }).label, "Pause WXPN");
  assert.equal(playbackText({ status: "loading", playing: false, station }).badge, "Connecting");
  assert.equal(playbackText({ status: "error", playing: false, station }).button, "Try again");
});

test("the status line speaks up only when something needs saying", () => {
  const ready = { status: "ready" };
  assert.equal(statusLine({ status: "paused", streamId: "xpn" }, ready), "");
  assert.equal(statusLine({ status: "playing", streamId: "xpn" }, ready), "");
  assert.match(statusLine({ status: "error", streamId: "xpn" }, ready), /could not connect/);
  assert.match(statusLine({ status: "blocked", streamId: "xpn" }, ready), /Tap Listen live/);
  assert.match(
    statusLine({ status: "playing", streamId: "xpn", playing: true }, { status: "unavailable" }),
    /music keeps playing/,
  );
  assert.match(
    statusLine({ status: "paused", streamId: "xpn", playing: false }, { status: "unavailable" }),
    /can still listen live/,
  );
  assert.equal(
    statusLine({ status: "playing", streamId: "homegrown" }, { status: "unavailable" }),
    "",
  );
  assert.doesNotMatch(statusLine({ status: "blocked", streamId: "xpn" }, ready), /browser/i);
});
