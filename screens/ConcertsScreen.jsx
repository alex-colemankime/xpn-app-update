import { useState } from "react";
import { Icon, Empty, PromptLink, SearchField } from "../ui.jsx";
import { useFavoriteItems } from "../favorites.js";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { easternToday, filterConcerts } from "../concerts.js";
import { CALENDAR_URL, SUBMIT_CONCERT_URL } from "../links.js";
import { mediumDay } from "../time.js";
import { NewsletterPrompt } from "../components/Newsletter.jsx";

const PAGE = 40;

// The same quick ranges as the calendar on xpn.org.
const WHEN = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Tonight" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "Next 7 days" },
];

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

// Toggle chips. `value` is the selected id (or ids, for `multi`).
function ChipGroup({ options, value, onChange, multi = false }) {
  const on = (id) => (multi ? value.includes(id) : value === id);
  return options.map((o) => (
    <button
      key={o.id}
      className="chip"
      aria-pressed={on(o.id)}
      onClick={() =>
        onChange(multi ? (on(o.id) ? value.filter((v) => v !== o.id) : [...value, o.id]) : o.id)
      }
    >
      {o.label}
    </button>
  ));
}

export function ConcertsScreen({ result }) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("all");
  const [regions, setRegions] = useState([]);
  const [tags, setTags] = useState([]);
  const [shown, setShown] = useState(PAGE);
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
  const filtered = filterConcerts(concerts, { words, when, today, regions, tags, savedIds });
  const reset = () => {
    setQuery("");
    setWhen("all");
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
          <div className="chips" role="group" aria-label="When">
            <ChipGroup options={WHEN} value={when} onChange={change(setWhen)} />
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
                <div role="group" aria-label="Region">
                  <p className="filter-label">Where</p>
                  <div className="chips">
                    <ChipGroup
                      options={regionOptions}
                      value={regions}
                      onChange={change(setRegions)}
                      multi
                    />
                  </div>
                </div>
              )}
              <div role="group" aria-label="Concert type">
                <p className="filter-label">Show only</p>
                <div className="chips">
                  <ChipGroup options={tagOptions} value={tags} onChange={change(setTags)} multi />
                </div>
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
