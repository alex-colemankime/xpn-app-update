import { useEffect, useRef, useState } from "react";
import { Icon, Art, Modal, Segmented, Empty, SearchField } from "../ui.jsx";
import {
  SHOW_DIRECTORY,
  scheduleForDay,
  showUrl,
  shortName,
  showStream,
  onAirAt,
  nextAiringOf,
  untilLabel,
} from "../catalog.js";
import { DAYS, easternParts, clockLabel, deviceIsEastern } from "../time.js";
import { songId, useFavoriteItems } from "../favorites.js";
import { playStream, selectStream } from "../player.js";
import { PROGRAM_GUIDE_URL } from "../links.js";
import { SaveButton, ShowCard } from "../components/MusicRows.jsx";
import { useNow } from "../hooks/useNow.js";
import { enableReminders, useReminderSettings } from "../hooks/useShowReminders.js";
import { ARCHIVE_ENABLED, SHOW_SAMPLES } from "../config.js";
import { episodesOf, useArchive } from "../archive.js";
import { ArchiveList, EpisodeDetail, EpisodeRow } from "../components/Archive.jsx";

// All shows, the week's schedule, and (when there is one) the audio archive.
const MODES = ["All shows", "Schedule", ...(ARCHIVE_ENABLED || SHOW_SAMPLES ? ["Archive"] : [])];

const matchesQuery = (query) => {
  const q = query.trim().toLowerCase();
  return (show) => !q || `${show.name} ${show.host}`.toLowerCase().includes(q);
};

export function ShowsScreen({ onOpen }) {
  const [mode, setMode] = useState("All shows");
  const now = new Date(useNow());
  const today = easternParts(now).day;
  const onAirNow = onAirAt(now);
  const isOnAir = (slot) =>
    day === today && onAirNow?.show.id === slot.show.id && onAirNow.slot.start === slot.start;
  const [day, setDay] = useState(today);
  const [query, setQuery] = useState("");
  const matches = matchesQuery(query);
  const shows = SHOW_DIRECTORY.filter(matches);
  const slots = scheduleForDay(day).filter((slot) => matches(slot.show));

  // Opening the schedule on today brings the show on air into view.
  const list = useRef(null);
  useEffect(() => {
    if (mode !== "Schedule" || day !== today) return;
    list.current
      ?.querySelector(".on-air-row")
      ?.scrollIntoView({ block: "center", behavior: "instant" });
    // Only when the schedule is opened, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Shows</h1>
        </div>
      </div>
      <div className="toolbar">
        <Segmented label="Browse shows" value={mode} onChange={setMode} options={MODES} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={mode === "Archive" ? "Search episodes" : "Find a show or host"}
        />
      </div>
      {mode !== "Archive" && (
        <p className="sr-only" role="status">
          {mode === "All shows" ? shows.length : slots.length} matching shows
        </p>
      )}
      {mode === "Archive" ? (
        <ArchiveList
          query={query}
          onOpen={(episode) => onOpen(episode.show, episode.id)}
          onClearQuery={() => setQuery("")}
        />
      ) : mode === "All shows" ? (
        shows.length ? (
          <div className="show-grid all-shows">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <Empty
            icon="search"
            title="No shows found"
            action="Clear search"
            onAction={() => setQuery("")}
          >
            Try a different show or host name.
          </Empty>
        )
      ) : (
        <>
          <div className="day-picker" role="group" aria-label="Schedule day">
            {DAYS.map((d) => (
              <button
                className={d === day ? "active" : ""}
                aria-pressed={d === day}
                aria-label={d === today ? `${d}, today` : d}
                key={d}
                onClick={() => setDay(d)}
              >
                {d.slice(0, 3)}
                {d === today && <i />}
              </button>
            ))}
          </div>
          <div className="section-heading schedule-heading">
            <h2>{day}</h2>
            <span className="subtle">All times Eastern</span>
          </div>
          {slots.length ? (
            <div ref={list}>
              {slots.map((slot) => (
                <button
                  className={`schedule-row ${isOnAir(slot) ? "on-air-row" : ""}`}
                  key={`${slot.show.id}-${slot.start}`}
                  onClick={() => onOpen(slot.show.id)}
                >
                  <time>
                    {clockLabel(slot.start)}
                    <small>{clockLabel(slot.end)}</small>
                  </time>
                  <Art src={slot.show.img} alt="" loading="lazy" />
                  <span className="schedule-info">
                    {isOnAir(slot) && <span className="on-air-chip">On air now</span>}
                    <strong>{slot.show.name}</strong>
                    {slot.show.host && <span>{slot.show.host}</span>}
                    <p>{slot.show.desc}</p>
                  </span>
                  <Icon name="chev" size={20} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon="search"
              title="No matching shows"
              action="Clear search"
              onAction={() => setQuery("")}
            >
              Try a different day or clear your search.
            </Empty>
          )}
          <p className="data-note">
            Regular schedule; special broadcasts may vary.{" "}
            <a href={PROGRAM_GUIDE_URL} target="_blank" rel="noreferrer">
              Check the station’s program guide ↗
            </a>
          </p>
        </>
      )}
    </>
  );
}

// Episodes carry no ids in the data, so one is derived from show + title.
const episodeKey = (show, ep) => songId({ title: ep.title, artist: show.name });
const savedEpisode = (show, ep) => ({
  ...ep,
  id: episodeKey(show, ep),
  showId: show.id,
  showName: show.name,
  host: show.host,
  img: ep.img || show.img,
});

function EpisodeView({ show, episode, onBack }) {
  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        <Icon name="back" size={17} />
        Back to {show.name}
      </button>
      <Art className="episode-art" src={episode.img || show.img} alt="" />
      <span className="eyebrow">{show.name}</span>
      <h3 className="episode-title">{episode.title}</h3>
      <p className="subtle">
        {episode.date} · {episode.dur}
      </p>
      <SaveButton type="episodes" item={savedEpisode(show, episode)} className="secondary-button">
        {(saved) => (saved ? "Episode saved" : "Save episode")}
      </SaveButton>
      <div className="info-note">
        <Icon name="headphones" />
        <div>
          <strong>Episode preview</strong>
          <p>This sample episode has no audio attached. Explore available recordings on WXPN.</p>
          <a
            className="text-button"
            href={showUrl(show) || PROGRAM_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Visit {show.name}
            <Icon name="arrowUp" size={16} />
          </a>
        </div>
      </div>
    </>
  );
}

// Right after a follow, while the reason is obvious, the sheet offers
// reminders (only if they are off and the show has a schedule). Inline rather
// than a toast, because the sheet is modal: a toast's button would sit
// behind it.
function ReminderOffer({ show, onDone }) {
  const { enabled } = useReminderSettings();
  if (enabled || !show.schedule?.length) return null;
  return (
    <div className="reminder-offer" role="status">
      <Icon name="bell" size={18} />
      <span>Get a reminder before {shortName(show)} starts?</span>
      <button
        className="secondary-button"
        onClick={async () => {
          if (await enableReminders()) onDone();
        }}
      >
        Remind me
      </button>
    </div>
  );
}

// "On air now, until 4pm" or "Next on air: Tomorrow at 2pm", in the
// listener's own time.
function Airing({ show }) {
  const now = new Date(useNow());
  const onAirNow = onAirAt(now);
  if (onAirNow?.show.id === show.id) {
    return <p className="airing on">On air now, {untilLabel(onAirNow)}</p>;
  }
  const next = nextAiringOf(show, now);
  return next ? <p className="airing">Next on air: {next.label}</p> : null;
}

export function ShowDetail({ show, episodeId, onOpenEpisode, onCloseEpisode, onClose, onListen }) {
  // The show's archive episodes when it has a podcast feed (playable), else
  // the preview's sample episodes. A saved episode can still be opened after
  // it has left the feed.
  const archive = useArchive();
  const saved = useFavoriteItems("episodes");
  const archived = episodesOf(archive, show.id);
  const playable = archived.length > 0;
  const episodes = playable ? archived : show.episodes || [];
  const onNow = onAirAt()?.show.id === show.id;
  const [offer, setOffer] = useState(false);
  const page = showUrl(show);
  const archivedEpisode =
    episodeId &&
    (archived.find((ep) => ep.id === episodeId) ||
      saved.find((ep) => ep.id === episodeId && ep.audio));
  const episode =
    archivedEpisode ||
    (episodeId && (show.episodes || []).find((ep) => episodeKey(show, ep) === episodeId));
  const stream = showStream(show);
  const listen = () => {
    selectStream(stream);
    playStream();
    onListen();
  };
  return (
    <Modal title={show.name} onClose={onClose}>
      <div className="detail-body">
        {archivedEpisode ? (
          <EpisodeDetail show={show} episode={archivedEpisode} onBack={onCloseEpisode} />
        ) : episode ? (
          <EpisodeView show={show} episode={episode} onBack={onCloseEpisode} />
        ) : (
          <>
            <div className="show-detail-hero">
              <Art src={show.img} alt="" />
              <div>
                {show.host && (
                  <>
                    <span className="eyebrow">HOSTED BY</span>
                    <h3>{show.host}</h3>
                  </>
                )}
                <ul className="show-times">
                  {(show.times || [show.time]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {show.schedule?.length > 0 && !deviceIsEastern() && (
                  <p className="subtle">Eastern time</p>
                )}
                <Airing show={show} />
                <SaveButton
                  type="shows"
                  item={show}
                  className="secondary-button"
                  onToggle={setOffer}
                >
                  {(saved) => (saved ? "Following" : "Follow show")}
                </SaveButton>
              </div>
            </div>
            {offer && <ReminderOffer show={show} onDone={() => setOffer(false)} />}
            <p className="show-description">{show.desc}</p>
            <div className="detail-actions">
              <button className="primary-button" onClick={listen}>
                <Icon name="play" size={17} />
                {onNow ? "Listen now" : "Listen to WXPN live"}
              </button>
              {page && (
                <a href={page} className="text-button" target="_blank" rel="noreferrer">
                  Show page on xpn.org
                  <Icon name="arrowUp" size={16} />
                </a>
              )}
            </div>
            {playable ? (
              <>
                <div className="section-heading">
                  <h3>Recent episodes</h3>
                </div>
                {archived.slice(0, 8).map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    episode={ep}
                    showShow={false}
                    onOpen={(e) => onOpenEpisode(e.id)}
                  />
                ))}
              </>
            ) : (
              episodes.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>Episodes</h3>
                    <span className="sample-label">Sample episodes</span>
                  </div>
                  {episodes.map((ep) => (
                    <div className="episode-row" key={ep.title}>
                      <button
                        className="episode-open"
                        onClick={() => onOpenEpisode(episodeKey(show, ep))}
                      >
                        <Art src={ep.img || show.img} alt="" />
                        <span>
                          <strong>{ep.title}</strong>
                          <small>
                            {ep.date} · {ep.dur}
                          </small>
                        </span>
                        <Icon name="chev" size={17} />
                      </button>
                      <SaveButton type="episodes" item={savedEpisode(show, ep)} name={ep.title} />
                    </div>
                  ))}
                </>
              )
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
