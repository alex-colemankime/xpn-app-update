import { useState } from "react";
import { Art, Empty, Icon } from "../ui.jsx";
import { SaveButton } from "./MusicRows.jsx";
import { SHOWS } from "../catalog.js";
import { ARCHIVE_HOME } from "../config.js";
import { clockTime, lengthLabel, loadArchive, useArchive } from "../archive.js";
import { SKIP_AHEAD_S, SKIP_BACK_S } from "../episode-core.js";
import {
  playEpisode,
  seekEpisode,
  skipEpisode,
  toggleEpisode,
  useEpisodePlayer,
  useEpisodeProgress,
} from "../episode-player.js";

// "Oct 2", or "Oct 2, 2025" when it isn't this year.
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
export const episodeDay = (iso) => {
  const d = new Date(iso);
  return d.getFullYear() === new Date().getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
};
const showName = (episode) => episode.showName || SHOWS[episode.show]?.name || "WXPN";

// What a saved episode needs to be shown and played from Favorites, even
// after it has left the feed.
export const savedEpisodeItem = (episode) => ({
  id: episode.id,
  show: episode.show,
  showId: episode.show,
  showName: showName(episode),
  title: episode.title,
  date: episode.date,
  duration: episode.duration,
  audio: episode.audio,
  image: episode.image,
  img: episode.image,
  summary: episode.summary,
  page: episode.page,
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

// "11 min", "6 min left" or "Played".
function timeLeft({ ended, started, position, duration }) {
  if (ended) return "Played";
  if (started && duration) return `${lengthLabel(duration - position)} left`;
  return lengthLabel(duration);
}

// The round play key on an episode row.
export function EpisodePlayKey({ episode }) {
  const s = useEpisodeState(episode);
  const label = `${s.playing || s.busy ? "Pause" : s.started && !s.ended ? "Resume" : "Play"} ${episode.title}`;
  return (
    <button
      className="episode-key"
      data-on={s.playing || s.busy || undefined}
      data-busy={s.busy || undefined}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        toggleEpisode(episode);
      }}
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

// An episode in a list: art, show and date, title, time left, its heart and
// play key. The row opens the episode.
export function EpisodeRow({ episode, onOpen, showShow = true }) {
  const s = useEpisodeState(episode);
  return (
    <div className="archive-row" data-active={s.active || undefined}>
      <button className="archive-open" onClick={() => onOpen(episode)}>
        <Art src={episode.image} alt="" loading="lazy" />
        <span className="archive-text">
          <small className="archive-eyebrow">
            {showShow && <span>{showName(episode)}</span>}
            <span>{episodeDay(episode.date)}</span>
          </small>
          <strong>{episode.title}</strong>
          <small className="archive-meta">
            {s.playing && <span className="eq-dot" aria-hidden="true" />}
            {timeLeft(s)}
            <ProgressLine {...s} />
          </small>
        </span>
      </button>
      <SaveButton type="episodes" item={savedEpisodeItem(episode)} name={episode.title} />
      <EpisodePlayKey episode={episode} />
    </div>
  );
}

// Groups for the archive list: Today, Yesterday, This week, then by month.
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
function groupOf(iso, today) {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today - day) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return MONTH.format(d);
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

// Shows › Archive: every recent episode from the archive feeds, newest first,
// in date groups, with a chip per show when there is more than one.
export function ArchiveList({ query, onOpen, onClearQuery }) {
  const archive = useArchive();
  const [show, setShow] = useState("all");
  const shows = [...new Set(archive.episodes.map((e) => e.show))];
  const q = query.trim().toLowerCase();
  const list = archive.episodes.filter(
    (e) =>
      (show === "all" || e.show === show) &&
      (!q || `${e.title} ${showName(e)} ${e.summary}`.toLowerCase().includes(q)),
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
        Check your connection, or listen to the{" "}
        <a href={ARCHIVE_HOME} target="_blank" rel="noreferrer">
          World Cafe podcast
        </a>{" "}
        on NPR.
      </Empty>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = [];
  for (const episode of list) {
    const name = groupOf(episode.date, today);
    if (groups.at(-1)?.name !== name) groups.push({ name, episodes: [] });
    groups.at(-1).episodes.push(episode);
  }
  return (
    <div className="archive-list">
      {shows.length > 1 && (
        <div className="chips archive-shows" role="group" aria-label="Show">
          {["all", ...shows].map((id) => (
            <button
              key={id}
              className="chip"
              aria-pressed={show === id}
              onClick={() => setShow(id)}
            >
              {id === "all" ? "All" : SHOWS[id]?.name || id}
            </button>
          ))}
        </div>
      )}
      {!list.length ? (
        <Empty
          icon="search"
          title="No matching episodes"
          action="Clear search"
          onAction={onClearQuery}
        >
          Try another artist or title.
        </Empty>
      ) : (
        groups.map((group) => (
          <section key={group.name} className="archive-group" aria-label={group.name}>
            <h2 className="archive-group-title">{group.name}</h2>
            {group.episodes.map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                onOpen={onOpen}
                showShow={shows.length > 1}
              />
            ))}
          </section>
        ))
      )}
      <p className="data-note">
        {shows.length === 1 ? `${showName(list[0] || archive.episodes[0])} episodes` : "Episodes"},
        from the shows’ podcasts. They play here, and keep your place.
      </p>
    </div>
  );
}

// The scrubber for the loaded episode: elapsed, a slider, time left, and
// skip keys.
export function EpisodeScrubber({ episode, compact = false }) {
  const s = useEpisodeState(episode);
  const [dragging, setDragging] = useState(null);
  const shown = dragging ?? s.position;
  const max = Math.max(1, Math.round(s.duration || 1));
  return (
    <div className={`episode-scrubber ${compact ? "compact" : ""}`}>
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
        onChange={(e) => setDragging(+e.target.value)}
        onPointerUp={(e) => {
          seekEpisode(+e.currentTarget.value);
          setDragging(null);
        }}
        onKeyUp={(e) => {
          seekEpisode(+e.currentTarget.value);
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
// scrubber while it is loaded, and the description.
export function EpisodeDetail({ episode, show, onBack }) {
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
        <Art className="episode-cover" src={episode.image || show.img} alt="" />
        <div>
          <span className="eyebrow episode-when">
            {episodeDay(episode.date)}
            {episode.duration ? ` · ${lengthLabel(episode.duration)}` : ""}
          </span>
          <h3 className="episode-title">{episode.title}</h3>
        </div>
      </div>
      <div className="episode-actions">
        <button
          className="primary-button"
          data-busy={s.busy || undefined}
          onClick={() => (s.playing || s.busy ? toggleEpisode(episode) : playEpisode(episode))}
        >
          <Icon name={s.playing || s.busy ? "pause" : "play"} size={18} />
          {label}
        </button>
        <SaveButton type="episodes" item={savedEpisodeItem(episode)} className="secondary-button">
          {(saved) => (saved ? "Saved" : "Save")}
        </SaveButton>
      </div>
      {s.active && <EpisodeScrubber episode={episode} />}
      {episode.summary && <p className="show-description">{episode.summary}</p>}
      {episode.page && (
        <a className="text-button" href={episode.page} target="_blank" rel="noreferrer">
          Episode page
          <Icon name="arrowUp" size={16} />
        </a>
      )}
    </>
  );
}
