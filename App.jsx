import { Activity, lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getPlayerSnapshot, subscribePlayer } from "./player.js";
import { useNowPlaying } from "./nowplaying.js";
import { SHOWS } from "./catalog.js";
import { useFavoriteItems } from "./favorites.js";
import { useRoute } from "./hooks/useRoute.js";
import { useAppearance } from "./hooks/useAppearance.js";
import { useConcerts } from "./hooks/useConcerts.js";
import { useRadioAlarm } from "./hooks/useRadioAlarm.js";
import { useShowReminders } from "./hooks/useShowReminders.js";
import { useSpaceToPlay } from "./hooks/useSpaceToPlay.js";
import { useStationAlerts } from "./hooks/useStationAlerts.js";
import { useStationUpdates } from "./hooks/useStationUpdates.js";
import { useWatching } from "./hooks/useWatching.js";
import { AlarmBanner } from "./components/AlarmBanner.jsx";
import { Sidebar, TabBar, TITLES, TopBar } from "./components/Navigation.jsx";
import { NowPlayingSync } from "./components/NowPlayingSync.jsx";
import { PlayerBar } from "./components/PlayerBar.jsx";
import { ShowDetail } from "./components/ShowDetail.jsx";
import { StationBanner } from "./components/StationUpdates.jsx";
import { OfflineNotice } from "./components/OfflineNotice.jsx";
import { Toast } from "./components/Toast.jsx";
import { readJson, writeJson } from "./storage.js";
import { CONCERTS_ENABLED, VIDEOS_ENABLED } from "./config.js";
import { ListenScreen } from "./screens/ListenScreen.jsx";
import { ShowsScreen } from "./screens/ShowsScreen.jsx";
import { LibraryScreen } from "./screens/LibraryScreen.jsx";
import { trackScreen } from "./analytics.js";
import { UpdatePrompt } from "./components/UpdatePrompt.jsx";
import { useFeatures } from "./features.js";
import { retryImport } from "./retry-import.js";
import { ScreenErrorBoundary } from "./error-boundary.jsx";

const ONBOARDED_KEY = "xpn.onboarded";

// Only the station choice, so the app shell does not re-render on every
// change between connecting, playing and paused.
const useStreamId = () => useSyncExternalStore(subscribePlayer, () => getPlayerSnapshot().streamId);

// Listen, Shows and Favorites are in the first download; the rest load just
// after. (The React Compiler keeps each screen's element while its inputs are
// unchanged, so screens re-render only when their own inputs change.)
// A load that fails while offline waits for the connection (retry-import.js).
const lazyNamed = (load, name) =>
  lazy(() => retryImport(load)().then((m) => ({ default: m[name] })));
const Concerts = lazyNamed(() => import("./screens/ConcertsScreen.jsx"), "ConcertsScreen");
const Videos = lazyNamed(() => import("./screens/VideosScreen.jsx"), "VideosScreen");
const Settings = lazyNamed(() => import("./screens/SettingsScreen.jsx"), "SettingsScreen");
const Welcome = lazyNamed(() => import("./components/Welcome.jsx"), "Welcome");
const WatchPage = lazyNamed(() => import("./components/WatchPage.jsx"), "WatchPage");

// One screen of the app, shown or kept in the background. A hidden screen
// keeps its state, but its effects and subscriptions are paused (React
// Activity), so only the screen in front does any work.
function Screen({ id, label, current, children }) {
  const shown = current === id;
  return (
    <Activity mode={shown ? "visible" : "hidden"}>
      <section hidden={!shown} aria-label={label}>
        {/* A screen that can't load says so, and the rest of the app carries on. */}
        <ScreenErrorBoundary>
          <Suspense fallback={null}>{children}</Suspense>
        </ScreenErrorBoundary>
      </section>
    </Activity>
  );
}

// Screen names as GA4 reports them.
const SCREEN_TITLES = {
  listen: "Listen",
  favorites: "Favorites",
  shows: "Shows",
  videos: "Videos",
  concerts: "Concerts",
  settings: "Settings",
};

export default function App() {
  const route = useRoute();
  const playlist = useNowPlaying(useStreamId());
  const concerts = useConcerts();
  const updates = useStationUpdates();
  const alarm = useRadioAlarm();
  const [appearance, setAppearance] = useAppearance();
  const watching = useWatching(route, updates.live, updates.loaded);
  useSpaceToPlay();

  // The first-run welcome, once. Not over a shared show link: that listener
  // came for the show.
  const [welcome, setWelcome] = useState(() => !readJson(ONBOARDED_KEY, false) && !route.showId);
  const finishWelcome = () => {
    writeJson(ONBOARDED_KEY, true);
    setWelcome(false);
  };
  // Show heads-ups wait while the welcome is open, so they never cover it.
  useShowReminders(() => route.navigate("listen"), { paused: welcome });
  useStationAlerts(updates.all, { onWatch: watching.watchLive });

  // Each screen change reads as a new page: top of the page, focus on main
  // so screen readers announce the new content.
  // (Not on first load, which is already at the top.)
  // A screen the station has switched off (features.js) while it was open:
  // back to Listen.
  const features = useFeatures();
  const screenOff = features[route.screen] === false;
  const { navigate } = route;
  useEffect(() => {
    if (screenOff) navigate("listen");
  }, [screenOff, navigate]);

  const main = useRef(null);
  const shownScreen = useRef(route.screen);
  useEffect(
    () => trackScreen(route.screen, SCREEN_TITLES[route.screen] || route.screen),
    [route.screen],
  );
  useEffect(() => {
    if (shownScreen.current === route.screen) return;
    shownScreen.current = route.screen;
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [route.screen]);

  const savedShows = useFavoriteItems("shows");
  const show = route.showId
    ? SHOWS[route.showId] || savedShows.find((s) => s.id === route.showId) || null
    : null;

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
      <Sidebar screen={route.screen} navigate={route.navigate} />
      <main
        className="main-shell"
        id="main-content"
        ref={main}
        tabIndex={-1}
        data-screen={route.screen}
        aria-label={TITLES[route.screen]}
      >
        <TopBar screen={route.screen} navigate={route.navigate} />
        {alarm.ringing && (
          <AlarmBanner alarm={alarm.alarm} onSnooze={alarm.snooze} onDismiss={alarm.dismiss} />
        )}
        <OfflineNotice />
        <StationBanner
          banner={updates.banner}
          live={updates.live}
          liveDismissed={updates.liveDismissed}
          onWatch={watching.watchLive}
          onListenScreen={route.screen === "listen"}
        />
        <div className="page-content">
          <Screen id="listen" label="Listen live" current={route.screen}>
            <ListenScreen
              playlist={playlist}
              live={updates.live}
              onWatch={watching.watchLive}
              onOpenShow={route.openShow}
            />
          </Screen>
          <Screen id="shows" label="Shows" current={route.screen}>
            <ShowsScreen onOpen={route.openShow} />
          </Screen>
          {VIDEOS_ENABLED && features.videos && (
            <Screen id="videos" label="Videos" current={route.screen}>
              <Videos onWatch={watching.watchVideo} />
            </Screen>
          )}
          {CONCERTS_ENABLED && features.concerts && (
            <Screen id="concerts" label="Concerts" current={route.screen}>
              <Concerts result={concerts} />
            </Screen>
          )}
          <Screen id="favorites" label="Favorites" current={route.screen}>
            <LibraryScreen
              onOpenShow={route.openShow}
              onOpenVideo={watching.watchVideo}
              onNavigate={route.navigate}
            />
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
      <TabBar screen={route.screen} navigate={route.navigate} />
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
          onWatch={watching.watchVideo}
        />
      )}
      <Suspense fallback={null}>
        {welcome && !show && <Welcome onDone={finishWelcome} />}
        <UpdatePrompt />
        {watching.watching && (
          <WatchPage
            videoId={route.videoId}
            live={watching.live}
            onPick={watching.watchVideo}
            onClose={route.closeVideo}
          />
        )}
      </Suspense>
      <Toast />
    </div>
  );
}
