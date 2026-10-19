import { useState } from "react";
import { Icon, Empty, Modal, PromptLink, SearchField, SkeletonList } from "../ui.jsx";
import { useFavoriteItems } from "../favorites.js";
import { ConcertList } from "../components/ConcertRow.jsx";
import { RangeCalendar } from "../components/RangeCalendar.jsx";
import { calendarEnd, easternToday, filterConcerts, inShowOrder, rangeLabel } from "../concerts.js";
import { CALENDAR_URL, SUBMIT_CONCERT_URL } from "../links.js";
import { mediumDay } from "../time.js";
import { NewsletterPrompt } from "../components/Newsletter.jsx";
import { PullToRefresh } from "../components/PullToRefresh.jsx";

// Twenty concerts at first, twenty more with each "Load more".
const PAGE = 20;

// The quick filters, as chips under the search: two date ranges (one at a
// time, as are Next 7 days and dates picked in Filters) and the station's
// own shows. None chosen: every date, every concert.
const NEXT_WEEK = "Next 7 days";
const TAG_CHIPS = [
  { id: "welcomes", label: "WXPN Welcomes" },
  { id: "fan", label: "Free at Noon" },
];
const NO_RANGE = { from: "", to: "" };

// With no listings to show, the way to the full calendar on xpn.org.
const CalendarEmpty = ({ title, children }) => (
  <div className="empty-state">
    <Icon name="navConcerts" size={32} />
    <h2>{title}</h2>
    <p>{children}</p>
    <a className="secondary-button" href={CALENDAR_URL} target="_blank" rel="noreferrer">
      See the concert calendar on xpn.org
    </a>
  </div>
);

// One quick filter: on or off, in ink when on.
const Chip = ({ on, onClick, children }) => (
  <button className="chip" aria-pressed={on} onClick={onClick}>
    {children}
  </button>
);

// Where and what: a list of choices, any number at once, each with a box
// that takes a check.
function CheckGroup({ label, options, value, onChange }) {
  return (
    <div className="filter-checks" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            className="filter-check"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
          >
            <span className="filter-box" aria-hidden="true">
              {on && <Icon name="check" size={14} />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConcertsScreen({ result }) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("all");
  const [range, setRange] = useState(NO_RANGE);
  const [regions, setRegions] = useState([]);
  const [tags, setTags] = useState([]);
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const saved = useFavoriteItems("concerts");
  const savedIds = new Set(saved.map((c) => c.id));
  const { concerts, source, partial, through } = result;
  const today = easternToday();

  // Regions with the most concerts first.
  const counts = new Map();
  for (const c of concerts) for (const r of c.regions) counts.set(r, (counts.get(r) || 0) + 1);
  const regionOptions = [...counts].sort((a, b) => b[1] - a[1]).map(([r]) => ({ id: r, label: r }));

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = inShowOrder(
    filterConcerts(concerts, {
      words,
      when,
      range,
      today,
      regions,
      tags,
      savedIds,
    }),
  );
  const reset = () => {
    setQuery("");
    setWhen("all");
    setRange(NO_RANGE);
    setRegions([]);
    setTags([]);
    setShown(PAGE);
  };
  const narrowed = Boolean(words.length || when !== "all" || regions.length || tags.length);
  // What Filters holds that is in use: Next 7 days or picked dates, the
  // regions, and Saved.
  const inSheet =
    (when === "week" || when === "range" ? 1 : 0) +
    regions.length +
    (tags.includes("saved") ? 1 : 0);
  // A new filter starts the list from the top.
  const change = (setter) => (value) => {
    setter(value);
    setShown(PAGE);
  };
  // A date filter replaces any other (the chosen one again lets it go).
  const chooseWhen = (id) => {
    change(setWhen)(when === id ? "all" : id);
    setRange(NO_RANGE);
  };
  const toggleTag = (id) =>
    change(setTags)(tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id]);
  const visible = filtered.slice(0, shown);

  let body;
  if (source === "loading") {
    // Rows in the shape of the listings, so the list appears in place.
    body = (
      <SkeletonList label="Loading concerts…" count={6} rowClass="track-row concert-skeleton" />
    );
  } else if (source === "unconfigured") {
    body = (
      <CalendarEmpty title="Find your next show">
        WXPN’s full concert calendar, including WXPN Welcomes shows, is on xpn.org.
      </CalendarEmpty>
    );
  } else if (source === "error") {
    body = (
      <Empty
        icon="navConcerts"
        title="The concert calendar is unavailable"
        action="Try again"
        onAction={result.retry}
      >
        Check your connection and try again, or see the calendar on{" "}
        <a href={CALENDAR_URL} target="_blank" rel="noreferrer">
          xpn.org
        </a>
        .
      </Empty>
    );
  } else if (!concerts.length) {
    body = (
      <CalendarEmpty title="No upcoming concerts listed">
        The calendar on xpn.org may list more.
      </CalendarEmpty>
    );
  } else if (!filtered.length) {
    body = (
      <Empty icon="navConcerts" title="No concerts match" action="Clear filters" onAction={reset}>
        Try another artist, venue or date.
      </Empty>
    );
  } else {
    body = (
      <>
        {partial && (
          <p className="info-note concert-partial">
            <span role="status">
              Some concerts couldn’t load, so this list may be missing a few.
            </span>
            <button className="text-button" onClick={result.retry}>
              Try again
            </button>
          </p>
        )}
        {through && (
          <p className="info-note concert-partial">
            <span>Showing concerts through {mediumDay(`${through}T12:00:00`)}.</span>
            <a className="text-button" href={CALENDAR_URL} target="_blank" rel="noreferrer">
              Full calendar
            </a>
          </p>
        )}
        <ConcertList concerts={visible} />
        {filtered.length > shown && (
          <div className="list-more">
            <button className="text-button" onClick={() => setShown(shown + PAGE)}>
              Load more concerts
              <span className="expand-chevron">
                <Icon name="chevD" size={17} />
              </span>
            </button>
          </div>
        )}
        {/* xpn.org's own submission form (no account needed). */}
        <PromptLink
          href={SUBMIT_CONCERT_URL}
          icon="calendarAdd"
          title="Playing a show?"
          note="Submit a concert or event to WXPN’s calendar"
        />
        <PromptLink
          href={CALENDAR_URL}
          icon="navConcerts"
          title="The full calendar"
          note="Every listing on xpn.org"
        />
        <NewsletterPrompt />
      </>
    );
  }

  return (
    <>
      {/* The tab bar (or sidebar) already says where this is. */}
      <h1 className="sr-only">Concerts</h1>
      <PullToRefresh onRefresh={result.refresh} />
      {concerts.length > 0 && (
        <div className="concert-filters">
          <SearchField value={query} onChange={change(setQuery)} placeholder="Artist or venue" />
          <div className="concert-chips" role="group" aria-label="Filter concerts">
            <Chip on={when === "today"} onClick={() => chooseWhen("today")}>
              Tonight
            </Chip>
            <Chip on={when === "weekend"} onClick={() => chooseWhen("weekend")}>
              This weekend
            </Chip>
            {TAG_CHIPS.map((t) => (
              <Chip key={t.id} on={tags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                {t.label}
              </Chip>
            ))}
            <button
              className="chip"
              aria-haspopup="dialog"
              // It opens a sheet rather than switching on, so it says how
              // many of its filters are in use instead of "pressed".
              data-on={inSheet > 0 || undefined}
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="filter" size={16} />
              Filters
              {inSheet > 0 && (
                <span className="filter-count">
                  {inSheet}
                  <span className="sr-only"> in use</span>
                </span>
              )}
            </button>
            <span className="concert-chips-fade" aria-hidden="true" />
          </div>
          <p className="concert-count">
            <span role="status">
              {filtered.length} {filtered.length === 1 ? "concert" : "concerts"}
              {/* The dates in use, so they're known with Filters closed. */}
              {(when === "week" || when === "range") && (
                <> · {when === "range" ? rangeLabel(range) : NEXT_WEEK}</>
              )}
            </span>
            {narrowed && (
              <button className="text-button" onClick={reset}>
                Clear filters
              </button>
            )}
          </p>
        </div>
      )}
      {filtersOpen && (
        <Modal title="Filters" onClose={() => setFiltersOpen(false)} className="filter-sheet">
          <div className="detail-body filter-options">
            <div>
              <p className="filter-label">
                Dates
                {when === "range" && <span> · {rangeLabel(range)}</span>}
              </p>
              <CheckGroup
                label="When"
                options={[{ id: "week", label: NEXT_WEEK }]}
                value={when === "week" ? ["week"] : []}
                onChange={() => chooseWhen("week")}
              />
              <RangeCalendar
                from={range.from}
                to={range.to}
                min={today}
                max={calendarEnd(today)}
                onChange={(next) => {
                  change(setRange)(next);
                  setWhen(next.from ? "range" : "all");
                }}
              />
            </div>
            {regionOptions.length > 0 && (
              <div>
                <p className="filter-label">Where</p>
                <CheckGroup
                  label="Region"
                  options={regionOptions}
                  value={regions}
                  onChange={change(setRegions)}
                />
              </div>
            )}
            {saved.length > 0 && (
              <div>
                <p className="filter-label">Show only</p>
                <CheckGroup
                  label="Saved"
                  options={[{ id: "saved", label: "Saved" }]}
                  value={tags.includes("saved") ? ["saved"] : []}
                  onChange={() => toggleTag("saved")}
                />
              </div>
            )}
            <div className="filter-actions">
              {narrowed && (
                <button className="text-button" onClick={reset}>
                  Clear filters
                </button>
              )}
              <button className="primary-button" onClick={() => setFiltersOpen(false)}>
                Show {filtered.length} {filtered.length === 1 ? "concert" : "concerts"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {body}
    </>
  );
}
