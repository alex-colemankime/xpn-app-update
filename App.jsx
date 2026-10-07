import {
  Activity,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getPlayerSnapshot,
  isConnecting,
  pauseStream,
  playStream,
  setMetadata,
  subscribePlayer,
  togglePlayback,
} from "./player.js";
import { Capacitor } from "@capacitor/core";
import { useLiveSong, useNowPlaying } from "./nowplaying.js";
import { SHOWS } from "./catalog.js";
import { useFavoriteItems } from "./favorites.js";
import { Icon, Wordmark, heightVar } from "./ui.jsx";
import { usePlayer } from "./hooks/usePlayer.js";
import { keepClockRunning } from "./hooks/useNow.js";
import { parseRoute, useRoute } from "./hooks/useRoute.js";
import { useAppearance } from "./hooks/useAppearance.js";
import { useConcerts } from "./hooks/useConcerts.js";
import { useRadioAlarm } from "./hooks/useRadioAlarm.js";
import { useShowReminders } from "./hooks/useShowReminders.js";
import { PlayerBar } from "./components/PlayerBar.jsx";
import {
  getEpisodeState,
  pauseEpisode,
  resumeEpisode,
  useAudioFocus,
  useEpisodePlayer,
} from "./episode-player.js";
import { Toast } from "./components/Toast.jsx";
import { StationBanner } from "./components/StationUpdates.jsx";
import { useStationUpdates } from "./hooks/useStationUpdates.js";
import { useStationAlerts } from "./hooks/useStationAlerts.js";
import { youTubeEmbed } from "./updates.js";
import { startPlaylistSync } from "./playlist-sync.js";
import { showToast } from "./toast.js";
import { readJson, writeJson } from "./storage.js";
import { DONATE_URL } from "./links.js";
import { CONCERTS_ENABLED, VIDEOS_ENABLED } from "./config.js";
import { STREAMS } from "./streams.js";
import { clockLabel } from "./time.js";
import { ListenScreen } from "./screens/ListenScreen.jsx";
import { ShowsScreen, ShowDetail } from "./screens/ShowsScreen.jsx";
import { LibraryScreen } from "./screens/LibraryScreen.jsx";

// Concerts only has a tab when there are listings to show (see config.js).
const NAV = [
  { id: "listen", label: "Listen live", short: "Listen", icon: "navLive" },
  { id: "favorites", label: "Favorites", short: "Favorites", icon: "heart" },
  { id: "shows", label: "Shows", short: "Shows", icon: "headphones" },
  ...(VIDEOS_ENABLED ? [{ id: "videos", label: "Videos", short: "Videos", icon: "video" }] : []),
  ...(CONCERTS_ENABLED
    ? [{ id: "concerts", label: "Concerts", short: "Concerts", icon: "navConcerts" }]
    : []),
];
const TITLES = { ...Object.fromEntries(NAV.map((n) => [n.id, n.label])), settings: "Settings" };
const ONBOARDED_KEY = "xpn.onboarded";
const trackAlarmHeight = heightVar("--alarm-h");

// Only the station choice, so the app shell does not re-render on every
// change between connecting, playing and paused.
const useStreamId = () => useSyncExternalStore(subscribePlayer, () => getPlayerSnapshot().streamId);

// Keeps the lock screen, media notification and browser tab in step with the
// song on air (or the station, when no song is current). Renders nothing.
function NowPlayingSync({ playlist }) {
  const { playing: livePlaying, station } = usePlayer();
  const current = useLiveSong(playlist);
  const focus = useAudioFocus();
  const archive = useEpisodePlayer();
  const episode = focus === "episode" && archive.status === "playing" ? archive.episode : null;
  const playing = livePlaying || Boolean(episode);
  // While audio plays in the background, time keeps moving for the song info.
  useEffect(() => keepClockRunning(playing), [playing]);
  useEffect(() => {
    setMetadata(current);
  }, [current]);
  useEffect(() => {
    document.title = episode
      ? `${episode.title} — ${episode.showName}`
      : playing && current
        ? `${current.title} · ${current.artist} — ${station.label}`
        : playing
          ? `${station.label} — Listening live`
          : "WXPN — Listen live";
  }, [playing, current, station, episode]);
  return null;
}

// Screens re-render only when their own inputs change. Listen, Shows and
// Favorites are in the first download; Concerts and Settings load just after.
const Listen = memo(ListenScreen);
const Shows = memo(ShowsScreen);
const Library = memo(LibraryScreen);
const Concerts = lazy(() =>
  import("./screens/ConcertsScreen.jsx").then((m) => ({ default: memo(m.ConcertsScreen) })),
);
const Videos = lazy(() =>
  import("./screens/VideosScreen.jsx").then((m) => ({ default: memo(m.VideosScreen) })),
);
const Settings = lazy(() =>
  import("./screens/SettingsScreen.jsx").then((m) => ({ default: memo(m.SettingsScreen) })),
);
const Welcome = lazy(() =>
  import("./components/Welcome.jsx").then((m) => ({ default: m.Welcome })),
);
const VideoSheet = lazy(() =>
  import("./components/VideoSheet.jsx").then((m) => ({ default: m.VideoSheet })),
);

// One screen of the app, shown or kept in the background.
function Screen({ id, label, current, children }) {
  const shown = current === id;
  return (
    <Activity mode={shown ? "visible" : "hidden"}>
      <section hidden={!shown} aria-label={label}>
        <Suspense fallback={null}>{children}</Suspense>
      </section>
    </Activity>
  );
}

export default function App() {
  const route = useRoute();
  const streamId = useStreamId();
  const playlist = useNowPlaying(streamId);
  const concerts = useConcerts();
  const updates = useStationUpdates();
  useEffect(startPlaylistSync, []);

  // Watching a video: Brightcove videos and YouTube play in a sheet, with
  // the radio (or an archive episode) paused and offered back afterwards; any
  // other link opens in the browser.
  const [watching, setWatching] = useState(null);
  const radioWasOn = useRef(false);
  const episodeWasOn = useRef(false);
  const pauseAudio = () => {
    const { playing, status } = getPlayerSnapshot();
    radioWasOn.current = playing || isConnecting(status);
    if (radioWasOn.current) pauseStream();
    const episode = getEpisodeState();
    episodeWasOn.current =
      Boolean(episode.episode) && (episode.status === "playing" || episode.status === "loading");
    if (episodeWasOn.current) pauseEpisode();
  };
  const watch = useCallback((live) => {
    // The station's own videos play in its Brightcove Player, everywhere.
    if (live.embed) {
      pauseAudio();
      setWatching(live);
      return;
    }
    // YouTube now refuses embeds without a web referrer, which the iOS app
    // (capacitor://localhost) can't send, so iOS opens the video in the
    // in-app browser instead; so does any link that isn't YouTube.
    if (Capacitor.getPlatform() === "ios") {
      import("@capacitor/browser")
        .then(({ Browser }) => Browser.open({ url: live.watch }))
        .catch(() => window.open(live.watch, "_blank", "noopener"));
      return;
    }
    if (!youTubeEmbed(live.watch)) {
      window.open(live.watch, "_blank", "noopener");
      return;
    }
    pauseAudio();
    setWatching(live);
  }, []);
  const stopWatching = () => {
    setWatching(null);
    if (radioWasOn.current)
      showToast("The radio paused for the video.", { label: "Resume", onClick: playStream });
    else if (episodeWasOn.current)
      showToast("The episode paused for the video.", { label: "Resume", onClick: resumeEpisode });
  };
  const alarm = useRadioAlarm();
  const [appearance, setAppearance] = useAppearance();
  const main = useRef(null);

  // The first-run welcome, once. Not over a shared show link: that listener
  // came for the show.
  const [welcome, setWelcome] = useState(
    () => !readJson(ONBOARDED_KEY, false) && !parseRoute(window.location.hash).showId,
  );
  // Show heads-ups wait while the welcome is open, so they never cover it.
  useShowReminders(() => route.navigate("listen"), { paused: welcome });
  useStationAlerts(updates.all, { onWatch: watch });
  const finishWelcome = () => {
    writeJson(ONBOARDED_KEY, true);
    setWelcome(false);
  };

  // Space plays and pauses, unless focus is somewhere Space already means
  // something (a button, a field, a link) or the show sheet is open.
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.code !== "Space" ||
        e.defaultPrevented ||
        e.repeat ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.target.closest?.("button, a, input, select, textarea, summary, [contenteditable]"))
        return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each screen change reads as a new page: top of the page, focus on main
  // so screen readers announce the new content.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [route.screen]);

  const savedShows = useFavoriteItems("shows");
  const show = route.showId
    ? SHOWS[route.showId] || savedShows.find((s) => s.id === route.showId) || null
    : null;
  const isCurrent = (id) => route.screen === id;
  const currentProps = (id) => ({
    "aria-current": isCurrent(id) ? "page" : undefined,
    onClick: () => route.navigate(id),
  });

  return (
    <div className="app-layout">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          // The hash is the router's; move focus without navigating.
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="app-sidebar">
        <button className="brand" onClick={() => route.navigate("listen")}>
          <span className="sr-only">WXPN home</span>
          <Wordmark dot />
        </button>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-button ${isCurrent(n.id) ? "active" : ""}`}
              {...currentProps(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {isCurrent(n.id) && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="settings-button" {...currentProps("settings")}>
            <Icon name="settings" size={18} />
            Settings
          </button>
          <a
            className="sidebar-donate"
            href={DONATE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Donate to WXPN (opens in a new tab)"
          >
            Donate
            <Icon name="arrowUp" size={16} />
          </a>
        </div>
      </aside>
      <main
        className="main-shell"
        id="main-content"
        ref={main}
        tabIndex={-1}
        data-screen={route.screen}
        aria-label={TITLES[route.screen]}
      >
        <header className="topbar">
          <button
            className="mobile-brand"
            onClick={() => route.navigate("listen")}
            aria-label="WXPN home"
          >
            <Wordmark dot />
          </button>
          <div className="topbar-actions">
            {/* Giving happens on xpn.org, in the browser (App Review 3.2.2). */}
            <a
              className="topbar-donate"
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Donate to WXPN (opens in a new tab)"
            >
              <span>Donate</span>
            </a>
            <button
              className="mobile-settings icon-button"
              aria-label="Settings"
              {...currentProps("settings")}
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
        {alarm.ringing && (
          <div className="alarm-banner" role="alert" ref={trackAlarmHeight}>
            <span className="alarm-banner-title">
              <span className="alarm-bell" aria-hidden="true">
                <Icon name="bell" size={20} />
              </span>
              <span>
                <strong>Radio alarm</strong>
                <small>
                  {clockLabel(alarm.alarm.time)} · {STREAMS[alarm.alarm.streamId]?.label}
                </small>
              </span>
            </span>
            <span className="alarm-banner-actions">
              <button className="alarm-snooze" onClick={alarm.snooze}>
                Snooze {alarm.alarm.snoozeMinutes} min
              </button>
              <button className="alarm-dismiss" onClick={alarm.dismiss}>
                Dismiss
              </button>
            </span>
          </div>
        )}
        <StationBanner {...updates} onWatch={watch} onListenScreen={route.screen === "listen"} />
        {/* Each screen keeps its state while another is shown, but a hidden
            screen's effects and subscriptions are paused (React Activity), so
            only the screen in front does any work. */}
        <div className="page-content">
          <Screen id="listen" label="Listen live" current={route.screen}>
            <Listen
              playlist={playlist}
              live={updates.live}
              onWatch={watch}
              onNavigate={route.navigate}
              onOpenShow={route.openShow}
            />
          </Screen>
          <Screen id="shows" label="Shows" current={route.screen}>
            <Shows onOpen={route.openShow} />
          </Screen>
          {VIDEOS_ENABLED && (
            <Screen id="videos" label="Videos" current={route.screen}>
              <Videos onWatch={watch} />
            </Screen>
          )}
          {CONCERTS_ENABLED && (
            <Screen id="concerts" label="Concerts" current={route.screen}>
              <Concerts result={concerts} />
            </Screen>
          )}
          <Screen id="favorites" label="Favorites" current={route.screen}>
            <Library onOpenShow={route.openShow} onNavigate={route.navigate} />
          </Screen>
          <Screen id="settings" label="Settings" current={route.screen}>
            <Settings
              appearance={appearance}
              onAppearance={setAppearance}
              alarm={alarm.alarm}
              updateAlarm={alarm.updateAlarm}
              onAlarmEnabled={alarm.setEnabled}
              onTestAlarm={alarm.test}
              onNavigate={route.navigate}
            />
          </Screen>
        </div>
      </main>
      <NowPlayingSync playlist={playlist} />
      <PlayerBar
        playlist={playlist}
        onOpen={() => route.navigate("listen")}
        onOpenEpisode={(episode) => route.openShow(episode.show, episode.id)}
      />
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map((n) => (
          <button key={n.id} className={isCurrent(n.id) ? "active" : ""} {...currentProps(n.id)}>
            <Icon name={n.icon} size={21} />
            <span>{n.short}</span>
          </button>
        ))}
      </nav>
      {show && (
        <ShowDetail
          key={show.id}
          show={show}
          episodeId={route.episodeId}
          onOpenEpisode={route.openEpisode}
          onCloseEpisode={route.closeEpisode}
          onClose={route.closeShow}
          onListen={() => route.navigate("listen")}
          onNavigate={route.navigate}
          onWatch={watch}
        />
      )}
      <Suspense fallback={null}>
        {welcome && !show && <Welcome onDone={finishWelcome} />}
        {watching && <VideoSheet live={watching} onClose={stopWatching} />}
      </Suspense>
      <Toast />
    </div>
  );
}
