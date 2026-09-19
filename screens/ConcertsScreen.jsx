import { useState } from "react";
import { Icon, Empty, SearchField } from "../ui.jsx";
import { useSavedConcerts } from "../concerts.js";

export function ConcertRow({ concert: c, saved, onToggle, sample, index = 0 }) {
  const date = new Date(`${c.date}T12:00:00`);
  return (
    <div className={`concert-row ${index % 2 ? "alternating" : ""}`}>
      <div className="concert-date">
        <span>{date.toLocaleDateString("en-US", { month: "short" })}</span>
        <strong>{date.getDate()}</strong>
        <small>{date.toLocaleDateString("en-US", { weekday: "short" })}</small>
      </div>
      <div className="concert-info">
        {c.xpnWelcomes && <span className="welcomes">WXPN WELCOMES</span>}
        <h3>{c.artist}</h3>
        <p>
          {c.venue}
          <span> · {c.region}</span>
        </p>
        <small>
          {c.age}
          {sample ? " · Sample listing" : ""}
        </small>
      </div>
      {c.ticketUrl && /^https?:\/\//.test(c.ticketUrl) ? (
        <a
          className="secondary-button ticket-link"
          href={c.ticketUrl}
          target="_blank"
          rel="noreferrer"
        >
          Tickets
          <Icon name="arrowUp" size={16} />
        </a>
      ) : null}
      <button
        className={`icon-button ${saved ? "saved" : ""}`}
        aria-label={`${saved ? "Unsave" : "Save"} ${c.artist} concert`}
        aria-pressed={saved}
        onClick={onToggle}
      >
        <Icon name={saved ? "heartF" : "heart"} />
      </button>
    </div>
  );
}

export function ConcertsScreen({ result }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All regions");
  const [month, setMonth] = useState("All dates");
  const [welcomes, setWelcomes] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, toggle] = useSavedConcerts();
  const regions = [...new Set(result.concerts.map((c) => c.region))].filter(Boolean);
  const months = [...new Set(result.concerts.map((c) => c.date.slice(0, 7)))];
  const filtered = result.concerts.filter(
    (c) =>
      `${c.artist} ${c.venue}`.toLowerCase().includes(query.toLowerCase()) &&
      (region === "All regions" || c.region === region) &&
      (month === "All dates" || c.date.startsWith(month)) &&
      (!welcomes || c.xpnWelcomes) &&
      (!savedOnly || saved.has(c.id)),
  );
  const clear = () => {
    setQuery("");
    setRegion("All regions");
    setMonth("All dates");
    setWelcomes(false);
    setSavedOnly(false);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Concerts</h1>
        </div>
        <a
          href="https://xpn.org/concert-and-events/"
          className="text-button"
          target="_blank"
          rel="noreferrer"
        >
          Current concert calendar
          <Icon name="arrowUp" size={17} />
        </a>
      </div>
      {result.source === "sample" && (
        <div className="preview-notice">
          <span className="sample-label">PREVIEW</span>
          <p>
            Sample listings from the original app, June–July 2026.{" "}
            <a href="https://xpn.org/concert-and-events/" target="_blank" rel="noreferrer">
              See current concerts on WXPN ↗
            </a>
          </p>
        </div>
      )}
      <div className="concert-filters">
        <SearchField value={query} onChange={setQuery} placeholder="Artist or venue" />
        <label>
          <span className="sr-only">Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option>All regions</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option>All dates</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(`${m}-01T12:00:00`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-checks">
        <label>
          <input
            type="checkbox"
            checked={welcomes}
            onChange={(e) => setWelcomes(e.target.checked)}
          />
          WXPN Welcomes
        </label>
        <label>
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => setSavedOnly(e.target.checked)}
          />
          Saved concerts
        </label>
        <span>{filtered.length} shows</span>
      </div>
      {result.source === "loading" ? (
        <p role="status" className="loading-state">
          Loading concerts…
        </p>
      ) : result.source === "error" ? (
        <Empty
          icon="navConcerts"
          title="The concert calendar is unavailable"
          action="Try again"
          onAction={result.retry}
        >
          Please try again in a moment.
        </Empty>
      ) : filtered.length ? (
        filtered.map((c, index) => (
          <ConcertRow
            key={c.id}
            concert={c}
            index={index}
            saved={saved.has(c.id)}
            onToggle={() => toggle(c.id)}
            sample={result.source === "sample"}
          />
        ))
      ) : (
        <Empty icon="navConcerts" title="No concerts match" action="Clear filters" onAction={clear}>
          Try another artist, month, or region.
        </Empty>
      )}
    </>
  );
}

