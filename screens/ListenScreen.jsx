import { useEffect, useRef, useState } from "react";
import { useArtTint } from "../art-tint.js";
import { selectStream, togglePlayback } from "../player.js";
import { STATION_OPTIONS } from "../streams.js";
import { refreshPlaylist, useLiveSong } from "../nowplaying.js";
import { onAirAt } from "../catalog.js";
import { playbackText, statusLine } from "../playback-text.js";
import { Icon, Art, EqBars, Wordmark, Segmented, SkeletonList } from "../ui.jsx";
import { heartSong, SaveSong, SongMenu, TrackRow } from "../components/MusicRows.jsx";
import { OnAir, videoOfShow } from "../components/OnAir.jsx";
import { SleepTimer } from "../components/SleepTimer.jsx";
import { LiveCard } from "../components/StationUpdates.jsx";
import { CAST_KIND } from "../cast.js";
import { usePlayer, chooseAudioOutput } from "../hooks/usePlayer.js";
import { useHeroVisibility } from "../hooks/useHeroVisibility.js";
import { useNow } from "../hooks/useNow.js";
import { PLAYLIST_URL } from "../links.js";
import { PullToRefresh } from "../components/PullToRefresh.jsx";

const RECENT_PREVIEW = 6;
const RECENT_MAX = 50;

// Two taps on the artwork in quick succession, close together, heart the
// song, and a heart blooms over it. Each bloom has its own key, so a second
// double tap plays it again. Pointer events, so it works the same for a
// finger and a mouse; a tap that turns into a scroll is cancelled by the
// browser and never counts.
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 40;
function useDoubleTapHeart(song) {
  const [bloom, setBloom] = useState(0);
  const last = useRef(null);
  const onPointerUp = (e) => {
    if (!song || (e.pointerType === "mouse" && e.button !== 0)) return;
    const prev = last.current;
    const near =
      prev &&
      e.timeStamp - prev.at < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_SLOP;
    if (!near) {
      last.current = { at: e.timeStamp, x: e.clientX, y: e.clientY };
      return;
    }
    last.current = null;
    heartSong(song);
    setBloom((n) => n + 1);
  };
  return { bloom, onPointerUp, onBloomEnd: () => setBloom(0) };
}

// While Listen is in front, the page takes a light wash of the playing
// song's artwork color (styles/base.css, data-art-wash). Artwork with no
// color leaves the page as it is.
function useArtWash(art) {
  const wash = useArtTint(art || null);
  useEffect(() => {
    if (!wash) return;
    const root = document.documentElement;
    root.style.setProperty("--wash-light", wash.light);
    root.style.setProperty("--wash-dark", wash.dark);
    root.dataset.artWash = "";
    return () => {
      delete root.dataset.artWash;
    };
  }, [wash]);
}

function NowPlaying({ playlist, onOpenShow, live, onWatch }) {
  const player = usePlayer();
  const { station, streamId, playing, connecting, castAvailable } = player;
  const now = useNow();
  // Only a fresh report is presented as playing; an old one waits in
  // Recently played.
  const current = useLiveSong(playlist);
  useArtWash(current?.img);
  const text = playbackText(player);
  const heart = useDoubleTapHeart(current);
  const controls = useRef(null);
  useHeroVisibility(controls);
  // The FM schedule only describes WXPN; XPN2 and Homegrown have none.
  const onAirNow = streamId === "xpn" ? onAirAt(new Date(now)) : null;
  const eyebrow = current
    ? "Now playing"
    : playlist.status === "loading" && station.songFeed
      ? "Loading song info"
      : "Live radio";
  // Keyed on the song, so a new song fades in rather than snapping.
  const songKey = current ? `${current.date}-${current.time}-${current.title}` : streamId;

  return (
    <section className="now-card" aria-label="Current song">
      <OnAir
        onAirNow={onAirNow}
        playing={playing}
        onOpenShow={onOpenShow}
        live={live}
        onWatch={onWatch}
      />
      <div className="now-stage">
        <div className="now-art" key={`art-${songKey}`} onPointerUp={heart.onPointerUp}>
          {current?.img ? (
            <>
              {/* The artwork, blurred behind itself, tints the stage in each
                  song's own colors. */}
              <img className="now-art-glow" src={current.img} alt="" aria-hidden="true" />
              <Art
                src={current.img}
                alt={`${current.album || current.title} — ${current.artist}`}
                fetchPriority="high"
                draggable={false}
              />
            </>
          ) : (
            <div className="station-art">
              <strong>
                <Wordmark text={station.mark} />
              </strong>
            </div>
          )}
          {heart.bloom > 0 && (
            <span
              key={heart.bloom}
              className="art-heart"
              aria-hidden="true"
              onAnimationEnd={heart.onBloomEnd}
            >
              <Icon name="heartF" size={88} />
            </span>
          )}
        </div>
        {/* The label and the song's own actions (heart, menu) share the top
            line, so the title below has the full width of the stage and
            never wraps around them. */}
        <div className="now-meta">
          <span className="eyebrow now-eyebrow">
            {playing && current && <EqBars />}
            {eyebrow}
          </span>
          <div className="now-info" key={`info-${songKey}`}>
            <h2>{current?.title || station.label}</h2>
            {/* Artist, then the album after it on the same line, quieter. */}
            <p className="now-artist">
              <span>{current?.artist || station.tagline}</span>
              {current?.album &&
                current.album !== current.artist &&
                current.album !== current.title && (
                  <span className="now-album"> · {current.album}</span>
                )}
            </p>
          </div>
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
              <Icon name={CAST_KIND || "cast"} size={22} />
            </button>
          )}
        </div>
        <div className="now-status" role="status">
          {statusLine(player, playlist)}
        </div>
        <div className="now-footer">
          <SleepTimer onAirNow={onAirNow} />
        </div>
      </div>
    </section>
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
        <SkeletonList
          label="Loading the station playlist…"
          count={5}
          rowClass="track-row"
          artClass="skeleton-art"
        />
      ) : earlier.length ? (
        <>
          {earlier.slice(0, expanded ? RECENT_MAX : RECENT_PREVIEW).map((t) => (
            <TrackRow
              key={`${t.date}-${t.time}-${t.title}`}
              track={t}
              showTime
              stationLabel={station.label}
            />
          ))}
          <div className="playlist-more">
            {earlier.length > RECENT_PREVIEW && (
              <button
                className="text-button"
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
          </a>
        </div>
      )}
    </section>
  );
}

export function ListenScreen({ playlist, live, onWatch, onOpenShow }) {
  const { streamId, station } = usePlayer();
  const now = useNow();
  // During the show's own live video the on-air band carries it instead.
  const merged = streamId === "xpn" && videoOfShow(live, onAirAt(new Date(now)));
  return (
    <>
      {station.songFeed && <PullToRefresh onRefresh={refreshPlaylist} />}
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
      {!merged && <LiveCard live={live} onWatch={onWatch} />}
      <div className="live-workspace">
        <NowPlaying playlist={playlist} onOpenShow={onOpenShow} live={live} onWatch={onWatch} />
        <div className="live-lists">
          {/* Homegrown publishes no playlist, so it has no list to show. */}
          {station.songFeed && (
            <RecentlyPlayed key={streamId} playlist={playlist} station={station} />
          )}
        </div>
      </div>
    </>
  );
}
