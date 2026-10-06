import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayer, RETRY_DELAYS_MS, fadeLevel, SLEEP_FADE_MS } from "../player-core.js";
import { STREAMS } from "../streams.js";

// A minimal HTMLAudioElement: records the source, exposes pending play()
// promises so a test decides when (and whether) audio starts, and lets the
// test fire media events by name.
class FakeAudio {
  constructor() {
    this.listeners = {};
    this.paused = true;
    this.currentTime = 0;
    this.attrs = {};
    this.pending = [];
  }
  set src(value) {
    this.attrs.src = value;
  }
  get src() {
    return this.attrs.src || "";
  }
  addEventListener(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }
  fire(name) {
    for (const fn of this.listeners[name] || []) fn();
  }
  getAttribute(name) {
    return this.attrs[name] ?? null;
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }
  pause() {
    this.paused = true;
    this.fire("pause");
  }
  load() {
    this.ended = false;
  }
  // What a browser does when a live stream's server closes the connection:
  // "pause" and then "ended", in that order (HTML spec).
  serverCloses() {
    this.ended = true;
    this.paused = true;
    this.fire("pause");
    this.fire("ended");
  }
}

// Real browsers queue the "pause" event instead of firing it inside pause().
class AsyncPauseAudio extends FakeAudio {
  pause() {
    if (this.paused) return;
    this.paused = true;
    queueMicrotask(() => this.fire("pause"));
  }
}

// Timers the test advances by hand.
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = until;
    },
    get pendingTimers() {
      return timers.size;
    },
  };
}

function harness(Audio = FakeAudio) {
  const clock = fakeClock();
  const actions = {};
  const metadata = [];
  const player = createPlayer({
    createAudio: () => new Audio(),
    mediaSession: {
      setActionHandler: ({ action }, fn) => (actions[action] = fn),
      setPlaybackState() {},
      setMetadata: (m) => metadata.push(m),
    },
    streams: STREAMS,
    initialStreamId: "xpn",
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  const playing = [];
  const status = [];
  const audio = player.init(
    (v) => playing.push(v),
    (v) => status.push(v),
  );
  const flush = () => new Promise((r) => setImmediate(r));
  return { player, audio, clock, actions, metadata, playing, status, flush, last: (a) => a.at(-1) };
}

test("play waits for audio before reporting playing; pause detaches the stream", () => {
  const h = harness();
  assert.equal(h.audio.preload, "none");
  h.actions.play();
  assert.equal(h.last(h.status), "loading");
  assert.equal(h.audio.src, STREAMS.xpn.url);
  assert.notEqual(h.last(h.playing), true);
  h.audio.fire("playing");
  assert.equal(h.last(h.status), "playing");
  assert.equal(h.last(h.playing), true);
  h.actions.pause();
  assert.equal(h.audio.getAttribute("src"), null);
  assert.equal(h.last(h.status), "paused");
  assert.equal(h.last(h.playing), false);
  h.actions.play();
  assert.equal(h.audio.src, STREAMS.xpn.url, "play reconnects to the live mount");
  h.actions.stop();
  assert.equal(h.audio.getAttribute("src"), null);
});

test("a dropped stream reconnects on a backoff and recovers", async () => {
  const h = harness();
  h.player.play();
  h.audio.fire("playing");
  h.audio.fire("error"); // network drop mid-listen
  assert.equal(h.last(h.status), "reconnecting");
  assert.equal(h.last(h.playing), false);
  h.clock.advance(RETRY_DELAYS_MS[0] - 1);
  assert.equal(h.audio.pending.length, 1, "no retry before the delay");
  h.clock.advance(1);
  assert.equal(h.audio.pending.length, 2, "retried after the first delay");
  assert.equal(h.last(h.status), "reconnecting");
  h.audio.fire("playing");
  assert.equal(h.last(h.status), "playing");
  // A later drop starts the backoff from the beginning again.
  h.audio.serverCloses();
  assert.equal(h.last(h.status), "reconnecting", "a server close is not an external pause");
  h.clock.advance(RETRY_DELAYS_MS[0]);
  assert.equal(h.audio.pending.length, 3);
});

test("retries alternate with the station's backup mount", () => {
  const h = harness();
  h.player.play();
  assert.equal(h.audio.src, STREAMS.xpn.url);
  h.audio.fire("error");
  h.clock.advance(RETRY_DELAYS_MS[0]);
  assert.equal(h.audio.src, STREAMS.xpn.backupUrl, "first retry tries the backup");
  h.audio.fire("error");
  h.clock.advance(RETRY_DELAYS_MS[1]);
  assert.equal(h.audio.src, STREAMS.xpn.url, "then the main mount again");
  h.audio.fire("playing");
  h.player.pause();
  h.player.play();
  assert.equal(h.audio.src, STREAMS.xpn.url, "a fresh play starts on the main mount");
});

test("every station has a distinct HTTPS backup mount", () => {
  for (const s of Object.values(STREAMS)) {
    assert.match(s.backupUrl, /^https:\/\//);
    assert.notEqual(s.backupUrl, s.url);
  }
});

test("retries stop with an error once the backoff is exhausted", async () => {
  const h = harness();
  h.player.play();
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    h.audio.pending.at(-1).reject(new Error("network"));
    await h.flush();
    h.clock.advance(RETRY_DELAYS_MS[i] ?? 0);
  }
  assert.equal(h.last(h.status), "error");
  assert.equal(h.last(h.playing), false);
  assert.equal(h.audio.getAttribute("src"), null, "gave up and stopped buffering");
  assert.equal(h.audio.pending.length, RETRY_DELAYS_MS.length + 1);
  assert.equal(h.clock.pendingTimers, 0);
});

test("a stall only triggers a reconnect when audio has stopped advancing", () => {
  const h = harness();
  h.player.play();
  h.audio.fire("playing");
  // Healthy playback that still fires "stalled" (Safari does this).
  h.audio.fire("stalled");
  h.audio.currentTime = 30;
  h.clock.advance(20000);
  assert.equal(h.audio.pending.length, 1, "advancing audio is left alone");
  assert.equal(h.last(h.status), "playing");
  // A real stall: waiting, and currentTime frozen.
  h.audio.fire("waiting");
  assert.equal(h.last(h.status), "loading");
  h.clock.advance(20000);
  assert.equal(h.last(h.status), "reconnecting");
});

test("a pause from outside the app is respected, not fought", () => {
  const h = harness();
  h.player.play();
  h.audio.fire("playing");
  h.audio.pause(); // e.g. an incoming phone call
  assert.equal(h.last(h.status), "paused");
  h.audio.fire("error");
  h.clock.advance(60000);
  assert.equal(h.audio.pending.length, 1, "no reconnect after an external pause");
});

test("the app's own pauses never read as an outside pause, even when the event arrives late", async () => {
  const h = harness(AsyncPauseAudio);
  h.player.play();
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    h.audio.pending.at(-1).reject(new Error("network"));
    await h.flush();
    h.clock.advance(RETRY_DELAYS_MS[i] ?? 0);
  }
  await h.flush();
  assert.equal(h.last(h.status), "error", "giving up stays an error");
  // A listener's pause is still reported once, as paused.
  h.player.play();
  h.audio.fire("playing");
  h.player.pause();
  await h.flush();
  assert.equal(h.last(h.status), "paused");
  // And an outside pause (a phone call) is still respected.
  h.player.play();
  h.audio.fire("playing");
  h.audio.pause();
  await h.flush();
  assert.equal(h.last(h.status), "paused");
  h.clock.advance(60000);
  assert.equal(h.last(h.status), "paused", "no reconnect after an outside pause");
});

test("autoplay refusal is reported as blocked and not retried", async () => {
  const h = harness();
  h.player.play();
  const refusal = new Error("play() requires a user gesture");
  refusal.name = "NotAllowedError";
  h.audio.pending[0].reject(refusal);
  await h.flush();
  assert.equal(h.last(h.status), "blocked");
  h.clock.advance(60000);
  assert.equal(h.audio.pending.length, 1);
});

test("station changes supersede in-flight attempts and keep paused state", async () => {
  const h = harness();
  h.player.play();
  assert.equal(h.player.setStream("xpn2"), true);
  assert.equal(h.audio.src, STREAMS.xpn2.url);
  h.audio.pending[0].reject(new Error("superseded"));
  await h.flush();
  assert.notEqual(h.last(h.status), "reconnecting", "stale failure ignored");
  h.player.pause();
  h.audio.pending[1].reject(new Error("cancelled"));
  await h.flush();
  assert.equal(h.last(h.status), "paused");
  h.player.setStream("xpn2");
  assert.equal(h.audio.getAttribute("src"), null, "switching while paused does not connect");
  assert.equal(h.player.setStream("nope"), false);
});

test("buffering during a retry still reads as reconnecting", () => {
  const h = harness();
  h.player.play();
  h.audio.fire("error");
  h.clock.advance(RETRY_DELAYS_MS[0]);
  h.audio.fire("waiting");
  assert.equal(h.last(h.status), "reconnecting");
});

test("switching station after a failure clears the old error", async () => {
  const h = harness();
  const refusal = new Error("gesture needed");
  refusal.name = "NotAllowedError";
  h.player.play();
  h.audio.pending[0].reject(refusal);
  await h.flush();
  assert.equal(h.last(h.status), "blocked");
  h.player.setStream("xpn2");
  assert.equal(h.last(h.status), "paused");
});

test("coming back online skips the remaining backoff", () => {
  const h = harness();
  h.player.play();
  h.audio.fire("error");
  h.clock.advance(RETRY_DELAYS_MS[0]);
  h.audio.fire("error");
  assert.equal(h.audio.pending.length, 2);
  h.player.resume();
  assert.equal(h.audio.pending.length, 3, "reconnected immediately");
});

test("volume stays within audio limits", () => {
  const h = harness();
  h.player.setVolume(500);
  assert.equal(h.audio.volume, 1);
  h.player.setVolume(-20);
  assert.equal(h.audio.volume, 0);
  h.player.setVolume(70);
  assert.equal(h.audio.volume, 0.7);
});

test("lock-screen metadata follows the song and falls back to the station", () => {
  const h = harness();
  h.player.setMetadata({ title: "Coast", artist: "Kim Deal", album: "Nobody", img: "x.jpg" });
  assert.deepEqual(
    { title: h.last(h.metadata).title, artist: h.last(h.metadata).artist },
    { title: "Coast", artist: "Kim Deal" },
  );
  h.player.setStream("xpn2");
  assert.equal(h.last(h.metadata).title, "XPN2", "a new station clears the old song");
});

test("the sleep timer fades over its last 20 seconds, then reaches silence", () => {
  assert.equal(fadeLevel(60000), 1);
  assert.equal(fadeLevel(SLEEP_FADE_MS), 1, "full volume until the fade starts");
  assert.equal(fadeLevel(SLEEP_FADE_MS / 2), 0.5);
  assert.equal(fadeLevel(0), 0);
  assert.equal(fadeLevel(-500), 0);
});
