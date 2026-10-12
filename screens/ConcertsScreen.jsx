import { useState } from "react";
import { Icon, Empty, PromptLink, SearchField, SkeletonList } from "../ui.jsx";
import { useFavoriteItems } from "../favorites.js";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { RangeCalendar } from "../components/RangeCalendar.jsx";
import { calendarEnd, easternToday, filterConcerts, rangeLabel } from "../concerts.js";
import { CALENDAR_URL, SUBMIT_CONCERT_URL } from "../links.js";
import { mediumDay } from "../time.js";
import { NewsletterPrompt } from "../components/Newsletter.jsx";
import { PullToRefresh } from "../components/PullToRefresh.jsx";

// Three days of listings at first, three more with each "Show more".
const DAYS_STEP = 3;

// The same quick ranges as the calendar on xpn.org. None chosen: every date.
const WHEN = [
  { id: "today", label: "Tonight" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "Next 7 days" },
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

// When: the quick ranges, one at a time (the chosen one again lets it go).
function WhenGroup({ value, onChange }) {
  return (
    <div className="filter-checks" role="group" aria-label="When">
      {WHEN.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            className="filter-check"
            aria-pressed={on}
            onClick={() => onChange(on ? "all" : o.id)}
          >
            <span className="filter-box round" aria-hidden="true">
              {on && <Icon name="check" size={14} />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const [days, setDays] = useState(DAYS_STEP);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const saved = useFavoriteItems("concerts");
  const savedIds = new Set(saved.map((c) => c.id));
  const { concerts, source, partial, through } = result;
  const today = easternToday();

  // Regions with the most concerts first.
  const counts = new Map();
  for (const c of concerts) for (const r of c.regions) counts.set(r, (counts.get(r) || 0) + 1);
  const regionOptions = [...counts].sort((a, b) => b[1] - a[1]).map(([r]) => ({ id: r, label: r }));
  const tagOptions = [
    { id: "welcomes", label: "WXPN Welcomes" },
    { id: "fan", label: "Free at Noon" },
    ...(saved.length ? [{ id: "saved", label: "Saved" }] : []),
  ];

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = filterConcerts(concerts, {
    words,
    when,
    range,
    today,
    regions,
    tags,
    savedIds,
  });
  const reset = () => {
    setQuery("");
    setWhen("all");
    setRange(NO_RANGE);
    setRegions([]);
    setTags([]);
    setDays(DAYS_STEP);
  };
  const narrowed = Boolean(words.length || when !== "all" || regions.length || tags.length);
  const active = (when !== "all" ? 1 : 0) + regions.length + tags.length;
  // A new filter starts the list from the top.
  const change = (setter) => (value) => {
    setter(value);
    setDays(DAYS_STEP);
  };
  // The first few days with listings, then a few more at a time.
  const dates = [...new Set(filtered.map((c) => c.date))];
  const lastShown = dates[Math.min(days, dates.length) - 1] || "";
  const visible = filtered.filter((c) => c.date <= lastShown);

  let body;
  if (source === "loading") {
    // Rows in the shape of the listings, so the list appears in place.
    body = (
      <SkeletonList
        label="Loading concerts…"
        count={6}
        rowClass="track-row concert-skeleton"
        artClass="skeleton-date"
      />
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
        {visible.map((c) => (
          <ConcertRow key={c.id} concert={c} />
        ))}
        {dates.length > days && (
          <button className="text-button show-more" onClick={() => setDays(days + DAYS_STEP)}>
            Show more concerts
            <span className="expand-chevron">
              <Icon name="chevD" size={17} />
            </span>
          </button>
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
          <button
            className="filter-button"
            aria-expanded={filtersOpen}
            aria-controls="concert-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Icon name="filter" size={18} />
            Filter
            {active > 0 && <span className="filter-count">{active}</span>}
            {/* The dates in use, so they're known with the panel closed. */}
            {when !== "all" && (
              <span className="filter-when">
                {when === "range" ? rangeLabel(range) : WHEN.find((o) => o.id === when)?.label}
              </span>
            )}
            <Icon name="chevD" size={16} />
          </button>
          {filtersOpen && (
            <div className="filter-options" id="concert-filters">
              <div>
                <p className="filter-label">When</p>
                <WhenGroup
                  value={when === "range" ? "" : when}
                  onChange={(next) => {
                    change(setWhen)(next);
                    setRange(NO_RANGE);
                  }}
                />
              </div>
              <div>
                <p className="filter-label">
                  Dates
                  {when === "range" && <span> · {rangeLabel(range)}</span>}
                </p>
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
              <div>
                <p className="filter-label">Show only</p>
                <CheckGroup
                  label="Concert type"
                  options={tagOptions}
                  value={tags}
                  onChange={change(setTags)}
                />
              </div>
              <div className="filter-actions">
                {active > 0 && (
                  <button className="text-button" onClick={reset}>
                    Clear filters
                  </button>
                )}
                <button className="text-button filter-done" onClick={() => setFiltersOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          )}
          <p className="concert-count">
            <span role="status">
              {filtered.length} {filtered.length === 1 ? "concert" : "concerts"}
            </span>
            {narrowed && (
              <button className="text-button" onClick={reset}>
                Clear filters
              </button>
            )}
          </p>
        </div>
      )}
      {body}
    </>
  );
}
