// Listening time: how long people listen, the measure public radio is
// judged by (time spent listening, for underwriting and audience reports).
// Reported to GA4 (analytics.js) as `listen_time` events, each carrying the
// minutes since the last one, so summing `minutes` gives listening hours:
//   { content: "live", station: "xpn", show: "worldcafe", minutes: 5 }
//   { content: "episode", show: "sleepyhollow", minutes: 2.4 }
// A report goes every five minutes while audio plays and when it stops, so
// a phone that closes the app mid-listen loses at most the last few
// minutes. Register `minutes` as a custom metric in GA4 to sum it.

const REPORT_EVERY_MS = 5 * 60000;

// The meter, with the clock and sending passed in so it can be tested.
// `update(source)` is called whenever playback changes: the source playing
// now ({ content, station?, show? }) or null.
export function createListeningMeter({ send, now = () => Date.now() }) {
  let current = null; // { source, key, since }
  const flush = () => {
    if (!current) return;
    const t = now();
    const elapsed = (t - current.since) / 60000;
    // Under six seconds is a tap, not listening.
    if (elapsed >= 0.1) {
      send("listen_time", { ...current.source, minutes: Math.round(elapsed * 10) / 10 });
    }
    current.since = t;
  };
  return {
    update(source) {
      const key = source ? JSON.stringify(source) : "";
      if (key === (current?.key || "")) return;
      flush();
      current = source ? { source, key, since: now() } : null;
    },
    // Called on a timer: reports what has built up past the interval.
    tick() {
      if (current && now() - current.since >= REPORT_EVERY_MS) flush();
    },
    flush,
  };
}

// At launch: follows the station and episode players.
export function startListeningMeter({ track, live, episode, showOnAir }) {
  const meter = createListeningMeter({ send: track });
  const source = () => {
    const ep = episode.getSnapshot();
    if (ep.status === "playing" && ep.episode) {
      return { content: "episode", show: ep.episode.show || "" };
    }
    const player = live.getSnapshot();
    if (player.playing) {
      return { content: "live", station: player.streamId, show: showOnAir(player.streamId) };
    }
    return null;
  };
  const check = () => meter.update(source());
  live.subscribe(check);
  episode.subscribe(check);
  setInterval(() => {
    check(); // the show on air changes on the hour, while the audio plays on
    meter.tick();
  }, 60000);
  // Leaving the app, or the page closing: report what's built up.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") meter.flush();
  });
  check();
}
