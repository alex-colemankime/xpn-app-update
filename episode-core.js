// On-demand playback of archive episodes, independent of React and the
// browser so it can be tested directly (episode-player.js wires it up). It
// runs beside the live player (player-core.js) on its own <audio> element:
// a live stream is never seekable and is detached on pause to save data,
// while an episode keeps its place, seeks, and resumes where it was left.
//
// Status is one of:
//   "idle"      nothing loaded
//   "loading"   fetching or buffering
//   "playing"   audio is flowing
//   "paused"    stopped by the listener (or the system), keeping its place
//   "ended"     played to the end
//   "error"     the audio could not be played (`error` says why)

export const SKIP_BACK_S = 15;
export const SKIP_AHEAD_S = 30;
// A saved place this close to either end counts as the start, or as done.
const NEAR_START_S = 15;
const NEAR_END_S = 30;

// Where to start an episode, from its saved place.
export function resumeAt(saved, duration) {
  if (!saved || saved.done) return 0;
  const at = Number(saved.at) || 0;
  const of = Number(duration || saved.of) || 0;
  if (at < NEAR_START_S || (of && at > of - NEAR_END_S)) return 0;
  return at;
}

const noop = () => {};

export function createEpisodePlayer({
  createAudio,
  mediaSession,
  onChange = noop,
  onProgress = noop,
  onStart = noop,
  // Why an episode couldn't play: "gone" (no longer in the archive),
  // "offline" (the archive couldn't be read) or "audio" (the file failed).
  onError = noop,
  // Archive audio links are signed and run out after a while. Before an
  // episode plays, `needsRefresh(episode)` says whether its link may have
  // run out, and `refresh(episode)` resolves to a copy with a fresh one (or
  // rejects with { reason }).
  needsRefresh = () => false,
  refresh = (episode) => Promise.resolve(episode),
  resolveUrl = (src) => src,
  now = () => Date.now(),
}) {
  let audio = null;
  let state = { episode: null, status: "idle", position: 0, duration: 0, error: null };
  let pendingSeek = null;
  let wantPlaying = false;
  // Every play, pause and stop is a new request. Whatever arrives late for an
  // older one (a play() promise settling, a fresh link) is ignored, so an
  // episode replaced a moment ago can't touch the one playing now.
  let request = 0;
  let lastSaved = 0;
  let lastPosition = 0;

  const set = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const saveProgress = (force = false) => {
    if (!state.episode) return;
    const t = now();
    if (!force && t - lastSaved < 5000) return;
    lastSaved = t;
    onProgress(state.episode.id, {
      at: Math.round(state.position),
      of: Math.round(state.duration || state.episode.duration || 0),
      done: state.status === "ended",
    });
  };

  const positionState = () => {
    const duration = state.duration;
    if (!(duration > 0)) return;
    mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(state.position, duration),
    });
  };

  function bindControls() {
    const ep = state.episode;
    let artwork = [];
    try {
      if (ep.image) artwork = [{ src: resolveUrl(ep.image) }];
    } catch {
      /* no artwork */
    }
    mediaSession.setMetadata({
      title: ep.title,
      artist: ep.showName || "WXPN",
      album: "WXPN archive",
      artwork,
    });
    mediaSession.setActionHandler({ action: "play" }, () => resume());
    mediaSession.setActionHandler({ action: "pause" }, () => pause());
    mediaSession.setActionHandler({ action: "stop" }, () => pause());
    mediaSession.setActionHandler({ action: "seekbackward" }, (d) =>
      skip(-(d?.seekOffset || SKIP_BACK_S)),
    );
    mediaSession.setActionHandler({ action: "seekforward" }, (d) =>
      skip(d?.seekOffset || SKIP_AHEAD_S),
    );
    mediaSession.setActionHandler({ action: "seekto" }, (d) => {
      if (Number.isFinite(d?.seekTime)) seek(d.seekTime);
    });
  }

  // Takes the file off the element, so nothing more is fetched for it.
  const detach = () => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load?.();
    pendingSeek = null;
  };

  function fail(reason) {
    wantPlaying = false;
    set({ status: "error", error: reason });
    mediaSession.setPlaybackState({ playbackState: "paused" });
    onError(reason, state.episode);
  }

  function init() {
    if (audio) return audio;
    audio = createAudio();
    if (!audio) return null;
    audio.preload = "metadata";
    const applyPendingSeek = () => {
      if (pendingSeek === null) return;
      try {
        audio.currentTime = pendingSeek;
      } catch {
        /* not seekable yet; try again on the next event */
        return;
      }
      lastPosition = pendingSeek;
      set({ position: pendingSeek });
      pendingSeek = null;
    };
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      set({ duration: duration || state.episode?.duration || 0 });
      applyPendingSeek();
    });
    audio.addEventListener("durationchange", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) set({ duration: audio.duration });
    });
    audio.addEventListener("playing", () => {
      // Late, from a play the listener has since paused.
      if (audio.paused || !state.episode) return;
      applyPendingSeek();
      set({ status: "playing", error: null });
      mediaSession.setPlaybackState({ playbackState: "playing" });
      positionState();
    });
    audio.addEventListener("waiting", () => {
      if (wantPlaying) set({ status: "loading" });
    });
    audio.addEventListener("timeupdate", () => {
      const position = audio.currentTime || 0;
      // Only whole-second changes reach the screen, so a list of episodes
      // isn't redrawn four times a second.
      if (Math.floor(position) === Math.floor(lastPosition)) return;
      lastPosition = position;
      set({ position });
      saveProgress();
      if (Math.floor(position) % 5 === 0) positionState();
    });
    audio.addEventListener("pause", () => {
      if (audio.ended || state.status === "ended" || !audio.getAttribute("src")) return;
      // Browsers deliver "pause" a moment late. One that arrives after a new
      // play has begun belongs to the past: play() has already set the
      // element playing again.
      if (!audio.paused) return;
      // Otherwise something outside the app paused it (a phone call,
      // headphones unplugged), or the app itself did.
      wantPlaying = false;
      set({ status: "paused", position: audio.currentTime || state.position });
      mediaSession.setPlaybackState({ playbackState: "paused" });
      saveProgress(true);
    });
    audio.addEventListener("ended", () => {
      wantPlaying = false;
      set({ status: "ended", position: state.duration || state.position });
      mediaSession.setPlaybackState({ playbackState: "paused" });
      saveProgress(true);
    });
    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src") || !state.episode) return;
      // Failed while paused: nothing to say until the listener plays again.
      if (!wantPlaying) return;
      // A link that has run out mid-listen: carry on with a fresh one. (A
      // link fresh enough to need no refresh failed for some other reason.)
      if (needsRefresh(state.episode)) {
        const at = audio.currentTime || state.position;
        detach(); // the failed file is let go, so the fresh one loads
        start(state.episode, at);
        return;
      }
      fail("audio");
    });
    return audio;
  }

  function startAudio(token) {
    wantPlaying = true;
    onStart();
    bindControls();
    const playing = audio.play();
    playing?.then?.(noop, (error) => {
      if (token !== request || !wantPlaying) return;
      // Refused without a tap, or interrupted: it stays where it was, ready
      // to play. Anything else means the file can't be played.
      if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
        wantPlaying = false;
        set({ status: "paused" });
        mediaSession.setPlaybackState({ playbackState: "paused" });
      } else {
        fail("audio");
      }
    });
  }

  // The element holds this episode's file, in working order: a pause, not a
  // failure.
  const holds = (episode) =>
    Boolean(episode.audio) &&
    audio.getAttribute("src") === episode.audio &&
    !audio.error &&
    state.status !== "error";

  // Puts `episode` on the element at `at` seconds and plays it. A file
  // already on the element (the episode was paused) just continues; one
  // that failed is loaded again.
  function begin(episode, at, token) {
    if (!holds(episode)) {
      const same = state.episode?.id === episode.id;
      pendingSeek = at > 0 ? at : null;
      lastPosition = at;
      set({
        episode,
        status: "loading",
        error: null,
        position: at,
        duration: (same && state.duration) || episode.duration || 0,
      });
      audio.src = episode.audio;
      audio.load?.();
    } else {
      if (state.status === "ended") {
        pendingSeek = null;
        audio.currentTime = 0;
        lastPosition = 0;
      }
      set({
        episode,
        status: state.status === "playing" ? "playing" : "loading",
        error: null,
        position: at,
      });
    }
    startAudio(token);
  }

  // Starts `episode` at `at` seconds, first fetching a fresh link when a new
  // file has to load and its link may have run out. Meanwhile it shows as
  // loading and the station steps aside, so the tap is answered at once. A
  // paused episode just continues: its file is already open, and if the
  // link has run out by the time more is needed, the error handler fetches
  // a fresh one then.
  function start(episode, at) {
    const token = ++request;
    if (holds(episode) || !needsRefresh(episode)) {
      begin(episode, at, token);
      return;
    }
    detach();
    wantPlaying = true;
    set({
      episode,
      status: "loading",
      error: null,
      position: at,
      duration: (state.episode?.id === episode.id && state.duration) || episode.duration || 0,
    });
    onStart();
    bindControls();
    refresh(episode).then(
      (fresh) => {
        if (token === request) begin({ ...episode, ...fresh }, at, token);
      },
      (error) => {
        if (token === request) fail(error?.reason || "audio");
      },
    );
  }

  // Play an episode: a new one from its saved place (`from`, seconds), the
  // current one from where it is, or from the top once it has ended.
  function play(episode, from = 0) {
    if (!init() || !episode) return;
    const same = state.episode?.id === episode.id;
    if (same && state.status === "playing") return;
    if (!same) saveProgress(true);
    const current = same ? state.episode : episode;
    const at = !same ? Math.max(0, from || 0) : state.status === "ended" ? 0 : state.position;
    start(current, at);
  }

  function resume() {
    if (state.episode) play(state.episode);
  }

  function pause() {
    if (!audio || !state.episode) return;
    ++request; // a play still starting, or a link still on its way, is called off
    wantPlaying = false;
    audio.pause();
    // Browsers report "pause" a moment later; the place is known now.
    set({ status: "paused", position: audio.currentTime || state.position });
    mediaSession.setPlaybackState({ playbackState: "paused" });
    saveProgress(true);
  }

  function toggle() {
    if (state.status === "playing" || state.status === "loading") pause();
    else resume();
  }

  function seek(seconds) {
    if (!audio || !state.episode) return;
    const max = state.duration || Infinity;
    const to = Math.max(0, Math.min(Number(seconds) || 0, max - 0.5));
    if (pendingSeek !== null || !(audio.readyState >= 1)) {
      pendingSeek = to;
    } else {
      audio.currentTime = to;
    }
    lastPosition = to;
    set({ position: to, ...(state.status === "ended" ? { status: "paused" } : {}) });
    positionState();
    saveProgress(true);
  }

  const skip = (delta) => seek((audio?.currentTime ?? state.position) + delta);

  // Put the episode away: playback stops and the bar goes back to the
  // station, which takes the lock screen back (player.js).
  function stop() {
    if (!audio) return;
    ++request;
    saveProgress(true);
    wantPlaying = false;
    detach();
    set({ episode: null, status: "idle", position: 0, duration: 0, error: null });
  }

  return {
    play,
    pause,
    resume,
    toggle,
    seek,
    skip,
    stop,
    getState: () => state,
    setVolume(percent) {
      if (!init()) return;
      const value = Number(percent);
      audio.volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value / 100 : 0.7));
    },
  };
}
