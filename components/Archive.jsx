import { useRef, useState } from "react";
import { Art, Empty, Icon } from "../ui.jsx";
import { SaveButton } from "./MusicRows.jsx";
import { SHOWS } from "../catalog.js";
import { loadArchive, useArchive } from "../archive.js";
import { clockTime, lengthLabel, shortDay } from "../time.js";
import { SKIP_AHEAD_S, SKIP_BACK_S } from "../episode-core.js";
import {
  playEpisode,
  seekEpisode,
  skipEpisode,
  toggleEpisode,
  useEpisodePlayer,
  useEpisodeProgress,
} from "../episode-player.js";

const showName = (episode) => episode.showName || SHOWS[episode.show]?.name || "WXPN";
const showArt = (episode) => episode.image || episode.img || SHOWS[episode.show]?.img;

// What a saved episode needs to be shown in Favorites, even after it has
// left the feed. Not its audio link, which runs out: playing it reads a
// fresh one (archive.js, findEpisode).
const savedEpisodeItem = (episode) => ({
  id: episode.id,
  show: episode.show,
  showId: episode.show,
  showName: showName(episode),
  title: episode.title,
  date: episode.date,
  duration: episode.duration,
  image: episode.image,
  img: episode.image,
  summary: episode.summary,
  page: episode.page,
  aired: episode.aired,
  feature: episode.feature,
});

// This episode in the player: whether it is the one loaded, playing, and
// where it is. Live position for the loaded one, the saved place otherwise.
function useEpisodeState(episode) {
  const player = useEpisodePlayer();
  const saved = useEpisodeProgress(episode.id);
  const active = player.episode?.id === episode.id;
  const duration = (active && player.duration) || episode.duration || saved?.of || 0;
  const position = active ? player.position : saved?.done ? duration : saved?.at || 0;
  return {
    active,
    playing: active && player.status === "playing",
    busy: active && player.status === "loading",
    ended: active ? player.status === "ended" : Boolean(saved?.done),
    position,
    duration,
    started: position > 0,
  };
}

// Under an episode's title: who it features, its date when the title isn't
// one, then how long it is ("3 hr 52 min", "40 min left", "Played"), or,
// before the file has said, the slot it aired in ("6am–10am").
function rowMeta(episode, { ended, started, position, duration }) {
  const time = ended
    ? "Played"
    : started && duration
      ? `${lengthLabel(duration - position)} left`
      : lengthLabel(duration) || episode.aired;
  return [episode.feature, !episode.aired && shortDay(episode.date), time]
    .filter(Boolean)
    .join(" · ");
}

// The round play key on an episode row.
function EpisodePlayKey({ episode }) {
  const s = useEpisodeState(episode);
  const verb = s.playing || s.busy ? "Pause" : s.started && !s.ended ? "Resume" : "Play";
  const label = `${verb} ${showName(episode)}, ${episode.title}`;
  return (
    <button
      className="episode-key"
      data-on={s.playing || s.busy || undefined}
      data-busy={s.busy || undefined}
      aria-label={label}
      onClick={() => toggleEpisode(episode)}
    >
      <Icon name={s.playing || s.busy ? "pause" : "play"} size={16} />
    </button>
  );
}

// A thin line showing how much of an episode has been heard.
function ProgressLine({ position, duration, ended }) {
  if (!duration || (!position && !ended)) return null;
  const pct = ended ? 100 : Math.min(100, (position / duration) * 100);
  return (
    <span className="episode-progress" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

// An episode in a list: its title (the day it aired, or who it features),
// how long it is or how much is left, its heart and play key. Among one
// show's episodes that is all; where shows mix (Favorites), the show's art
// and name lead. The row opens the episode. A saved episode known to have
// left the archive (`gone`) says so, with no play key.
export function EpisodeRow({ episode, onOpen, showShow = true, gone = false }) {
  const s = useEpisodeState(episode);
  return (
    <div
      className="archive-row"
      data-active={s.active || undefined}
      data-plain={!showShow || undefined}
    >
      <button className="archive-open" onClick={() => onOpen(episode)}>
        {showShow && <Art src={showArt(episode)} alt="" loading="lazy" />}
        <span className="archive-text">
          {showShow && <small className="archive-eyebrow">{showName(episode)}</small>}
          <strong>{episode.title}</strong>
          <small className="archive-meta">
            {s.playing && <span className="eq-dot" aria-hidden="true" />}
            {gone ? "No longer in the xpn.org archive" : rowMeta(episode, s)}
            {!gone && <ProgressLine {...s} />}
          </small>
        </span>
      </button>
      <SaveButton
        type="episodes"
        item={savedEpisodeItem(episode)}
        name={`${showName(episode)}, ${episode.title}`}
      />
      {!gone && <EpisodePlayKey episode={episode} />}
    </div>
  );
}

function SkeletonEpisodes() {
  return (
    <div role="status">
      <span className="sr-only">Loading the archive…</span>
      {[0, 1, 2, 3].map((i) => (
        <div className="archive-row skeleton-row" aria-hidden="true" key={i}>
          <span className="skeleton-block archive-skeleton-art" />
          <span className="skeleton-lines">
            <span className="skeleton-block skeleton-line" />
            <span className="skeleton-block skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

// Shows › Archive: the shows xpn.org archives, newest broadcast first, each
// with its latest few episodes and a way into the rest. Searching shows every
// match.
const PER_SHOW = 3;
export function ArchiveList({ query, onOpen, onOpenShow, onClearQuery }) {
  const archive = useArchive();
  const q = query.trim().toLowerCase();
  const list = archive.episodes.filter(
    (e) =>
      !q || `${e.title} ${e.feature} ${showName(e)} ${shortDay(e.date)}`.toLowerCase().includes(q),
  );
  if (!archive.episodes.length) {
    if (archive.source === "loading") return <SkeletonEpisodes />;
    return (
      <Empty
        icon="headphones"
        title="The archive is unavailable"
        action="Try again"
        onAction={() => loadArchive({ force: true })}
      >
        Check your connection and try again.
      </Empty>
    );
  }
  const shows = new Map();
  for (const episode of list) {
    if (!shows.has(episode.show)) shows.set(episode.show, []);
    shows.get(episode.show).push(episode);
  }
  return (
    <div className="archive-list">
      {!list.length ? (
        <Empty
          icon="search"
          title="No matching episodes"
          action="Clear search"
          onAction={onClearQuery}
        >
          Try a show’s name, a date or a guest.
        </Empty>
      ) : (
        [...shows].map(([id, episodes]) => {
          const show = SHOWS[id] || { name: showName(episodes[0]), img: showArt(episodes[0]) };
          const shown = q ? episodes : episodes.slice(0, PER_SHOW);
          return (
            <section key={id} className="archive-show" aria-labelledby={`archive-${id}`}>
              <button className="archive-show-head" onClick={() => onOpenShow(id)}>
                <Art src={show.img} alt="" loading="lazy" />
                <span>
                  <strong id={`archive-${id}`}>{show.name}</strong>
                  <small>{[show.times?.[0], show.host].filter(Boolean).join(" · ")}</small>
                </span>
                <Icon name="chev" size={18} />
              </button>
              {shown.map((episode) => (
                <EpisodeRow key={episode.id} episode={episode} onOpen={onOpen} showShow={false} />
              ))}
              {episodes.length > shown.length && (
                <button className="text-button archive-more" onClick={() => onOpenShow(id)}>
                  All {episodes.length} episodes
                </button>
              )}
            </section>
          );
        })
      )}
      <p className="data-note">
        Recent broadcasts from the xpn.org archive. They play here, and keep your place.
      </p>
    </div>
  );
}

// The scrubber for the loaded episode: elapsed, a slider, time left, and
// skip keys. While a finger or the mouse holds the slider, the times follow
// it and the episode seeks on release; any other change (keys, VoiceOver,
// TalkBack) seeks straight away.
export function EpisodeScrubber({ episode }) {
  const s = useEpisodeState(episode);
  const [dragging, setDragging] = useState(null);
  const held = useRef(false);
  const release = (e) => {
    if (!held.current) return;
    held.current = false;
    seekEpisode(+e.currentTarget.value);
    setDragging(null);
  };
  const shown = dragging ?? s.position;
  const max = Math.max(1, Math.round(s.duration || 1));
  return (
    <div className="episode-scrubber">
      <button
        className="icon-button skip-key"
        aria-label={`Back ${SKIP_BACK_S} seconds`}
        onClick={() => skipEpisode(-SKIP_BACK_S)}
        disabled={!s.active}
      >
        <Icon name="back15" size={22} />
      </button>
      <time className="scrub-time">{clockTime(shown)}</time>
      <input
        type="range"
        className="slim-range"
        aria-label="Position"
        aria-valuetext={`${clockTime(shown)} of ${clockTime(s.duration)}`}
        min="0"
        max={max}
        step="1"
        value={Math.min(max, Math.round(shown))}
        style={{ "--fill": `${(Math.min(max, shown) / max) * 100}%` }}
        disabled={!s.active}
        onPointerDown={(e) => {
          held.current = true;
          // Released outside the slider still counts as released here.
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onChange={(e) => {
          if (held.current) setDragging(+e.target.value);
          else seekEpisode(+e.target.value);
        }}
        onPointerUp={release}
        onPointerCancel={() => {
          // The page took the gesture (a scroll): no seek.
          held.current = false;
          setDragging(null);
        }}
      />
      <time className="scrub-time">−{clockTime(Math.max(0, s.duration - shown))}</time>
      <button
        className="icon-button skip-key"
        aria-label={`Ahead ${SKIP_AHEAD_S} seconds`}
        onClick={() => skipEpisode(SKIP_AHEAD_S)}
        disabled={!s.active}
      >
        <Icon name="ahead30" size={22} />
      </button>
    </div>
  );
}

// One episode, in its show's sheet: what it is, Play (or Resume), the
// scrubber while it is loaded, and the description. A saved episode that
// has left the archive says so in place of Play.
export function EpisodeDetail({ episode, show, onBack, gone = false }) {
  const s = useEpisodeState(episode);
  const label =
    s.playing || s.busy
      ? "Pause"
      : s.ended
        ? "Play again"
        : s.started
          ? `Resume · ${lengthLabel(s.duration - s.position)} left`
          : "Play episode";
  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        <Icon name="back" size={17} />
        All about {show.name}
      </button>
      <div className="episode-hero">
        <Art className="episode-cover" src={showArt(episode) || show.img} alt="" />
        <div>
          <span className="eyebrow episode-when">
            {[episode.aired || shortDay(episode.date), lengthLabel(s.duration)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <h3 className="episode-title">{episode.title}</h3>
          {episode.feature && <p className="episode-feature">{episode.feature}</p>}
        </div>
      </div>
      <div className="episode-actions">
        {gone ? (
          <p className="data-note">This broadcast is no longer in the xpn.org archive.</p>
        ) : (
          <button
            className="primary-button"
            data-busy={s.busy || undefined}
            onClick={() => (s.playing || s.busy ? toggleEpisode(episode) : playEpisode(episode))}
          >
            <Icon name={s.playing || s.busy ? "pause" : "play"} size={18} />
            {label}
          </button>
        )}
        <SaveButton type="episodes" item={savedEpisodeItem(episode)} className="secondary-button">
          {(saved) => (saved ? "Saved" : "Save")}
        </SaveButton>
      </div>
      {s.active && <EpisodeScrubber episode={episode} />}
      {episode.summary && <p className="show-description">{episode.summary}</p>}
      {episode.page && (
        <a className="text-button" href={episode.page} target="_blank" rel="noreferrer">
          Episode page
        </a>
      )}
    </>
  );
}
