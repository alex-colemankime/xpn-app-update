import { useMemo, useState } from "react";
import { Icon, Empty, SearchField } from "../ui.jsx";
import { useFavoriteItems } from "../favorites.js";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { easternToday } from "../concerts.js";
import { shiftDate } from "../time.js";
import { CALENDAR_URL } from "../links.js";
import { NewsletterPrompt } from "../components/Newsletter.jsx";

const PAGE = 40;

// The same quick ranges as the calendar on xpn.org.
const WHEN = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Tonight" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "Next 7 days" },
];
function inRange(date, when, today) {
  if (when === "today") return date === today;
  if (when === "week") return date >= today && date <= shiftDate(today, 6);
  if (when === "weekend") {
    // Friday to Sunday; on the weekend itself, the rest of it.
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const from = dow === 0 || dow === 6 || dow === 5 ? today : shiftDate(today, 5 - dow);
    const to = shiftDate(today, dow === 0 ? 0 : 7 - dow);
    return date >= from && date <= to;
  }
  return true;
}

function CalendarLink({ children = "See the concert calendar on xpn.org" }) {
  return (
    <a className="secondary-button" href={CALENDAR_URL} target="_blank" rel="noreferrer">
      {children}
      <Icon name="arrowUp" size={17} />
    </a>
  );
}

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
  const savedIds = useMemo(() => new Set(saved.map((c) => c.id)), [saved]);
  const { concerts, source, partial } = result;
  const today = easternToday();

  const regionOptions = useMemo(() => {
    const counts = new Map();
    concerts.forEach((c) => c.regions.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1]).map(([r]) => ({ id: r, label: r }));
  }, [concerts]);
  const tagOptions = [
    { id: "welcomes", label: "WXPN Welcomes" },
    { id: "fan", label: "Free at Noon" },
    ...(saved.length ? [{ id: "saved", label: "Saved" }] : []),
  ];

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = concerts.filter(
    (c) =>
      words.every((w) => `${c.artist} ${c.venue} ${c.city}`.toLowerCase().includes(w)) &&
      inRange(c.date, when, today) &&
      (!regions.length || c.regions.some((r) => regions.includes(r))) &&
      (!tags.includes("welcomes") || c.xpnWelcomes) &&
      (!tags.includes("fan") || c.freeAtNoon) &&
      (!tags.includes("saved") || savedIds.has(c.id)),
  );
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
      <div className="empty-state">
        <Icon name="navConcerts" size={32} />
        <h2>Find your next show</h2>
        <p>WXPN’s full concert calendar, including WXPN Welcomes shows, is on xpn.org.</p>
        <CalendarLink />
      </div>
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
      <div className="empty-state">
        <Icon name="navConcerts" size={32} />
        <h2>No upcoming concerts listed</h2>
        <p>New shows are announced all the time.</p>
        <CalendarLink />
      </div>
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
          <p className="info-note concert-partial" role="status">
            <span>Some concerts couldn’t load, so this list may be missing a few.</span>
            <button className="text-button" onClick={result.retry}>
              Try again
            </button>
          </p>
        )}
        {filtered.slice(0, shown).map((c) => (
          <ConcertRow key={c.id} concert={c} />
        ))}
        {filtered.length > shown && (
          <button className="secondary-button show-more" onClick={() => setShown(shown + PAGE)}>
            Show more concerts
          </button>
        )}
        <NewsletterPrompt />
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Concerts</h1>
        </div>
        <a href={CALENDAR_URL} className="text-button" target="_blank" rel="noreferrer">
          On xpn.org
          <Icon name="arrowUp" size={17} />
        </a>
      </div>
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
          <p className="concert-count" role="status">
            {filtered.length} {filtered.length === 1 ? "concert" : "concerts"}
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
