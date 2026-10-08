// Live-stream playback, independent of React, the browser and Capacitor so it
// can be tested directly. player.js wires it to the real <audio> element and
// the media-session plugin.
//
// Status is one of:
//   "paused"        not playing, by the listener's choice
//   "loading"       connecting or buffering
//   "playing"       audio is flowing
//   "reconnecting"  the stream dropped; retrying on a backoff
//   "blocked"       the browser refused to start audio without a tap
//   "error"         retries are exhausted
//
// The key distinction is intent: `wantPlaying` records that the listener asked
// for audio. Drops, stalls and errors while that is true are retried; the
// same events after the listener paused are ignored.

const noop = () => {};

// A volume percentage as an <audio> element's 0–1 level. Anything unreadable
// plays at the default 70%. Shared with the episode player.
export function volumeLevel(percent) {
  const value = Number(percent);
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value / 100 : 0.7));
}

export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const STALL_TIMEOUT_MS = 15000;

export function createPlayer({
  createAudio,
  mediaSession,
  streams,
  initialStreamId,
  stationArtwork = [],
  resolveUrl = (src) => src,
  // False while something else (an archive episode) has the lock screen, so
  // song changes on the station don't overwrite what is shown there.
  isActive = () => true,
  retryDelays = RETRY_DELAYS_MS,
  stallTimeout = STALL_TIMEOUT_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let audio = null;
  let stream = streams[initialStreamId];
  let track = null;
  let onPlaying = noop;
  let onStatus = noop;
  let wantPlaying = false;
  let request = 0;
  let attempt = 0;
  let retryTimer = null;
  let stallTimer = null;
  let lastPlaying = false;

  const report = (playing, status) => {
    lastPlaying = playing;
    onPlaying(playing);
    onStatus(status);
    mediaSession.setPlaybackState({ playbackState: playing ? "playing" : "paused" });
  };

  const clearTimers = () => {
    if (retryTimer !== null) clearTimer(retryTimer);
    if (stallTimer !== null) clearTimer(stallTimer);
    retryTimer = stallTimer = null;
  };

  // Removing the source stops a live stream from buffering in the background,
  // which saves listeners' mobile data.
  const detach = () => {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  // Browsers fire "stalled" and "waiting" during healthy playback too (Safari
  // especially), so the watchdog judges by whether audio actually advanced.
  const watchForStall = () => {
    if (stallTimer !== null) clearTimer(stallTimer);
    const mark = audio.currentTime || 0;
    stallTimer = setTimer(() => {
      stallTimer = null;
      if (!wantPlaying) return;
      if ((audio.currentTime || 0) > mark + 1) return; // audio is flowing
      retry();
    }, stallTimeout);
  };

  function connect() {
    clearTimers();
    const current = ++request;
    onStatus(attempt ? "reconnecting" : "loading");
    // Re-attach on every attempt so the listener rejoins "now" rather than
    // resuming a stale buffer. Retries alternate with the backup mount, so
    // one broken mount never keeps the station off the air.
    audio.src = attempt % 2 && stream.backupUrl ? stream.backupUrl : stream.url;
    watchForStall();
    audio.play().catch((error) => {
      if (current !== request) return; // superseded by a newer attempt
      if (error?.name === "NotAllowedError") {
        // Autoplay policy, not the network: retrying cannot help.
        wantPlaying = false;
        clearTimers();
        detach();
        report(false, "blocked");
        return;
      }
      retry();
    });
    updateMetadata();
  }

  function retry() {
    if (!wantPlaying) return;
    clearTimers();
    if (attempt >= retryDelays.length) {
      wantPlaying = false;
      attempt = 0;
      detach();
      report(false, "error");
      return;
    }
    const delay = retryDelays[attempt++];
    ++request; // invalidate the failed attempt's pending promise
    report(false, "reconnecting");
    retryTimer = setTimer(() => {
      retryTimer = null;
      if (wantPlaying) connect();
    }, delay);
  }

  function updateMetadata() {
    if (!isActive()) return;
    let artwork = stationArtwork.map((art) => {
      try {
        return { ...art, src: resolveUrl(art.src) };
      } catch {
        return art;
      }
    });
    if (track?.img) {
      try {
        artwork = [{ src: resolveUrl(track.img) }];
      } catch {
        /* keep the station art if the track art URL is unusable */
      }
    }
    mediaSession.setMetadata({
      title: track?.title || stream.label,
      artist: track?.artist || stream.tagline,
      album: track?.album || "",
      artwork,
    });
  }

  function init(setPlaying = noop, setStatus = noop) {
    onPlaying = setPlaying;
    onStatus = setStatus;
    if (audio) return audio;
    audio = createAudio();
    if (!audio) return null;
    audio.preload = "none"; // never buffer a live stream before play is tapped

    audio.addEventListener("playing", () => {
      attempt = 0;
      clearTimers();
      report(true, "playing");
    });
    audio.addEventListener("waiting", () => {
      if (!wantPlaying) return;
      onStatus(attempt ? "reconnecting" : "loading");
      watchForStall();
    });
    audio.addEventListener("stalled", () => {
      if (wantPlaying) watchForStall();
    });
    audio.addEventListener("pause", () => {
      // Browsers deliver "pause" a moment after pause() is called, so this
      // judges by intent rather than by who called it: every pause the app
      // makes itself clears wantPlaying first. A "pause" that arrives after a
      // new attempt has already started (audio.paused is false again) is
      // stale. When a stream runs out, browsers fire "pause" then "ended";
      // that is a dropped connection, handled by the "ended" listener below.
      if (!wantPlaying || !audio.paused || audio.ended) return;
      // Something outside the app paused audio: a phone call, another app
      // taking the audio session, headphones unplugged. Respect it rather
      // than fighting the OS for playback.
      wantPlaying = false;
      clearTimers();
      report(false, "paused");
    });
    audio.addEventListener("error", () => {
      if (wantPlaying && audio.getAttribute("src")) retry();
    });
    audio.addEventListener("ended", () => {
      // A live stream only "ends" when the server drops the connection.
      if (wantPlaying) retry();
    });

    bindControls();
    updateMetadata();
    return audio;
  }

  // Lock screen, notification and headset buttons drive the same actions as
  // the on-screen button. Bound again on every play, since an archive episode
  // binds its own (with seeking, which a live station has none of).
  function bindControls() {
    mediaSession.setActionHandler({ action: "play" }, () => play());
    mediaSession.setActionHandler({ action: "pause" }, () => pause());
    mediaSession.setActionHandler({ action: "stop" }, () => pause());
    for (const action of ["seekto", "seekbackward", "seekforward"]) {
      mediaSession.setActionHandler({ action }, null);
    }
  }

  // The lock screen back from an archive episode: the station's own
  // controls (no seeking), what it is playing, and no episode progress bar.
  function takeControls() {
    bindControls();
    mediaSession.setPositionState?.();
    updateMetadata();
    mediaSession.setPlaybackState({ playbackState: lastPlaying ? "playing" : "paused" });
  }

  function play() {
    if (!audio) init(onPlaying, onStatus);
    if (!audio || !stream?.url) return;
    bindControls();
    wantPlaying = true;
    attempt = 0;
    connect();
  }

  function pause() {
    wantPlaying = false;
    attempt = 0;
    ++request;
    clearTimers();
    detach();
    report(false, "paused");
  }

  // Called when connectivity returns: skip the rest of the backoff.
  function resume() {
    if (wantPlaying && retryTimer !== null) connect();
  }

  function setStream(id) {
    const next = streams[id];
    if (!next?.url) return false;
    if (next.id === stream.id) return true;
    stream = next;
    track = null;
    if (wantPlaying) {
      attempt = 0;
      connect();
    } else {
      report(false, "paused");
      updateMetadata();
    }
    return true;
  }

  function setVolume(percent) {
    if (!audio) init(onPlaying, onStatus);
    if (audio) audio.volume = volumeLevel(percent);
  }

  function setMetadata(next) {
    track = next || null;
    updateMetadata();
  }

  const canCast = () => Boolean(audio?.remote?.prompt || audio?.webkitShowPlaybackTargetPicker);

  async function promptCast() {
    if (audio?.remote?.prompt) return audio.remote.prompt();
    if (audio?.webkitShowPlaybackTargetPicker) return audio.webkitShowPlaybackTargetPicker();
    throw new Error("Audio output selection is not available in this browser.");
  }

  return {
    init,
    play,
    pause,
    resume,
    setStream,
    getStream: () => stream,
    setVolume,
    setMetadata,
    takeControls,
    canCast,
    promptCast,
  };
}

// Sleep-timer fade: full volume until the last `fadeMs`, then a straight ramp
// to silence, so the stream never cuts off mid-phrase.
export const SLEEP_FADE_MS = 20000;
export function fadeLevel(remainingMs, fadeMs = SLEEP_FADE_MS) {
  if (remainingMs >= fadeMs) return 1;
  return Math.max(0, remainingMs / fadeMs);
}
