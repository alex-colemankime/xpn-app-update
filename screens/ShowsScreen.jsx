import { useState } from "react";
import { Icon, Art, Segmented, Empty, SearchField } from "../ui.jsx";
import { SHOW_DIRECTORY, scheduleForDay, onAirAt } from "../catalog.js";
import { DAYS, easternParts, clockLabel } from "../time.js";
import { PROGRAM_GUIDE_URL } from "../links.js";
import { ShowCard } from "../components/MusicRows.jsx";
import { useNow } from "../hooks/useNow.js";
import { ARCHIVE_ENABLED } from "../config.js";
import { ArchiveList } from "../components/Archive.jsx";

// All shows, the week's schedule, and (when there is one) the audio archive.
const MODES = ["All shows", "Schedule", ...(ARCHIVE_ENABLED ? ["Archive"] : [])];

const matchesQuery = (query) => {
  const q = query.trim().toLowerCase();
  return (show) => !q || `${show.name} ${show.host}`.toLowerCase().includes(q);
};

// Opening the schedule, or coming back to today, brings the show on air into
// view (a ref callback on a list keyed by day, so it runs when a day's list
// appears, not on every clock tick). Only today's list has an on-air row.
const scrollToOnAir = (list) =>
  list?.querySelector(".on-air-row")?.scrollIntoView({ block: "center", behavior: "instant" });

export function ShowsScreen({ onOpen }) {
  const [mode, setMode] = useState("All shows");
  const now = new Date(useNow());
  const today = easternParts(now).day;
  const onAirNow = onAirAt(now);
  const [day, setDay] = useState(today);
  const [query, setQuery] = useState("");
  const isOnAir = (slot) =>
    day === today && onAirNow?.show.id === slot.show.id && onAirNow.slot.start === slot.start;
  const matches = matchesQuery(query);
  const shows = SHOW_DIRECTORY.filter(matches);
  const slots = scheduleForDay(day).filter((slot) => matches(slot.show));
  return (
    <>
      {/* The tab bar (or sidebar) already says where this is. */}
      <h1 className="sr-only">Shows</h1>
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
          onOpenShow={(id) => onOpen(id)}
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
            <div key={day} ref={scrollToOnAir}>
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
                    <small className="schedule-desc">{slot.show.desc}</small>
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
              Check the station’s program guide
            </a>
          </p>
        </>
      )}
    </>
  );
}
