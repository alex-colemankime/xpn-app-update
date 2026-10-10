// Listening time (listening.js): minutes listened, reported in pieces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createListeningMeter } from "../listening.js";

function meter() {
  let t = 0;
  const sent = [];
  const m = createListeningMeter({ send: (name, p) => sent.push([name, p]), now: () => t });
  return { m, sent, advance: (min) => (t += min * 60000) };
}
const live = { content: "live", station: "xpn", show: "worldcafe" };

test("listening is reported every five minutes and when it stops", () => {
  const { m, sent, advance } = meter();
  m.update(live);
  advance(3);
  m.tick();
  assert.equal(sent.length, 0, "not yet five minutes");
  advance(2);
  m.tick();
  advance(1.5);
  m.update(null); // paused
  assert.deepEqual(sent, [
    ["listen_time", { ...live, minutes: 5 }],
    ["listen_time", { ...live, minutes: 1.5 }],
  ]);
});

test("a change of station or show starts a new count; a tap isn't listening", () => {
  const { m, sent, advance } = meter();
  m.update(live);
  advance(2);
  m.update({ ...live, show: "afternoons" }); // 4pm
  advance(0.05);
  m.update(null);
  assert.deepEqual(sent, [["listen_time", { ...live, minutes: 2 }]]);
  m.update(live);
  m.update(live); // the same source again changes nothing
  advance(1);
  m.flush();
  assert.equal(sent.at(-1)[1].minutes, 1);
});

test("buffering isn't listening: only audio that flows counts", async () => {
  const { listeningSource } = await import("../listening.js");
  const idle = { status: "idle", episode: null };
  const onAir = () => "worldcafe";
  assert.deepEqual(
    listeningSource({ playing: true, status: "playing", streamId: "xpn" }, idle, onAir),
    {
      content: "live",
      station: "xpn",
      show: "worldcafe",
    },
  );
  assert.equal(
    listeningSource({ playing: true, status: "loading", streamId: "xpn" }, idle, onAir),
    null,
  );
  assert.equal(
    listeningSource({ playing: true, status: "reconnecting", streamId: "xpn" }, idle, onAir),
    null,
  );
});
