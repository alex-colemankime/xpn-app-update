import { useState } from "react";
import { Icon, Art, Segmented, Empty, SearchField } from "../ui.jsx";
import { SHOW_DIRECTORY, scheduleForDay, onAirAt } from "../catalog.js";
import { DAYS, easternParts, clockLabel } from "../time.js";
import { ShowCard, showHold } from "../components/MusicRows.jsx";
import { useNow } from "../hooks/useNow.js";
import { ArchiveList } from "../components/Archive.jsx";
import { useFeatures } from "../features.js";
import { tap } from "../haptics.js";
import { PullToRefresh } from "../components/PullToRefresh.jsx";
import { loadArchive } from "../archive.js";

const matchesQuery = (query) => {
  const q = query.trim().toLowerCase();
  return (show) => !q || `${show.name} ${show.host}`.toLowerCase().includes(q);
};

export function ShowsScreen({ onOpen }) {
  // All shows, the week's schedule, and (when the build has it and the
  // station hasn't switched it off: features.js) the audio archive.
  const modes = ["All shows", "Schedule", ...(useFeatures().archive ? ["Archive"] : [])];
  // Shows opens on the schedule: what's on today, the show on air marked.
  const [chosen, setMode] = useState("Schedule");
  const mode = modes.includes(chosen) ? chosen : "Schedule";
  const now = new Date(useNow());
  const today = easternParts(now).day;
  const onAirNow = onAirAt(now);
  const [day, setDay] = useState(today);
  // The screen stays mounted for the life of the app, so when the date
  // turns over, the schedule moves to the new today with it.
  const [seenToday, setSeenToday] = useState(today);
  if (seenToday !== today) {
    setSeenToday(today);
    setDay(today);
  }
  const [query, setQuery] = useState("");
  // A view, and on the schedule a day, is chosen by its key and appears at
  // once. (No sideways swipes: one that decided only when the finger lifted
  // never followed it, and on the schedule it meant two things.)
  const choose = (next) => {
    tap("selection");
    setMode(next);
  };
  const chooseDay = (next) => {
    tap("selection");
    setDay(next);
  };
  // Today's slot, not one that began yesterday and runs past midnight (whose
  // start is before today's): the same show's slot later today isn't on yet.
  const isOnAir = (slot) =>
    day === today &&
    onAirNow?.show.id === slot.show.id &&
    onAirNow.slot.start === slot.start &&
    onAirNow.start >= 0;
  const matches = matchesQuery(query);
  const shows = SHOW_DIRECTORY.filter(matches);
  const slots = scheduleForDay(day).filter((slot) => matches(slot.show));
  return (
    <>
      {/* The tab bar (or sidebar) already says where this is. */}
      <h1 className="sr-only">Shows</h1>
      <div>
        <div className="toolbar">
          <Segmented
            label="Browse shows"
            value={mode}
            onChange={(next) => choose(next)}
            options={modes}
          />
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={mode === "Archive" ? "Search episodes" : "Find a show or host"}
          />
        </div>
        <div key={mode} className="tab-pane">
          {mode !== "Archive" && (
            <p className="sr-only" role="status">
              {mode === "All shows" ? shows.length : slots.length} matching shows
            </p>
          )}
          {mode === "Archive" && <PullToRefresh onRefresh={() => loadArchive({ force: true })} />}
          {mode === "Archive" ? (
            <ArchiveList
              query={query}
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
                    onClick={() => chooseDay(d)}
                  >
                    {d.slice(0, 3)}
                    {d === today && <i />}
                  </button>
                ))}
              </div>
              <div>
                <div key={day} className="tab-pane">
                  <div className="section-heading schedule-heading">
                    <h2>{day}</h2>
                    <span className="subtle">All times Eastern</span>
                  </div>
                  {slots.length ? (
                    <div>
                      {slots.map((slot) => (
                        <button
                          ref={showHold(slot.show, onOpen)}
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
                            {isOnAir(slot) && <span className="sr-only">On air now: </span>}
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
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
