import { useEffect, useRef, useState } from "react";
import {
  cancelSleepTimer,
  selectStream,
  sleepUntil,
  startSleepTimer,
  togglePlayback,
} from "../player.js";
import { STREAMS } from "../streams.js";
import { playedLabel, useLiveSong } from "../nowplaying.js";
import { onAirAt, untilLabel } from "../catalog.js";
import { localClock } from "../time.js";
import { playbackText, statusLine } from "../playback-text.js";
import { useFavoriteItems } from "../favorites.js";
import { showToast } from "../toast.js";
import { Icon, Art, Wordmark, Segmented, focusFirstItem } from "../ui.jsx";
import { SaveSong, SongMenu, TrackRow } from "../components/MusicRows.jsx";
import { usePlayer, useSleepTimer, chooseAudioOutput } from "../hooks/usePlayer.js";
import { useNow } from "../hooks/useNow.js";
import { PLAYLIST_URL } from "../links.js";
import { LiveCard } from "../components/StationUpdates.jsx";

const STATION_OPTIONS = Object.values(STREAMS).map((s) => ({ value: s.id, label: s.label }));
const RECENT_PREVIEW = 6;
const RECENT_MAX = 50;

// Who is on the air right now, from the FM schedule. Radio is its hosts, so
// this leads the screen: a band in the show's own color, like a station's
// studio sign. Tapping opens the show.
function OnAir({ onAirNow, playing, onOpenShow }) {
  if (!onAirNow) return null;
  const { show } = onAirNow;
  const until = untilLabel(onAirNow);
  return (
    <button
      className="on-air"
      onClick={() => onOpenShow(show.id)}
      style={
        show.tint ? { "--tint-light": show.tint.light, "--tint-dark": show.tint.dark } : undefined
      }
    >
      <Art className="on-air-art" src={show.img} alt="" />
      <span className="on-air-text">
        <span className="on-air-label">
          <i className="on-air-dot" data-live={playing || undefined} />
          On air{until ? ` · ${until}` : ""}
        </span>
        <span className="on-air-show">{show.name}</span>
        {show.host && <span className="on-air-host">{show.host}</span>}
      </span>
      <Icon name="chev" size={18} />
      <span className="sr-only">Show details</span>
    </button>
  );
}

// Three bars that dance while audio plays: the universal "this is live" cue.
const EqBars = () => (
  <span className="eq" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const SLEEP_MINUTES = [15, 30, 45, 60];

// Stop playback after a while, fading out; lives in a popover so it needs no
// screen of its own. Only offered while there is audio to stop.
function SleepTimer({ onAirNow }) {
  const endsAt = useSleepTimer();
  const now = useNow();
  const { playing, connecting } = usePlayer();
  if (!endsAt && !playing && !connecting) return null;
  const left = endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60000)) : 0;
  const close = () => document.getElementById("sleep-menu")?.hidePopover?.();
  const choose = (minutes, label) => {
    startSleepTimer(minutes);
    close();
    showToast(`Playback will stop ${label}.`);
  };
  // Worked out at the tap, from the clock and the show's real end time, so
  // a menu opened a moment ago can't stop a minute into the next show.
  const untilShowEnds = () => {
    const live = onAirAt();
    close();
    if (!live) return;
    sleepUntil(live.endsAt);
    showToast(`Playback will stop when ${live.show.name} ends.`);
  };
  return (
    <>
      <button
        className={`text-button sleep-button ${endsAt ? "active" : ""}`}
        popoverTarget="sleep-menu"
        aria-label={endsAt ? `Sleep timer: ${left} minutes left. Change` : "Set a sleep timer"}
      >
        <Icon name="moon" size={16} />
        {endsAt ? `${left} min` : "Sleep"}
      </button>
      <div
        id="sleep-menu"
        onToggle={focusFirstItem}
        className="popover-menu sleep-menu"
        popover="auto"
        role="dialog"
        aria-labelledby="sleep-title"
      >
        <p id="sleep-title" className="popover-menu-title">
          Stop playing after
        </p>
        {SLEEP_MINUTES.map((m) => (
          <button key={m} onClick={() => choose(m, `in ${m === 60 ? "an hour" : `${m} minutes`}`)}>
            {m === 60 ? "1 hour" : `${m} minutes`}
          </button>
        ))}
        {onAirNow && (
          <button onClick={untilShowEnds}>
            End of {onAirNow.show.name}
            <small>at {localClock(onAirNow.endsAt)}</small>
          </button>
        )}
        {endsAt && (
          <button
            className="sleep-off"
            onClick={() => {
              cancelSleepTimer();
              close();
            }}
          >
            Turn off timer
          </button>
        )}
      </div>
    </>
  );
}

// While the big controls are on screen, the phone layout hides the mini
// player, which would only repeat them; it slides back once they scroll away.
function useHeroVisibility(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    let observer;
    const nav = document.querySelector(".mobile-nav");
    const observe = () => {
      observer?.disconnect();
      // The tab bar covers part of the viewport. The mini player steps aside
      // as soon as the full main transport fits above the navigation.
      const bottom = nav?.offsetHeight || 0;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.99)
            root.dataset.heroVisible = "";
          else delete root.dataset.heroVisible;
        },
        { rootMargin: `0px 0px -${bottom}px 0px`, threshold: [0, 0.99, 1] },
      );
      observer.observe(el);
    };
    observe();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(observe) : null;
    if (nav) resize?.observe(nav);
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", observe);
      delete root.dataset.heroVisible;
    };
  }, [ref]);
}

function NowPlaying({ playlist, onOpenShow }) {
  const player = usePlayer();
  const { station, streamId, playing, connecting, castAvailable } = player;
  const now = useNow();
  // Only a fresh report is presented as playing; an old one waits in
  // Recently played.
  const current = useLiveSong(playlist);
  const text = playbackText(player);
  const controls = useRef(null);
  useHeroVisibility(controls);
  // The FM schedule only describes WXPN; XPN2 and Homegrown have none.
  const onAirNow = streamId === "xpn" ? onAirAt(new Date(now)) : null;
  const eyebrow = current
    ? "NOW PLAYING"
    : playlist.status === "loading" && station.songFeed
      ? "LOADING SONG INFO"
      : "LIVE RADIO";
  // Keyed on the song, so a new song fades in rather than snapping.
  const songKey = current ? `${current.date}-${current.time}-${current.title}` : streamId;

  return (
    <section className="now-card" aria-label="Current song">
      <OnAir onAirNow={onAirNow} playing={playing} onOpenShow={onOpenShow} />
      <div className="now-stage">
        <div className="now-art" key={`art-${songKey}`}>
          {current?.img ? (
            <>
              {/* The artwork, blurred behind itself, tints the stage in each
                  song's own colors. */}
              <img className="now-art-glow" src={current.img} alt="" aria-hidden="true" />
              <Art
                src={current.img}
                alt={`${current.album || current.title} — ${current.artist}`}
                fetchPriority="high"
              />
            </>
          ) : (
            <div className="station-art">
              <strong>
                <Wordmark text={station.mark} />
              </strong>
            </div>
          )}
        </div>
        <div className="now-meta">
          <div className="now-info" key={`info-${songKey}`}>
            <span className="eyebrow">
              {playing && current && <EqBars />}
              {eyebrow}
            </span>
            <h2>{current?.title || station.label}</h2>
            <p className="now-artist">{current?.artist || station.tagline}</p>
            {current?.album &&
              current.album !== current.artist &&
              current.album !== current.title && <p className="now-album">{current.album}</p>}
          </div>
          {/* The song's own actions sit with the song. */}
          {current && (
            <div className="now-song-actions">
              <SaveSong track={current} />
              <SongMenu track={current} stationLabel={station.label} />
            </div>
          )}
        </div>
        {/* One steady live region: screen readers hear each new song once,
            and only while it is playing. */}
        <p className="sr-only" aria-live="polite">
          {playing && current ? `Now playing: ${current.title} by ${current.artist}` : ""}
        </p>
        <div className="now-controls" ref={controls}>
          {/* A labeled button, so it reads as "listen to the station", not a
              generic media control. The visible words lead its name. */}
          <button
            className="primary-button hero-play"
            onClick={togglePlayback}
            data-busy={connecting || undefined}
          >
            <Icon name={playing || connecting ? "pause" : "play"} size={22} />
            {text.button}
            <span className="sr-only">, {station.label}</span>
          </button>
          {castAvailable && (
            <button
              className="hero-cast"
              onClick={chooseAudioOutput}
              aria-label="Play on another device"
              title="Play on another device"
            >
              <Icon name="cast" size={22} />
            </button>
          )}
        </div>
        <div className="now-status" role="status">
          {statusLine(player, playlist)}
        </div>
        <div className="now-footer">
          <span>{current ? playedLabel(current, new Date(now)) : ""}</span>
          <SleepTimer onAirNow={onAirNow} />
        </div>
      </div>
    </section>
  );
}

// Row-shaped placeholders while the playlist loads, so the list appears in
// place rather than replacing a line of text.
function SkeletonRows({ count = 5 }) {
  return (
    <div role="status">
      <span className="sr-only">Loading the station playlist…</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="track-row skeleton-row" aria-hidden="true" key={i}>
          <span className="skeleton-block skeleton-art" />
          <span className="skeleton-lines">
            <span className="skeleton-block skeleton-line" />
            <span className="skeleton-block skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

// Keyed by station in the parent, so switching stations collapses the list.
function RecentlyPlayed({ playlist, station }) {
  const [expanded, setExpanded] = useState(false);
  const live = useLiveSong(playlist);
  // Everything but the song shown above; a stale latest report leads here.
  const earlier = live ? playlist.tracks.slice(1) : playlist.tracks;
  return (
    <section className="recent-panel" aria-labelledby="recent-heading">
      <div className="section-heading">
        <h2 id="recent-heading">Recently played</h2>
        <span className="subtle">{station.label}</span>
      </div>
      {playlist.status === "loading" && !earlier.length ? (
        <SkeletonRows />
      ) : earlier.length ? (
        <>
          {earlier.slice(0, expanded ? RECENT_MAX : RECENT_PREVIEW).map((t) => (
            <TrackRow key={`${t.date}-${t.time}-${t.title}`} track={t} showTime />
          ))}
          <div className="playlist-more">
            {earlier.length > RECENT_PREVIEW && (
              <button
                className="text-button playlist-expand"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show fewer songs" : "Show more songs"}
                <span className={`expand-chevron ${expanded ? "up" : ""}`}>
                  <Icon name="chevD" size={17} />
                </span>
              </button>
            )}
            {/* Earlier days, and searching what played, live on the website. */}
            {(expanded || earlier.length <= RECENT_PREVIEW) && (
              <a className="text-button" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
                Full playlist on xpn.org
                <Icon name="arrowUp" size={16} />
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="playlist-empty">
          <Icon name="music" size={25} />
          <p>The station has not reported any recent songs.</p>
          <a className="text-button" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
            Open WXPN’s playlist
            <Icon name="arrowUp" size={16} />
          </a>
        </div>
      )}
    </section>
  );
}

function SavedPreview({ onNavigate }) {
  const saved = useFavoriteItems("songs");
  return (
    <section className="saved-preview" aria-labelledby="saved-heading">
      <div className="section-heading">
        <h2 id="saved-heading">Your saved songs</h2>
        {saved.length > 0 && (
          <button className="text-button" onClick={() => onNavigate("favorites")}>
            View all
            <Icon name="arrowRight" size={16} />
          </button>
        )}
      </div>
      {saved.length ? (
        saved.slice(0, 3).map((t) => <TrackRow key={t.id} track={t} />)
      ) : (
        <p className="saved-empty">Tap the heart beside a song to save it here.</p>
      )}
    </section>
  );
}

export function ListenScreen({ playlist, live, onWatch, onNavigate, onOpenShow }) {
  const { streamId, station } = usePlayer();
  return (
    <>
      <div className="listen-heading">
        <h1>Listen live</h1>
        <Segmented
          label="Radio station"
          className="station-switcher"
          value={streamId}
          onChange={selectStream}
          options={STATION_OPTIONS}
        />
      </div>
      <LiveCard live={live} onWatch={onWatch} />
      <div className="live-workspace">
        <NowPlaying playlist={playlist} onOpenShow={onOpenShow} />
        <div className="live-lists">
          {/* Homegrown publishes no playlist, so it has no list to show. */}
          {station.songFeed && (
            <RecentlyPlayed key={streamId} playlist={playlist} station={station} />
          )}
          <SavedPreview onNavigate={onNavigate} />
        </div>
      </div>
    </>
  );
}
