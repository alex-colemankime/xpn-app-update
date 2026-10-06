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
//   "error"     the audio could not be played

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
  resolveUrl = (src) => src,
  now = () => Date.now(),
}) {
  let audio = null;
  let state = { episode: null, status: "idle", position: 0, duration: 0 };
  let pendingSeek = null;
  let wantPlaying = false;
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
      applyPendingSeek();
      set({ status: "playing" });
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
      if (audio.ended || state.status === "ended") return;
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
      if (!audio.getAttribute("src")) return;
      wantPlaying = false;
      set({ status: "error" });
      mediaSession.setPlaybackState({ playbackState: "paused" });
    });
    return audio;
  }

  function startAudio() {
    wantPlaying = true;
    onStart();
    bindControls();
    const playing = audio.play();
    playing?.catch?.((error) => {
      if (!wantPlaying) return;
      wantPlaying = false;
      set({ status: error?.name === "NotAllowedError" ? "paused" : "error" });
    });
  }

  // Play an episode: a new one from its saved place (`from`, seconds), the
  // current one from where it is, or from the top once it has ended.
  function play(episode, from = 0) {
    if (!init() || !episode?.audio) return;
    if (state.episode?.id !== episode.id) {
      saveProgress(true);
      pendingSeek = from > 0 ? from : null;
      lastPosition = from || 0;
      set({
        episode,
        status: "loading",
        position: from || 0,
        duration: episode.duration || 0,
      });
      audio.src = episode.audio;
      audio.load?.();
    } else if (state.status === "ended") {
      pendingSeek = null;
      audio.currentTime = 0;
      lastPosition = 0;
      set({ status: "loading", position: 0 });
    } else {
      set({ status: state.status === "playing" ? "playing" : "loading" });
    }
    startAudio();
  }

  function resume() {
    if (state.episode) play(state.episode);
  }

  function pause() {
    if (!audio || !state.episode) return;
    wantPlaying = false;
    audio.pause();
    // Browsers report "pause" a moment later; the place is known now.
    set({ status: "paused", position: audio.currentTime || state.position });
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

  // Put the episode away: playback stops and the bar goes back to the station.
  function stop() {
    if (!audio) return;
    saveProgress(true);
    wantPlaying = false;
    audio.pause();
    audio.removeAttribute("src");
    audio.load?.();
    pendingSeek = null;
    set({ episode: null, status: "idle", position: 0, duration: 0 });
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
