import { useEffect, useRef, useState } from "react";
import { useArtTintState } from "../art-tint.js";
import { selectStream, togglePlayback } from "../player.js";
import { STATION_OPTIONS } from "../streams.js";
import { refreshPlaylist, useLiveSong } from "../nowplaying.js";
import { onAirAt } from "../catalog.js";
import { playbackText, statusLine } from "../playback-text.js";
import { Icon, Art, Wordmark, Segmented, SkeletonList } from "../ui.jsx";
import { HeartBloom, heartSong, SaveSong, SongMenu, TrackRow } from "../components/MusicRows.jsx";
import { OnAir, videoOfShow } from "../components/OnAir.jsx";
import { SleepTimer } from "../components/SleepTimer.jsx";
import { LiveCard } from "../components/StationUpdates.jsx";
import { CAST_KIND } from "../cast.js";
import { usePlayer, chooseAudioOutput } from "../hooks/usePlayer.js";
import { useHeroVisibility } from "../hooks/useHeroVisibility.js";
import { useNow } from "../hooks/useNow.js";
import { useDoubleTap } from "../hooks/useDoubleTap.js";
import { PLAYLIST_URL } from "../links.js";
import { PullToRefresh } from "../components/PullToRefresh.jsx";

const RECENT_PREVIEW = 6;
const RECENT_MAX = 50;

// A double tap on the artwork hearts the song, and a heart blooms over it
// in the song's own heart color (MusicRows.jsx, HeartBloom).
function useDoubleTapHeart(song) {
  const [bloom, setBloom] = useState(0);
  const onPointerUp = useDoubleTap(() => {
    if (!song) return;
    heartSong(song);
    setBloom((n) => n + 1);
  });
  return { bloom, onPointerUp, onBloomEnd: () => setBloom(0) };
}

// While Listen is in front, the page takes a light wash of the playing
// song's artwork color (styles/base.css, data-art-wash; art-tint.js,
// pageWash). While the next song's artwork is read, the last song's wash
// stays, so the page eases from one color to the next instead of dropping
// to plain in between. Artwork with no color of its own, no song, and
// leaving Listen leave the page plain.
function useArtWash(art) {
  const { tint, known } = useArtTintState(art || null);
  const wash = tint?.wash || null;
  useEffect(() => {
    if (!known) return; // still reading the new artwork: keep what's shown
    const root = document.documentElement;
    if (!wash) {
      plainPage();
      return;
    }
    root.style.setProperty("--wash-bg-light", wash.light);
    root.style.setProperty("--wash-bg-dark", wash.dark);
    root.dataset.artWash = "";
  }, [known, wash]);
  useEffect(() => plainPage, []);
}
function plainPage() {
  const root = document.documentElement;
  delete root.dataset.artWash;
  root.style.removeProperty("--wash-bg-light");
  root.style.removeProperty("--wash-bg-dark");
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
  // Keyed on the song, so a new song fades in rather than snapping.
  const songKey = current ? `${current.date}-${current.time}-${current.title}` : streamId;

  return (
    <section className="now-card" aria-label="Current song" data-playing={playing || undefined}>
      <OnAir onAirNow={onAirNow} onOpenShow={onOpenShow} live={live} onWatch={onWatch} />
      <div className="now-stage">
        <div className="now-art" key={`art-${songKey}`} onPointerUp={heart.onPointerUp}>
          {current?.img ? (
            <Art
              src={current.img}
              alt={`${current.album || current.title} — ${current.artist}`}
              fetchPriority="high"
              draggable={false}
            />
          ) : (
            <div className="station-art">
              <strong>
                <Wordmark text={station.mark} />
              </strong>
            </div>
          )}
          <HeartBloom type="songs" item={current} bloom={heart.bloom} onEnd={heart.onBloomEnd} />
        </div>
        {/* The song, across the whole width: its heart and menu are with
            the other things to do, in the row under it. */}
        <div className="now-meta">
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
            <span className="hero-play-label">{text.button}</span>
            <span className="sr-only">, {station.label}</span>
          </button>
          {/* Then, in the order they're reached for: save the song, more
              for it, and where it plays. */}
          {current && (
            <div className="now-song-actions">
              <SaveSong track={current} className="hero-key" />
              <SongMenu track={current} stationLabel={station.label} className="hero-key" />
            </div>
          )}
          {castAvailable && (
            <button
              className="hero-key hero-cast"
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
// Beside the song (two columns, wide screens), the list runs as far down as
// the artwork, the song and Listen live do, so there's no gap under it: as
// many songs as fit, never fewer than the phone's preview. Measured, and
// again whenever either side changes size.
function useRowsThatFit(panel) {
  const [fit, setFit] = useState(RECENT_PREVIEW);
  useEffect(() => {
    const list = panel.current;
    const card = list?.closest(".live-workspace")?.querySelector(".now-card");
    if (!list || !card || typeof ResizeObserver === "undefined") return;
    const wide = window.matchMedia("(min-width: 1001px)");
    const measure = () => {
      // The songs once they're in (not the loading placeholders).
      const rows = list.querySelector(".recent-rows");
      const row = rows?.querySelector(".track-row");
      if (!wide.matches || !row) return setFit(RECENT_PREVIEW);
      const used = list.getBoundingClientRect().height - rows.offsetHeight;
      const room = card.getBoundingClientRect().height - used;
      setFit(Math.max(RECENT_PREVIEW, Math.floor(room / row.getBoundingClientRect().height)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(list);
    wide.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [panel]);
  return fit;
}

function RecentlyPlayed({ playlist, station }) {
  const [expanded, setExpanded] = useState(false);
  const live = useLiveSong(playlist);
  const panel = useRef(null);
  const preview = useRowsThatFit(panel);
  // Everything but the song shown above; a stale latest report leads here.
  const earlier = live ? playlist.tracks.slice(1) : playlist.tracks;
  return (
    <section className="recent-panel" aria-labelledby="recent-heading" ref={panel}>
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
          <div className="recent-rows">
            {earlier.slice(0, expanded ? RECENT_MAX : preview).map((t) => (
              <TrackRow
                key={`${t.date}-${t.time}-${t.title}`}
                track={t}
                showTime
                stationLabel={station.label}
              />
            ))}
          </div>
          <div className="playlist-more">
            {earlier.length > preview && (
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
            {(expanded || earlier.length <= preview) && (
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
