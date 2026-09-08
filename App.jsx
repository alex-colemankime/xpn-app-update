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
import { SHOWS, easternParts, clockLabel } from "./catalog.js";
import { useFavorites } from "./favorites.js";
import { useAlarmSettings, dateKey, timeKey } from "./alarm.js";
import { readJson, writeJson } from "./storage.js";
import { Icon, Art, Empty, shareText } from "./ui.jsx";
import {
  ShowsScreen,
  ShowDetail,
  ConcertsScreen,
  LibraryScreen,
  SettingsScreen,
  TrackRow,
  SaveSong,
  useConcerts,
} from "./screens.jsx";

const NAV = [
  { id: "listen", label: "Listen live", icon: "navLive" },
  { id: "library", label: "Favorites", icon: "heart" },
  { id: "shows", label: "Shows", icon: "headphones" },
  { id: "concerts", label: "Concerts", icon: "navConcerts" },
];
const stationDetails = { xpn: "88.5 FM", xpn2: "XPoNential Radio", kids: "Kids Corner" };

export default function App() {
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
  const playlist = useNowPlaying(streamId);
  const favorites = useFavorites("songs");
  const concerts = useConcerts();
  const [minute, setMinute] = useState(Date.now());
  const headings = useRef(null);
  const station = STREAMS[streamId];
  const current = playlist.tracks[0];
  const eastern = easternParts(new Date(minute));
  const minutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const fresh =
    current?.date === eastern.date &&
    minutes(eastern.time) - minutes(current.time) >= 0 &&
    minutes(eastern.time) - minutes(current.time) < 15 &&
    playlist.status === "ready";
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
  useEffect(() => {
    if (!alarm.enabled) return;
    const tick = () => {
      const now = new Date();
      if (alarm.snoozeUntil && now.getTime() < alarm.snoozeUntil) return;
      const snoozeDue = alarm.snoozeUntil > 0 && now.getTime() >= alarm.snoozeUntil;
      const due =
        alarm.repeatDays.includes(now.getDay()) &&
        timeKey(now) === alarm.time &&
        alarm.lastTriggeredDate !== dateKey(now);
      if (!due && !snoozeDue) return;
      startAlarm();
      setRinging(true);
      updateAlarm({ lastTriggeredDate: dateKey(now), snoozeUntil: 0 });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [alarm]);
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
            <div className="listen-heading">
              <h1>Listen live</h1>
              <div className="station-switcher" role="group" aria-label="Radio station">
                {Object.values(STREAMS).map((s) => (
                  <button
                    key={s.id}
                    className={`station ${streamId === s.id ? "selected" : ""}`}
                    aria-pressed={streamId === s.id}
                    onClick={() => pickStation(s.id)}
                  >
                    <strong>{s.label}</strong>
                    <span>
                      {s.id === "xpn" ? "88.5 FM" : s.id === "xpn2" ? "XPoNential Radio" : ""}
                    </span>
                    {streamId === s.id && <i />}
                  </button>
                ))}
              </div>
            </div>
            <div className="live-workspace">
              <section className="now-card" aria-label="Current song">
                <div className="now-card-header">
                  <span className="live-label">
                    <i />
                    {station.label.toUpperCase()} LIVE
                  </span>
                  <span>{stationDetails[streamId]}</span>
                </div>
                <div className="now-art">
                  {current?.img ? (
                    <Art
                      src={current.img}
                      alt={`${current.album || current.title} — ${current.artist}`}
                    />
                  ) : (
                    <div className="station-art">
                      <strong>
                        {streamId === "kids"
                          ? "Kids Corner"
                          : streamId === "xpn2"
                            ? "xpn2"
                            : "wxpn"}
                      </strong>
                      <span>{station.tagline}</span>
                    </div>
                  )}
                </div>
                <div className="now-info" aria-live="polite">
                  <span className="eyebrow">
                    {current
                      ? fresh
                        ? "NOW PLAYING"
                        : "LAST REPORTED SONG"
                      : playlist.status === "loading"
                        ? "LOADING SONG INFO"
                        : "LIVE STREAM"}
                  </span>
                  <h2>{current?.title || station.label}</h2>
                  <p className="now-artist">{current?.artist || station.tagline}</p>
                  {current?.album && <p className="now-album">{current.album}</p>}
                </div>
                <div className="now-controls">
                  {current ? <SaveSong track={current} /> : <span className="control-space" />}
                  <button
                    className="primary-button"
                    onClick={togglePlay}
                    aria-label={
                      status === "loading"
                        ? "Cancel connecting"
                        : `${playing ? "Pause" : "Play"} ${station.label}`
                    }
                  >
                    <Icon name={playing || status === "loading" ? "pause" : "play"} size={21} />
                    {playLabel}
                  </button>
                  {current ? (
                    <button
                      className="icon-button"
                      aria-label={`Share ${current.title}`}
                      onClick={async () =>
                        setMessage(
                          await shareText(
                            current.title,
                            `${current.title} — ${current.artist}, heard on ${station.label}`,
                          ),
                        )
                      }
                    >
                      <Icon name="shareAlt" />
                    </button>
                  ) : (
                    <span className="control-space" />
                  )}
                </div>
                <div className="now-status" role="status">
                  {status === "error"
                    ? "The stream could not connect. Tap Try again."
                    : playlist.status === "unavailable"
                      ? streamId === "kids"
                        ? "Song information is not available for this stream."
                        : "Song updates are temporarily unavailable. Audio is independent."
                      : !current && playlist.status === "empty"
                        ? "Waiting for the station’s next song update."
                        : playing
                          ? "Listening live"
                          : status === "loading"
                            ? "Connecting to the live broadcast…"
                            : "Press play to join the live broadcast."}
                </div>
                <div className="now-footer">
                  <span>
                    {current?.time ? `Reported at ${clockLabel(current.time)} ET` : "Live radio"}
                  </span>
                  {canCast() && (
                    <button className="text-button" onClick={cast}>
                      <Icon name="cast" size={16} />
                      Audio output
                    </button>
                  )}
                </div>
              </section>
              <div className="live-lists">
                <section className="recent-panel">
                  <div className="section-heading">
                    <h2>Recently played</h2>
                    <span className="subtle">{station.label} · ET</span>
                  </div>
                  {playlist.tracks.length > 1 ? (
                    <>
                      {playlist.tracks.slice(1, historyExpanded ? 51 : 7).map((t, i) => (
                        <TrackRow key={`${t.title}-${t.time}-${i}`} track={t} />
                      ))}
                      {playlist.tracks.length > 7 && (
                        <button
                          className="text-button playlist-expand"
                          onClick={() => setHistoryExpanded(!historyExpanded)}
                        >
                          {historyExpanded ? "Show fewer songs" : "Show more songs"}
                          <Icon name={historyExpanded ? "chevD" : "arrowRight"} size={17} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="playlist-empty">
                      <Icon name="music" size={25} />
                      <p>
                        {playlist.status === "loading"
                          ? "Loading the station playlist…"
                          : streamId === "kids"
                            ? "A playlist is not available for Kids Corner."
                            : "The station has not reported any recent songs."}
                      </p>
                      {streamId !== "kids" && (
                        <a
                          className="text-button"
                          href="https://xpn.org/wxpn-playlists/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open WXPN’s playlist
                          <Icon name="arrowUp" size={16} />
                        </a>
                      )}
                    </div>
                  )}
                </section>
                <section className="saved-preview">
                  <div className="section-heading">
                    <h2>Your saved songs</h2>
                    <button className="text-button" onClick={() => navigate("library")}>
                      View all
                      <Icon name="arrowRight" size={16} />
                    </button>
                  </div>
                  {favorites.items.length ? (
                    favorites.items.slice(0, 3).map((t) => <TrackRow key={t.id} track={t} />)
                  ) : (
                    <p className="saved-empty">Tap the heart beside a song to save it here.</p>
                  )}
                </section>
              </div>
            </div>
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
              alarm={alarm}
              updateAlarm={updateAlarm}
              onPreviewAlarm={startAlarm}
              volume={volume}
              onVolume={changeVolume}
              canCast={canCast()}
              onCast={cast}
            />
          </section>
        </div>
      </main>
      <footer className="player-bar" aria-label="Radio player">
        <button className="player-track" onClick={() => navigate("listen")}>
          {current?.img ? (
            <Art src={current.img} />
          ) : (
            <span className="station-mark">
              {streamId === "xpn2" ? "xpn2" : streamId === "kids" ? "KC" : "xpn"}
            </span>
          )}
          <span>
            <strong>{current?.title || station.label}</strong>
            <small>{current ? `${current.artist} · ${station.label}` : station.tagline}</small>
          </span>
        </button>
        <div className="player-center">
          <button
            className="player-play"
            onClick={togglePlay}
            aria-label={
              status === "loading"
                ? "Cancel connecting to radio"
                : playing
                  ? "Pause live radio"
                  : "Play live radio"
            }
          >
            <Icon name={playing || status === "loading" ? "pause" : "play"} size={21} />
          </button>
          <span className="player-live">
            <i />
            {status === "loading" ? "CONNECTING" : playing ? "LIVE" : "PAUSED"}
          </span>
        </div>
        <div className="player-utilities">
          {current && <SaveSong track={current} />}
          <Icon name="volume" size={19} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => changeVolume(+e.target.value)}
          />
          {canCast() && (
            <button className="icon-button" aria-label="Choose audio output" onClick={cast}>
              <Icon name="cast" size={19} />
            </button>
          )}
        </div>
      </footer>
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
