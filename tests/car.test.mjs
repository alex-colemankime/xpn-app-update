// CarPlay and Android Auto (car.js): the car's commands, and what it shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { carCommand, carNowPlaying } from "../car.js";

function actions() {
  const done = [];
  return {
    done,
    select: (id) => done.push(`select ${id}`),
    play: () => done.push("play"),
    pause: () => done.push("pause"),
  };
}

test("choosing a station in the car plays it; play and pause work as the app's", () => {
  const a = actions();
  carCommand({ action: "play", stationId: "xpn2" }, a);
  carCommand({ action: "pause" }, a);
  carCommand({ action: "play" }, a);
  assert.deepEqual(a.done, ["select xpn2", "play", "pause", "play"]);
});

test("an unknown station or command does nothing", () => {
  const a = actions();
  carCommand({ action: "play", stationId: "nope" }, a);
  carCommand({ action: "skip" }, a);
  carCommand(null, a);
  assert.deepEqual(a.done, []);
});

test("the car shows the song when one is known, else the station", () => {
  assert.deepEqual(
    carNowPlaying({
      streamId: "xpn",
      playing: true,
      track: { title: "Hello", artist: "Waxahatchee", img: "https://i.scdn.co/a.jpg" },
    }),
    {
      stationId: "xpn",
      playing: true,
      title: "Hello",
      artist: "Waxahatchee · WXPN",
      artwork: "https://i.scdn.co/a.jpg",
    },
  );
  const quiet = carNowPlaying({ streamId: "homegrown", playing: false, track: null });
  assert.equal(quiet.title, "Homegrown");
  assert.equal(quiet.playing, false);
});
