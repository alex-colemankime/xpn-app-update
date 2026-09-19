import { useState } from "react";
import { Icon, Art, Modal, Segmented, Empty, SearchField } from "../ui.jsx";
import { SHOWS, DAYS, easternParts, scheduleForDay, clockLabel, showUrl } from "../catalog.js";
import { useFavorites, songId } from "../favorites.js";
import { ShowCard } from "../components/MusicRows.jsx";

export function ShowsScreen({ onOpen }) {
  const [mode, setMode] = useState("Featured");
  const [day, setDay] = useState(easternParts().day);
  const [query, setQuery] = useState("");
  const matches = (show) => `${show.name} ${show.host}`.toLowerCase().includes(query.toLowerCase());
  const ordered = [
    "worldcafe",
    "morning",
    "funky",
    "freeatnoon",
    "middays",
    "afternoons",
    ...Object.keys(SHOWS).filter(
      (id) =>
        !["worldcafe", "morning", "funky", "freeatnoon", "middays", "afternoons"].includes(id),
    ),
  ]
    .map((id) => SHOWS[id])
    .filter(matches);
  const slots = scheduleForDay(day).filter((slot) => matches(slot.show));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Shows</h1>
        </div>
      </div>
      <div className="toolbar">
        <Segmented
          label="Browse shows"
          value={mode}
          onChange={setMode}
          options={["Featured", "Schedule"]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Find a show or host" />
      </div>
      {mode === "Featured" ? (
        ordered.length ? (
          <div className="show-grid all-shows">
            {ordered.map((show) => (
              <ShowCard key={show.id} show={show} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <Empty icon="search" title="No shows found">
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
                key={d}
                onClick={() => setDay(d)}
              >
                {d.slice(0, 3)}
                {d === easternParts().day && <i />}
              </button>
            ))}
          </div>
          <div className="section-heading schedule-heading">
            <h2>{day}</h2>
            <span className="subtle">All times Eastern</span>
          </div>
          {slots.length ? (
            slots.map((slot, i) => (
              <button
                className="schedule-row"
                key={`${slot.show.id}-${i}`}
                onClick={() => onOpen(slot.show)}
              >
                <time>
                  {clockLabel(slot.start)}
                  <small>{clockLabel(slot.end)}</small>
                </time>
                <Art src={slot.show.img} loading="lazy" />
                <span className="schedule-info">
                  <strong>{slot.show.name}</strong>
                  <span>{slot.show.host}</span>
                  <p>{slot.show.desc}</p>
                </span>
                <Icon name="chev" size={20} />
              </button>
            ))
          ) : (
            <Empty icon="search" title="No matching shows">
              Try a different day or clear your search.
            </Empty>
          )}
          <p className="data-note">
            Regular schedule; special broadcasts may vary.{" "}
            <a href="https://xpn.org/program_guide/" target="_blank" rel="noreferrer">
              Check the station’s program guide ↗
            </a>
          </p>
        </>
      )}
    </>
  );
}


export function ShowDetail({ show, onClose, initialEpisode = null, onListen }) {
  const [episode, setEpisode] = useState(initialEpisode);
  const savedShows = useFavorites("shows");
  const savedEpisodes = useFavorites("episodes");
  const followed = savedShows.isSaved(show.id);
  const episodeItem = (ep) => ({
    ...ep,
    id: songId({ title: ep.title, artist: show.name }),
    showId: show.id,
    showName: show.name,
    host: show.host,
    img: ep.img || show.img,
  });
  return (
    <Modal title={episode ? episode.title : show.name} onClose={onClose}>
      <div className="detail-body">
        {episode ? (
          <>
            <button className="text-button back-button" onClick={() => setEpisode(null)}>
              <Icon name="back" size={17} />
              Back to {show.name}
            </button>
            <Art className="episode-art" src={episode.img || show.img} alt={episode.title} />
            <span className="eyebrow">{show.name}</span>
            <h3 className="episode-title">{episode.title}</h3>
            <p className="subtle">
              {episode.date} · {episode.dur}
            </p>
            <button
              className="secondary-button"
              aria-pressed={savedEpisodes.isSaved(episodeItem(episode).id)}
              onClick={() => savedEpisodes.toggle(episodeItem(episode))}
            >
              <Icon
                name={savedEpisodes.isSaved(episodeItem(episode).id) ? "heartF" : "heart"}
                size={18}
              />
              {savedEpisodes.isSaved(episodeItem(episode).id) ? "Episode saved" : "Save episode"}
            </button>
            <div className="info-note">
              <Icon name="headphones" />
              <div>
                <strong>Episode preview</strong>
                <p>
                  This sample episode has no audio attached. Explore available recordings on WXPN.
                </p>
                <a className="text-button" href={showUrl(show)} target="_blank" rel="noreferrer">
                  Visit {show.name}
                  <Icon name="arrowUp" size={16} />
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="show-detail-hero">
              <Art src={show.img} alt={show.name} />
              <div>
                <span className="eyebrow">HOSTED BY</span>
                <h3>{show.host}</h3>
                <p>{show.time}</p>
                <button
                  className={`secondary-button ${followed ? "saved" : ""}`}
                  aria-pressed={followed}
                  onClick={() => savedShows.toggle(show)}
                >
                  <Icon name={followed ? "heartF" : "heart"} size={18} />
                  {followed ? "Following" : "Follow show"}
                </button>
              </div>
            </div>
            <p className="show-description">{show.desc}</p>
            <div className="detail-actions">
              <button
                className="primary-button"
                onClick={() => onListen(show.id === "kidscorner" ? "kids" : "xpn")}
              >
                <Icon name="play" size={17} />
                Listen to {show.id === "kidscorner" ? "Kids Corner" : "WXPN"}
              </button>
              <a href={showUrl(show)} className="text-button" target="_blank" rel="noreferrer">
                On WXPN.org
                <Icon name="arrowUp" size={16} />
              </a>
            </div>
            <div className="section-heading">
              <h3>Episodes</h3>
              <span className="sample-label">Sample episodes</span>
            </div>
            {show.episodes?.length ? (
              show.episodes.map((ep) => (
                <div className="episode-row" key={ep.title}>
                  <button className="episode-open" onClick={() => setEpisode(ep)}>
                    <Art src={ep.img || show.img} />
                    <span>
                      <strong>{ep.title}</strong>
                      <small>
                        {ep.date} · {ep.dur}
                      </small>
                    </span>
                    <Icon name="chev" size={17} />
                  </button>
                  <button
                    className={`icon-button ${savedEpisodes.isSaved(episodeItem(ep).id) ? "saved" : ""}`}
                    aria-label={`${savedEpisodes.isSaved(episodeItem(ep).id) ? "Remove" : "Save"} ${ep.title}`}
                    aria-pressed={savedEpisodes.isSaved(episodeItem(ep).id)}
                    onClick={() => savedEpisodes.toggle(episodeItem(ep))}
                  >
                    <Icon name={savedEpisodes.isSaved(episodeItem(ep).id) ? "heartF" : "heart"} />
                  </button>
                </div>
              ))
            ) : (
              <Empty icon="headphones" title="Catch this one on the radio">
                Follow this show to save it in Favorites.
              </Empty>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

