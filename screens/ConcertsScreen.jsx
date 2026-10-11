import { useCallback, useRef, useState } from "react";
import { Icon, Empty, PromptLink, SearchField } from "../ui.jsx";
import { useFavoriteItems } from "../favorites.js";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { easternToday, filterConcerts, rangeLabel } from "../concerts.js";
import { CALENDAR_URL, SUBMIT_CONCERT_URL } from "../links.js";
import { mediumDay } from "../time.js";
import { NewsletterPrompt } from "../components/Newsletter.jsx";

const PAGE = 40;

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

// Whether a row runs past its edge (a narrow phone), so it can fade there
// to say there is more to swipe to.
function useOverflow() {
  const [over, setOver] = useState(false);
  const ref = useCallback((el) => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, over];
}

// The last chip: dates of the listener's own choosing, in a small sheet of
// two date fields. Each change applies at once; Clear goes back to every date.
function DateRangeChip({ active, range, today, onChange }) {
  const sheet = useRef(null);
  const label = active ? rangeLabel(range) : "";
  const set = (next) => {
    // A start after the end moves the end with it.
    const fixed = next.from && next.to && next.to < next.from ? { ...next, to: next.from } : next;
    onChange(fixed.from || fixed.to ? fixed : NO_RANGE);
  };
  return (
    <>
      <button
        className="chip chip-dates"
        aria-pressed={active}
        aria-label={active ? `Dates: ${label}` : "Choose dates"}
        popoverTarget="concert-dates"
        style={{ anchorName: "--concert-dates" }}
      >
        <Icon name="navConcerts" size={18} />
        {active && <span>{label}</span>}
      </button>
      <div
        id="concert-dates"
        ref={sheet}
        popover="auto"
        className="popover-menu date-range"
        role="dialog"
        aria-label="Choose dates"
        style={{ positionAnchor: "--concert-dates" }}
      >
        <div className="popover-menu-head">
          <span>
            <strong>Choose dates</strong>
            <small>Concerts from one day to another</small>
          </span>
        </div>
        <div className="date-range-fields">
          <label>
            <span>From</span>
            <input
              type="date"
              min={today}
              value={range.from}
              onChange={(e) => set({ ...range, from: e.target.value })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              min={range.from || today}
              value={range.to}
              onChange={(e) => set({ ...range, to: e.target.value })}
            />
          </label>
        </div>
        <div className="date-range-actions">
          <button className="secondary-button" disabled={!active} onClick={() => set(NO_RANGE)}>
            Clear
          </button>
          <button className="primary-button" onClick={() => sheet.current?.hidePopover()}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

// The refinements under "Region & more": a list of choices, any number at
// once, each with a box that takes a check. Text on the page rather than
// another row of chips, so the panel doesn't stack pills under the dates'.
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
  const [chipsRef, chipsOverflow] = useOverflow();
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
    setShown(PAGE);
  };
  const narrowed = Boolean(words.length || when !== "all" || regions.length || tags.length);
  // A new filter starts the list from the top.
  const change = (setter) => (value) => {
    setter(value);
    setShown(PAGE);
  };

  let body;
  if (source === "loading") {
    body = (
      <p role="status" className="loading-state">
        Loading concerts…
      </p>
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
        Check your connection and try again.
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
        {filtered.slice(0, shown).map((c) => (
          <ConcertRow key={c.id} concert={c} />
        ))}
        {filtered.length > shown && (
          <button className="text-button show-more" onClick={() => setShown(shown + PAGE)}>
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
      {concerts.length > 0 && (
        <div className="concert-filters">
          <SearchField value={query} onChange={change(setQuery)} placeholder="Artist or venue" />
          <div className="when-row" role="group" aria-label="When">
            <div className="chips" ref={chipsRef} data-overflow={chipsOverflow || undefined}>
              {WHEN.map((o) => (
                <button
                  key={o.id}
                  className="chip"
                  aria-pressed={when === o.id}
                  // The chosen range again: back to every date.
                  onClick={() => change(setWhen)(when === o.id ? "all" : o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <DateRangeChip
              active={when === "range"}
              range={range}
              today={today}
              onChange={(next) => {
                change(setRange)(next);
                setWhen(next.from || next.to ? "range" : "all");
              }}
            />
          </div>
          <details className="concert-refine">
            <summary>
              <span>
                Region & more
                {regions.length + tags.length > 0 && (
                  <span className="filter-count">{regions.length + tags.length} active</span>
                )}
              </span>
              <Icon name="chevD" size={17} />
            </summary>
            <div className="filter-options">
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
            </div>
          </details>
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
