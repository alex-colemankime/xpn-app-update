import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function playerHarness() {
  class Audio {
    constructor() {
      this.events = {};
      this.paused = true;
      this.src = "";
      this.pending = [];
    }
    addEventListener(name, fn) {
      this.events[name] = fn;
    }
    getAttribute(name) {
      return this[name] || null;
    }
    removeAttribute(name) {
      this[name] = "";
    }
    play() {
      this.paused = false;
      return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
    }
    pause() {
      this.paused = true;
      this.events.pause?.();
    }
    load() {}
  }
  const actions = {};
  const context = vm.createContext({
    Audio,
    URL,
    window: { location: { href: "https://radio.example/" } },
    MS: {
      setActionHandler({ action }, fn) {
        actions[action] = fn;
      },
      setPlaybackState() {},
      setMetadata() {},
    },
  });
  const source = fs
    .readFileSync(new URL("../player.js", import.meta.url), "utf8")
    .replace(/import \{ MediaSession as MS \} from[^;]+;/, "")
    .replaceAll("import.meta.env.BASE_URL", "'/'")
    .replaceAll("export ", "");
  vm.runInContext(
    source +
      "\nthis.api = {initPlayer, playStream, pauseStream, setStream, getCurrentStream, setPlayerVolume};",
    context,
  );
  const states = [],
    statuses = [];
  const audio = context.api.initPlayer(
    (v) => states.push(v),
    (v) => statuses.push(v),
  );
  return { ...context.api, audio, states, statuses, actions };
}

test("live playback waits for audio, reconnects on resume, and handles media controls", async () => {
  const p = playerHarness();
  assert.equal(p.audio.preload, "none");
  p.actions.play();
  assert.equal(p.statuses.at(-1), "loading");
  assert.notEqual(p.states.at(-1), true);
  p.audio.events.playing();
  assert.equal(p.statuses.at(-1), "playing");
  p.actions.pause();
  assert.equal(p.audio.src, "");
  assert.equal(p.states.at(-1), false);
  p.actions.play();
  assert.equal(p.audio.src, "https://wxpnhi.xpn.org/xpnhi-nopreroll");
  p.actions.stop();
  assert.equal(p.audio.src, "");
});

test("station changes isolate old play failures and preserve paused state", async () => {
  const p = playerHarness();
  p.playStream();
  p.setStream("xpn2");
  assert.equal(p.audio.src, "https://wxpnhi.xpn.org/xpn2mp3hi");
  p.audio.pending[0].reject(new Error("superseded"));
  await Promise.resolve();
  assert.notEqual(p.statuses.at(-1), "error");
  p.pauseStream();
  p.audio.pending[1].reject(new Error("cancelled"));
  await Promise.resolve();
  assert.equal(p.statuses.at(-1), "paused");
  p.setStream("kids");
  assert.equal(p.audio.src, "");
  p.playStream();
  assert.equal(p.audio.src, "https://wxpnhi.xpn.org/kidscornermp3hi");
  p.audio.pending.at(-1).reject(new Error("network"));
  await Promise.resolve();
  assert.equal(p.statuses.at(-1), "error");
  assert.equal(p.states.at(-1), false);
  assert.equal(p.setStream("invalid"), false);
});

test("volume remains within audio limits", () => {
  const p = playerHarness();
  p.setPlayerVolume(500);
  assert.equal(p.audio.volume, 1);
  p.setPlayerVolume(-20);
  assert.equal(p.audio.volume, 0);
  p.setPlayerVolume(70);
  assert.equal(p.audio.volume, 0.7);
});

test("playlist normalization filters invalid records and sorts by reported time", () => {
  let source = fs.readFileSync(new URL("../nowplaying.js", import.meta.url), "utf8");
  source = source
    .slice(
      source.indexOf("export function normalizePlaylist"),
      source.indexOf("export function useNowPlaying"),
    )
    .replace("export ", "");
  const context = vm.createContext({});
  vm.runInContext(source + "\nthis.normalize = normalizePlaylist;", context);
  const rows = context.normalize([
    { artist: "A", song: "Earlier", timeslice: "2026-09-07 10:01:00", image: "javascript:invalid" },
    {
      artist: "B",
      song: "Latest",
      timeslice: "2026-09-07 10:02:00",
      image: "https://example.com/image.jpg",
    },
    { artist: "", song: "Empty" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Latest");
  assert.equal(rows[1].img, "");
  assert.equal(context.normalize({}).length, 0);
});

test("Eastern date keys survive UTC midnight and daylight saving transitions", () => {
  const source = fs.readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
  const start = source.indexOf("export function easternParts");
  const end = source.indexOf("export function clockLabel");
  const context = vm.createContext({ Intl, Date });
  vm.runInContext(
    source.slice(start, end).replaceAll("export ", "") + "\nthis.parts = easternParts;",
    context,
  );
  assert.equal(context.parts(new Date("2026-09-08T01:00:00Z")).date, "2026-09-07");
  assert.equal(context.parts(new Date("2026-03-08T07:00:00Z")).time, "03:00");
  assert.equal(context.parts(new Date("2026-11-01T06:00:00Z")).time, "01:00");
});
