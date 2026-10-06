import { test } from "node:test";
import assert from "node:assert/strict";
import { createEpisodePlayer, resumeAt, SKIP_AHEAD_S, SKIP_BACK_S } from "../episode-core.js";

// A minimal on-demand <audio>: a test fires media events by name and moves
// the playhead itself.
class FakeAudio {
  constructor() {
    this.listeners = {};
    this.attrs = {};
    this.paused = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = NaN;
    this.readyState = 0;
    this.plays = 0;
  }
  set src(value) {
    this.attrs.src = value;
    this.readyState = 0;
    this.currentTime = 0;
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
  fire(name) {
    for (const fn of this.listeners[name] || []) fn();
  }
  load() {}
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.fire("pause");
  }
  // The file's header arrives: its length is known and it can seek.
  metadata(duration) {
    this.duration = duration;
    this.readyState = 1;
    this.fire("loadedmetadata");
  }
  advanceTo(seconds) {
    this.currentTime = seconds;
    this.fire("timeupdate");
  }
}

function setup() {
  const audio = new FakeAudio();
  const actions = {};
  const metadata = [];
  const saved = [];
  let starts = 0;
  let clock = 0;
  const player = createEpisodePlayer({
    createAudio: () => audio,
    mediaSession: {
      setActionHandler: ({ action }, fn) => (actions[action] = fn),
      setMetadata: (m) => metadata.push(m),
      setPlaybackState: () => {},
      setPositionState: () => {},
    },
    onProgress: (id, place) => saved.push({ id, ...place }),
    onStart: () => starts++,
    now: () => (clock += 1000),
  });
  return { audio, actions, metadata, saved, player, starts: () => starts };
}

const EPISODE = {
  id: "worldcafe-1",
  title: "Before the Breakthrough: Los Lobos",
  showName: "World Cafe",
  audio: "https://audio.example.org/los-lobos.mp3",
  image: "https://media.example.org/los-lobos.jpg",
  duration: 684,
};

test("an episode plays, keeps its place when paused, and resumes there", () => {
  const { audio, actions, metadata, saved, player, starts } = setup();
  player.play(EPISODE);
  assert.equal(audio.src, EPISODE.audio);
  assert.equal(player.getState().status, "loading");
  assert.equal(starts(), 1, "the station is told to step aside");
  assert.equal(metadata.at(-1).title, EPISODE.title);
  assert.equal(metadata.at(-1).artist, "World Cafe");
  assert.ok(
    actions.seekto && actions.seekforward && actions.seekbackward,
    "the lock screen can seek",
  );

  audio.metadata(684);
  audio.fire("playing");
  assert.equal(player.getState().status, "playing");
  assert.equal(player.getState().duration, 684);
  audio.advanceTo(120);
  assert.equal(player.getState().position, 120);

  player.pause();
  assert.equal(player.getState().status, "paused");
  assert.deepEqual(saved.at(-1), { id: EPISODE.id, at: 120, of: 684, done: false });
  // The source stays attached: resuming continues, it doesn't reload.
  assert.equal(audio.src, EPISODE.audio);
  player.resume();
  assert.equal(audio.currentTime, 120);
  assert.equal(audio.plays, 2);
});

test("seeking and skipping stay inside the episode", () => {
  const { audio, actions, player } = setup();
  player.play(EPISODE);
  audio.metadata(684);
  audio.fire("playing");
  audio.advanceTo(10);
  player.skip(-SKIP_BACK_S);
  assert.equal(audio.currentTime, 0, "no further back than the start");
  player.skip(SKIP_AHEAD_S);
  assert.equal(audio.currentTime, SKIP_AHEAD_S);
  player.seek(10_000);
  assert.ok(audio.currentTime < 684, "no further than the end");
  actions.seekto({ seekTime: 300 });
  assert.equal(audio.currentTime, 300);
});

test("a saved place is applied once the file can seek", () => {
  const { audio, player } = setup();
  player.play(EPISODE, 250);
  assert.equal(audio.currentTime, 0, "not seekable before its metadata arrives");
  assert.equal(player.getState().position, 250, "but the place shows at once");
  audio.metadata(684);
  assert.equal(audio.currentTime, 250);
});

test("an episode played to the end is marked done, and plays again from the top", () => {
  const { audio, saved, player } = setup();
  player.play(EPISODE);
  audio.metadata(684);
  audio.fire("playing");
  audio.advanceTo(684);
  audio.ended = true;
  audio.fire("ended");
  assert.equal(player.getState().status, "ended");
  assert.equal(saved.at(-1).done, true);
  player.play(EPISODE);
  assert.equal(audio.currentTime, 0);
  assert.equal(player.getState().status, "loading");
});

test("closing an episode stops it and frees the audio", () => {
  const { audio, player } = setup();
  player.play(EPISODE);
  audio.metadata(684);
  audio.fire("playing");
  player.stop();
  assert.equal(player.getState().episode, null);
  assert.equal(player.getState().status, "idle");
  assert.equal(audio.getAttribute("src"), null);
});

test("where an episode resumes", () => {
  assert.equal(resumeAt(null, 600), 0);
  assert.equal(resumeAt({ at: 300, of: 600 }, 600), 300);
  assert.equal(resumeAt({ at: 5, of: 600 }, 600), 0, "a few seconds in starts over");
  assert.equal(resumeAt({ at: 590, of: 600 }, 600), 0, "nearly finished starts over");
  assert.equal(resumeAt({ at: 300, of: 600, done: true }, 600), 0);
});
