import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeWindow } from "./fake-window.mjs";

// The Space key plays and pauses whatever the player bar holds: an archive
// episode while it has the bar, otherwise the station (episode-player.js,
// togglePlayer). Before, Space always meant the station, so pressing it
// during an episode started the radio instead of pausing the episode.
fakeWindow();
globalThis.Audio = class {
  constructor() {
    this.attrs = {};
    this.listeners = {};
    this.paused = true;
    this.ended = false;
    this.error = null;
    this.currentTime = 0;
    this.duration = NaN;
    this.readyState = 0;
    this.volume = 1;
  }
  set src(value) {
    this.attrs.src = value;
  }
  get src() {
    return this.attrs.src || "";
  }
  getAttribute(name) {
    return this.attrs[name] ?? null;
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  addEventListener(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }
  play() {
    this.paused = false;
    queueMicrotask(() => (this.listeners.playing || []).forEach((fn) => fn()));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
};

const { closeEpisode, getEpisodeState, playEpisode, togglePlayer } =
  await import("../episode-player.js");
const { getFocus, getPlayerSnapshot } = await import("../player.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const episode = {
  id: "worldcafe-test",
  show: "worldcafe",
  title: "Friday, October 9",
  audio: "https://wxpn.example/episode.mp3",
  date: "2026-10-09T16:00:00.000Z",
  duration: 3600,
  fetchedAt: Date.now(), // a fresh link: no reading the show's page first
};

test("Space pauses and resumes the episode that has the bar, never the radio", async () => {
  playEpisode(episode);
  await settle();
  assert.equal(getFocus(), "episode");
  assert.equal(getEpisodeState().status, "playing");

  togglePlayer();
  assert.equal(getEpisodeState().status, "paused", "the episode paused");
  assert.equal(getPlayerSnapshot().status, "paused", "the radio stayed off");
  assert.equal(getFocus(), "episode", "the episode keeps the bar");

  togglePlayer();
  await settle();
  assert.equal(getEpisodeState().status, "playing", "and resumed");
  assert.equal(getPlayerSnapshot().playing, false);
});

test("with the episode put away, Space plays the station", async () => {
  closeEpisode();
  assert.equal(getFocus(), "live");
  togglePlayer();
  await settle();
  assert.equal(getPlayerSnapshot().status, "playing");
  togglePlayer();
  assert.equal(getPlayerSnapshot().status, "paused");
});
