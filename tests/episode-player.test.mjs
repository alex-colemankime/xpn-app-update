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

// Real media elements settle play() later and deliver "pause" as a queued
// event; these hold both until the test lets them go.
function deferredSetup() {
  const ctx = setup();
  const { audio } = ctx;
  const plays = [];
  audio.play = function () {
    this.paused = false;
    this.plays++;
    let settle;
    const promise = new Promise((resolve, reject) => (settle = { resolve, reject }));
    plays.push(settle);
    return promise;
  };
  const queued = [];
  audio.pause = function () {
    this.paused = true;
    queued.push("pause");
  };
  const flushPauses = () => queued.splice(0).forEach((name) => audio.fire(name));
  return { ...ctx, plays, flushPauses };
}

const B = {
  ...EPISODE,
  id: "worldcafe-2",
  title: "Friko",
  audio: "https://audio.example.org/friko.mp3",
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("an older episode's play failing late doesn't touch the episode playing now", async () => {
  const { audio, player, plays } = deferredSetup();
  player.play(EPISODE);
  player.play(B);
  audio.fire("playing");
  // Replacing the file rejects the first play.
  plays[0].reject(Object.assign(new Error("interrupted"), { name: "AbortError" }));
  await tick();
  assert.equal(player.getState().episode.id, B.id);
  assert.equal(player.getState().status, "playing");
  assert.equal(audio.paused, false);
});

test("a late pause event from before the latest play is ignored", async () => {
  const { audio, player, flushPauses } = deferredSetup();
  player.play(EPISODE);
  audio.fire("playing");
  player.pause();
  player.resume();
  audio.fire("playing");
  flushPauses(); // the first pause, delivered after the resume
  assert.equal(player.getState().status, "playing");
});

test("a pause while playing is still starting calls the play off", async () => {
  const { player, plays } = deferredSetup();
  player.play(EPISODE);
  player.pause();
  plays[0].reject(Object.assign(new Error("interrupted"), { name: "AbortError" }));
  await tick();
  assert.equal(player.getState().status, "paused");
  assert.equal(player.getState().error, null);
});

function refreshSetup({ answer, needsRefresh = (ep) => !ep.fresh }) {
  const audio = new FakeAudio();
  const errors = [];
  let pending = [];
  const player = createEpisodePlayer({
    createAudio: () => audio,
    mediaSession: {
      setActionHandler() {},
      setMetadata() {},
      setPlaybackState() {},
      setPositionState() {},
    },
    onError: (reason) => errors.push(reason),
    needsRefresh: (ep) => needsRefresh(ep),
    refresh: (ep) =>
      new Promise((resolve, reject) => pending.push(() => answer(ep, resolve, reject))),
  });
  const answerAll = async () => {
    const now = pending;
    pending = [];
    now.forEach((fn) => fn());
    await tick();
  };
  return { audio, player, errors, answerAll };
}

test("an episode saved earlier gets a fresh link before it plays", async () => {
  const { audio, player, answerAll } = refreshSetup({
    answer: (ep, resolve) => resolve({ ...ep, audio: `${EPISODE.audio}?key=new`, fresh: true }),
  });
  // Saved without its link, which would have run out.
  const saved = { ...EPISODE, audio: "", fresh: false };
  player.play(saved, 120);
  assert.equal(player.getState().status, "loading", "the tap is answered at once");
  assert.equal(audio.getAttribute("src"), null, "nothing plays from an old link");
  await answerAll();
  assert.equal(audio.src, `${EPISODE.audio}?key=new`);
  assert.equal(player.getState().position, 120, "from its saved place");
  assert.equal(audio.plays, 1);
});

test("an episode no longer in the archive says so instead of playing", async () => {
  const { audio, player, errors, answerAll } = refreshSetup({
    answer: (_ep, _resolve, reject) => reject({ reason: "gone" }),
  });
  player.play({ ...EPISODE, fresh: false });
  await answerAll();
  assert.equal(player.getState().status, "error");
  assert.equal(player.getState().error, "gone");
  assert.deepEqual(errors, ["gone"]);
  assert.equal(audio.plays, 0);
});

test("a fresh link arriving after the listener moved on is ignored", async () => {
  const { audio, player, answerAll } = refreshSetup({
    answer: (ep, resolve) => resolve({ ...ep, fresh: true }),
  });
  player.play({ ...EPISODE, fresh: false });
  player.pause();
  await answerAll();
  assert.equal(player.getState().status, "paused");
  assert.equal(audio.plays, 0);
});

test("a link that runs out mid-listen is replaced and playback carries on", async () => {
  let expired = false;
  const { audio, player, errors, answerAll } = refreshSetup({
    answer: (ep, resolve) => resolve({ ...ep, audio: `${EPISODE.audio}?key=new` }),
    needsRefresh: (ep) => expired && ep.audio === EPISODE.audio,
  });
  player.play(EPISODE);
  audio.metadata(684);
  audio.fire("playing");
  audio.advanceTo(300);
  expired = true;
  audio.fire("error");
  await answerAll();
  assert.equal(audio.src, `${EPISODE.audio}?key=new`);
  assert.equal(player.getState().position, 300);
  assert.deepEqual(errors, []);
});

test("a paused episode resumes from its open file, without reading the archive again", async () => {
  let reads = 0;
  const { audio, player, answerAll } = refreshSetup({
    answer: (ep, resolve) => {
      reads++;
      resolve(ep);
    },
    // Its link has since grown old.
    needsRefresh: () => true,
  });
  player.play({ ...EPISODE });
  await answerAll();
  const before = reads;
  audio.metadata(684);
  audio.fire("playing");
  audio.advanceTo(200);
  player.pause();
  player.resume();
  assert.equal(reads, before, "no new read");
  assert.equal(audio.src, EPISODE.audio, "the same file continues");
  assert.equal(audio.currentTime, 200);
});

test("a real pause while buffering is respected", () => {
  const { audio, player } = setup();
  player.play(EPISODE);
  // Headphones unplugged before the first sound.
  audio.paused = true;
  audio.fire("pause");
  assert.equal(player.getState().status, "paused");
});

test("after a failure, trying again loads the file afresh", () => {
  const { audio, player } = setup();
  let loads = 0;
  audio.load = () => loads++;
  player.play(EPISODE);
  audio.error = { code: 2 };
  audio.fire("error");
  assert.equal(player.getState().status, "error");
  const before = loads;
  audio.error = null;
  player.play(EPISODE);
  assert.ok(loads > before, "the file is loaded again rather than replayed as it was");
  assert.equal(player.getState().status, "loading");
});
