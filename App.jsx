import { useState, useEffect, useRef } from "react";
import {
  initPlayer,
  playStream,
  pauseStream,
  setStream,
  setPlayerVolume,
  setMetadata,
  canCast,
  promptCast,
  STREAMS,
} from "./player.js";
import { useNowPlaying } from "./nowplaying.js";
import { easternParts, reportedMinutes } from "./catalog.js";
import { useFavorites } from "./favorites.js";
import { useAlarmSettings, dateKey, minutesSinceAlarm, CATCHUP_MINUTES } from "./alarm.js";
import { readJson, writeJson } from "./storage.js";
import { Icon } from "./ui.jsx";
import { ListenScreen } from "./screens/ListenScreen.jsx";
import { PlayerBar } from "./components/PlayerBar.jsx";
import { useAppearance } from "./hooks/useAppearance.js";
import { ShowsScreen, ShowDetail } from "./screens/ShowsScreen.jsx";
import { useConcerts } from "./hooks/useConcerts.js";
import { ConcertsScreen } from "./screens/ConcertsScreen.jsx";
import { LibraryScreen } from "./screens/LibraryScreen.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";

const NAV = [
  { id: "listen", label: "Listen live", icon: "navLive" },
  { id: "library", label: "Favorites", icon: "heart" },
  { id: "shows", label: "Shows", icon: "headphones" },
  { id: "concerts", label: "Concerts", icon: "navConcerts" },
];

export default function App() {
  const [appearance, setAppearance] = useAppearance();
  const [screen, setScreen] = useState("listen");
  const [streamId, setStreamId] = useState("xpn");
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("paused");
  const [volume, setVolume] = useState(() => Number(readJson("xpn.volume", 70)) || 0);
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [alarm, updateAlarm] = useAlarmSettings();
  const [ringing, setRinging] = useState(false);
  const [castAvailable, setCastAvailable] = useState(false);
  const playlist = useNowPlaying(streamId);
  const favorites = useFavorites("songs");
  const concerts = useConcerts();
  const [minute, setMinute] = useState(Date.now());
  const headings = useRef(null);
  const station = STREAMS[streamId];
  const current = playlist.tracks[0];
  const eastern = easternParts(new Date(minute));
  // Age of the reported song in minutes. Both stamps are absolute, so a song
  // reported at 23:58 is still current at 00:01.
  const reportedAge = (() => {
    const now = reportedMinutes(eastern.date, eastern.time);
    const then = current && reportedMinutes(current.date, current.time);
    return now === null || then === null || then === undefined ? null : now - then;
  })();
  const fresh = playlist.status === "ready" && reportedAge !== null && reportedAge >= 0 && reportedAge < 15;
  const playLabel =
    status === "loading"
      ? "Connecting…"
      : playing
        ? "Pause"
        : status === "error"
          ? "Try again"
          : "Listen live";
  const togglePlay = () => {
    if (playing || status === "loading") pauseStream();
    else {
      playStream();
      window.dispatchEvent(new Event("wxpn:refresh-playlist"));
    }
  };
  const changeVolume = (value) => {
    setVolume(value);
    setPlayerVolume(value);
    writeJson("xpn.volume", value);
  };
  const navigate = (id) => {
    setScreen(id);
    setSelectedShow(null);
    setSelectedEpisode(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headings.current?.focus());
  };
  const pickStation = (id) => {
    if (setStream(id)) {
      setStreamId(id);
      setHistoryExpanded(false);
    }
  };
  const openShow = (show) => {
    setSelectedShow(show);
    setSelectedEpisode(null);
  };
  const listenTo = (id) => {
    pickStation(id);
    playStream();
    setSelectedShow(null);
    setSelectedEpisode(null);
    navigate("listen");
  };
  const cast = async () => {
    try {
      await promptCast();
    } catch (error) {
      if (error.name !== "NotAllowedError")
        setMessage("No audio output is available. Use your device’s audio controls.");
    }
  };
  const startAlarm = () => {
    setPlayerVolume(alarm.volume);
    setVolume(alarm.volume);
    pickStation(alarm.streamId);
    playStream();
  };
  useEffect(() => {
    initPlayer(setPlaying, setStatus);
    setPlayerVolume(volume);
    // canCast() reads the audio element, which only exists after initPlayer,
    // so it cannot be evaluated during the first render.
    setCastAvailable(canCast());
    return () => pauseStream();
  }, []);
  useEffect(() => {
    setMetadata(current || { title: station.label, artist: station.tagline });
  }, [current?.title, current?.artist, current?.img, station.id, playing]);
  useEffect(() => {
    const timer = setInterval(() => setMinute(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  // The scheduler reads the latest alarm through a ref so that writing
  // lastTriggeredDate does not tear down and rebuild the interval.
  const alarmRef = useRef(null);
  useEffect(() => {
    alarmRef.current = { alarm, startAlarm, updateAlarm };
  });
  useEffect(() => {
    if (!alarm.enabled) return;
    const tick = () => {
      const { alarm: current, startAlarm: start, updateAlarm: update } = alarmRef.current;
      const now = new Date();
      if (current.snoozeUntil && now.getTime() < current.snoozeUntil) return;
      const snoozeDue = current.snoozeUntil > 0 && now.getTime() >= current.snoozeUntil;
      const since = minutesSinceAlarm(current.time, now);
      const due =
        current.repeatDays.includes(now.getDay()) &&
        current.lastTriggeredDate !== dateKey(now) &&
        since !== null &&
        since >= 0 &&
        since < CATCHUP_MINUTES;
      if (!due && !snoozeDue) return;
      start();
      setRinging(true);
      update({ lastTriggeredDate: dateKey(now), snoozeUntil: 0 });
    };
    // No immediate tick: enabling the alarm should not ring it.
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [alarm.enabled]);
  const closeAlarm = (snooze) => {
    pauseStream();
    setRinging(false);
    updateAlarm({ snoozeUntil: snooze ? Date.now() + alarm.snoozeMinutes * 60000 : 0 });
  };
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <button className="brand" onClick={() => navigate("listen")} aria-label="WXPN home">
          <span>
            wxpn<span className="brand-dot">.</span>
          </span>
          <small>88.5 FM · PHILADELPHIA</small>
        </button>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-button ${screen === n.id ? "active" : ""}`}
              aria-current={screen === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {screen === n.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="settings-button" onClick={() => navigate("settings")}>
            <Icon name="settings" size={18} />
            Settings
          </button>
          <a
            className="sidebar-donate"
            href="https://xpn.org/donate/"
            target="_blank"
            rel="noreferrer"
          >
            Support WXPN
            <Icon name="arrowUp" size={16} />
          </a>
        </div>
      </aside>
      <main className="main-shell" id="main-content" ref={headings} tabIndex={-1}>
        <header className="topbar">
          <span className="topbar-location">
            WXPN / <b>{NAV.find((n) => n.id === screen)?.label || "Settings"}</b>
          </span>
          <button
            className="mobile-brand"
            onClick={() => navigate("listen")}
            aria-label="WXPN home"
          >
            wxpn<span>.</span>
          </button>
          <a href="https://xpn.org/donate/" target="_blank" rel="noreferrer">
            Support WXPN
            <Icon name="arrowUp" size={15} />
          </a>
          <button
            className="mobile-settings icon-button"
            onClick={() => navigate("settings")}
            aria-label="Settings"
          >
            <Icon name="settings" />
          </button>
        </header>
        {ringing && (
          <div className="alarm-banner" role="status">
            <span>Radio alarm</span>
            <button onClick={() => closeAlarm(true)}>Snooze {alarm.snoozeMinutes} min</button>
            <button onClick={() => closeAlarm(false)}>Dismiss</button>
          </div>
        )}
        <div className="page-content">
          <section hidden={screen !== "listen"} aria-label="Listen live">
            <ListenScreen {...{ streamId, pickStation, station, current, fresh, playlist, status, playing, togglePlay, playLabel, setMessage, castAvailable, cast, historyExpanded, setHistoryExpanded, favorites, navigate }} />
          </section>
          <section hidden={screen !== "shows"}>
            <ShowsScreen onOpen={openShow} />
          </section>
          <section hidden={screen !== "concerts"}>
            <ConcertsScreen result={concerts} />
          </section>
          <section hidden={screen !== "library"}>
            <LibraryScreen
              onOpen={openShow}
              onEpisode={(show, ep) => {
                setSelectedShow(show);
                setSelectedEpisode(ep);
              }}
              onNavigate={navigate}
              concerts={concerts}
              onMessage={setMessage}
            />
          </section>
          <section hidden={screen !== "settings"}>
            <SettingsScreen
              appearance={appearance}
              onAppearance={setAppearance}
              alarm={alarm}
              updateAlarm={updateAlarm}
              onPreviewAlarm={startAlarm}
              volume={volume}
              onVolume={changeVolume}
              canCast={castAvailable}
              onCast={cast}
            />
          </section>
        </div>
      </main>
      <PlayerBar {...{ current, streamId, station, navigate, togglePlay, status, playing, volume, changeVolume, castAvailable, cast }} />
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={screen === n.id ? "active" : ""}
            aria-current={screen === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <Icon name={n.icon} size={21} />
            <span>{n.id === "listen" ? "Listen" : n.label}</span>
          </button>
        ))}
      </nav>
      {selectedShow && (
        <ShowDetail
          key={selectedShow.id + (selectedEpisode?.id || "")}
          show={selectedShow}
          initialEpisode={selectedEpisode}
          onClose={() => {
            setSelectedShow(null);
            setSelectedEpisode(null);
          }}
          onListen={listenTo}
        />
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
