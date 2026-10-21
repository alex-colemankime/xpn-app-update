import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { fakeWindow } from "./fake-window.mjs";

// player.js against a fake <audio>, so the sleep timer's volume handling can
// be checked end to end.
const memory = fakeWindow({ storage: [["xpn.volume", "70"]] });
const audios = [];
globalThis.Audio = class {
  constructor() {
    this.volume = 1;
    this.paused = true;
    this.listeners = {};
    audios.push(this);
  }
  addEventListener(n, f) {
    (this.listeners[n] ||= []).push(f);
  }
  play() {
    this.paused = false;
    queueMicrotask(() => (this.listeners.playing || []).forEach((f) => f()));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {}
  getAttribute() {
    return null;
  }
};
mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"], now: 0 });
const player = await import("../player.js");

test("replacing or cancelling a timer mid-fade brings the volume back", async () => {
  player.playStream();
  await Promise.resolve();
  const audio = audios[0];
  assert.equal(Math.round(audio.volume * 100), 70);
  player.startSleepTimer(1);
  mock.timers.tick(50000); // 10 s left: halfway through the fade
  assert.ok(audio.volume < 0.6, `fading (${audio.volume})`);
  player.startSleepTimer(15); // a longer timer
  assert.equal(Math.round(audio.volume * 100), 70, "back to the listener's volume");
  mock.timers.tick(5 * 60000);
  player.cancelSleepTimer();
  assert.equal(Math.round(audio.volume * 100), 70);
  player.startSleepTimer(1);
  mock.timers.tick(55000);
  player.cancelSleepTimer();
  assert.equal(Math.round(audio.volume * 100), 70, "cancel mid-fade restores it too");
});

test("with the alarm's own volume on, the fade starts from it", async () => {
  const audio = audios[0];
  player.setTemporaryVolume(30);
  player.startSleepTimer(1);
  mock.timers.tick(50000); // halfway through the fade
  assert.ok(audio.volume <= 0.16, `faded from 30, not 70 (${audio.volume})`);
  player.cancelSleepTimer();
  assert.equal(Math.round(audio.volume * 100), 30, "the alarm's level comes back");
  assert.equal(memory.get("xpn.volume"), "70", "the saved volume is untouched");
});
