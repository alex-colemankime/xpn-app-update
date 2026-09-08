import { useEffect, useState } from "react";
import { Icon, Art, Modal, Segmented, Empty, SearchField, shareText } from "./ui.jsx";
import { SHOWS, DAYS, easternParts, scheduleForDay, clockLabel, showUrl } from "./catalog.js";
import { useFavorites, songId } from "./favorites.js";
import { fetchConcertResult, useSavedConcerts } from "./concerts.js";
import { DAY_LABELS, formatAlarmTime } from "./alarm.js";
import { STREAMS } from "./player.js";

export function SaveSong({ track }) {
  const fav = useFavorites("songs");
  const saved = fav.isSaved(songId(track));
  return (
    <button
      className={`icon-button ${saved ? "saved" : ""}`}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove" : "Save"} ${track.title}`}
      onClick={() => fav.toggle(track)}
    >
      <Icon name={saved ? "heartF" : "heart"} />
    </button>
  );
}
export function ShowCard({ show, onOpen }) {
  return (
    <button className="show-card" onClick={() => onOpen(show)}>
      <div className="show-cover">
        <Art src={show.img} alt={show.name} loading="lazy" />
        <span className="round-arrow">
          <Icon name="arrowUp" />
        </span>
      </div>
      <h3>{show.name.replace("WXPN ", "")}</h3>
      <p>{show.host.split(" & ")[0]}</p>
    </button>
  );
}
export function TrackRow({ track, index }) {
  return (
    <div className="track-row">
      {index != null && <span className="track-number">{String(index + 1).padStart(2, "0")}</span>}
      <Art src={track.img} loading="lazy" />
      <span>
        <strong>{track.title}</strong>
        <small>{track.artist}</small>
      </span>
      {track.time && <time className="track-time">{clockLabel(track.time)}</time>}
      <SaveSong track={track} />
    </div>
  );
}

export function ShowsScreen({ onOpen }) {
  const [mode, setMode] = useState("Featured");
  const [day, setDay] = useState(easternParts().day);
  const [query, setQuery] = useState("");
  const all = Object.values(SHOWS);
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

export function useConcerts() {
  const [result, setResult] = useState({ concerts: [], source: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult((r) => ({ ...r, source: "loading" }));
    fetchConcertResult().then((data) => {
      if (active) setResult(data);
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { ...result, retry: () => setAttempt((n) => n + 1) };
}
export function ConcertRow({ concert: c, saved, onToggle, sample }) {
  const date = new Date(`${c.date}T12:00:00`);
  return (
    <div className="concert-row">
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
        filtered.map((c) => (
          <ConcertRow
            key={c.id}
            concert={c}
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

export function LibraryScreen({ onOpen, onEpisode, onNavigate, concerts, onMessage }) {
  const [type, setType] = useState("songs");
  const [query, setQuery] = useState("");
  const songs = useFavorites("songs");
  const shows = useFavorites("shows");
  const episodes = useFavorites("episodes");
  const [savedConcerts, toggleConcert] = useSavedConcerts();
  const concertItems = concerts.concerts.filter((c) => savedConcerts.has(c.id));
  const items = {
    songs: songs.items,
    shows: shows.items,
    episodes: episodes.items,
    concerts: concertItems,
  };
  const filtered = items[type].filter((item) =>
    `${item.title || ""} ${item.artist || ""} ${item.name || ""} ${item.showName || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Favorites</h1>
        </div>
        {songs.items.length > 0 && (
          <button
            className="secondary-button"
            onClick={async () =>
              onMessage(
                await shareText(
                  "My WXPN discoveries",
                  songs.items.map((t) => `${t.title} — ${t.artist}`).join("\n"),
                ),
              )
            }
          >
            <Icon name="shareAlt" size={18} />
            Share songs
          </button>
        )}
      </div>
      <div className="toolbar">
        <Segmented
          label="Library category"
          value={type}
          onChange={setType}
          options={Object.keys(items).map((key) => ({
            value: key,
            label: `${key[0].toUpperCase() + key.slice(1)} ${items[key].length}`,
          }))}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Search your library" />
      </div>
      <p className="data-note">Saved on this device.</p>
      {filtered.length ? (
        type === "songs" ? (
          filtered.map((t, i) => <TrackRow key={t.id} track={t} index={i} />)
        ) : type === "shows" ? (
          <div className="show-grid all-shows">
            {filtered.map((s) => (
              <div className="saved-show" key={s.id}>
                <ShowCard show={SHOWS[s.id] || s} onOpen={onOpen} />
                <button
                  className="icon-button saved"
                  aria-label={`Unfollow ${s.name}`}
                  onClick={() => shows.toggle(s)}
                >
                  <Icon name="heartF" />
                </button>
              </div>
            ))}
          </div>
        ) : type === "concerts" ? (
          filtered.map((c) => (
            <ConcertRow
              key={c.id}
              concert={c}
              sample={concerts.source === "sample"}
              saved
              onToggle={() => toggleConcert(c.id)}
            />
          ))
        ) : (
          filtered.map((ep) => (
            <div className="episode-row" key={ep.id}>
              <button
                className="episode-open"
                onClick={() =>
                  onEpisode(
                    SHOWS[ep.showId] || {
                      id: ep.showId,
                      name: ep.showName,
                      img: ep.img,
                      host: ep.host,
                      episodes: [],
                    },
                    ep,
                  )
                }
              >
                <Art src={ep.img} />
                <span>
                  <strong>{ep.title}</strong>
                  <small>
                    {ep.showName} · {ep.date}
                  </small>
                </span>
                <Icon name="chev" size={18} />
              </button>
              <button
                className="icon-button saved"
                aria-label={`Remove ${ep.title}`}
                onClick={() => episodes.toggle(ep)}
              >
                <Icon name="heartF" />
              </button>
            </div>
          ))
        )
      ) : (
        <Empty
          icon={type === "concerts" ? "navConcerts" : type === "songs" ? "music" : "headphones"}
          title={query ? "No matching discoveries" : `No saved ${type} yet.`}
          action={
            query
              ? "Clear search"
              : type === "songs"
                ? "Find a song"
                : type === "concerts"
                  ? "Explore concerts"
                  : "Explore shows"
          }
          onAction={() =>
            query
              ? setQuery("")
              : onNavigate(type === "songs" ? "listen" : type === "concerts" ? "concerts" : "shows")
          }
        >
          {query
            ? "Try a different name."
            : type === "songs"
              ? "Hear something you love? Tap the heart beside a song to keep it here."
              : type === "shows"
                ? "Follow your favorite voices and keep their schedules close."
                : type === "episodes"
                  ? "Save an episode from a show’s archive to find it here."
                  : "Save a concert and make a night of it."}
        </Empty>
      )}
    </>
  );
}

export function SettingsScreen({
  alarm,
  updateAlarm,
  onPreviewAlarm,
  volume,
  onVolume,
  canCast,
  onCast,
  onMessage,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-panel">
          <div className="section-heading">
            <h2>
              <Icon name="clock" />
              Radio alarm
            </h2>
            <button
              className={`switch ${alarm.enabled ? "checked" : ""}`}
              role="switch"
              aria-checked={alarm.enabled}
              aria-label="Enable radio alarm"
              onClick={() => updateAlarm({ enabled: !alarm.enabled })}
            >
              <span />
            </button>
          </div>
          <label className="alarm-time">
            <span className="eyebrow">ALARM TIME · YOUR LOCAL TIME</span>
            <input
              aria-label="Alarm time"
              type="time"
              value={alarm.time}
              onChange={(e) => updateAlarm({ time: e.target.value })}
              required
            />
          </label>
          <div className="repeat-days" role="group" aria-label="Repeat alarm on">
            {DAY_LABELS.map((d) => (
              <button
                key={d.id}
                aria-label={d.label}
                aria-pressed={alarm.repeatDays.includes(d.id)}
                className={alarm.repeatDays.includes(d.id) ? "active" : ""}
                onClick={() =>
                  updateAlarm({
                    repeatDays: alarm.repeatDays.includes(d.id)
                      ? alarm.repeatDays.filter((x) => x !== d.id)
                      : [...alarm.repeatDays, d.id].sort(),
                  })
                }
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>
          {!alarm.repeatDays.length && (
            <p className="data-note">Select at least one day for the alarm to ring.</p>
          )}
          <label className="setting-row">
            <span>Wake-up station</span>
            <select
              value={alarm.streamId}
              onChange={(e) => updateAlarm({ streamId: e.target.value })}
            >
              {Object.values(STREAMS).map((s) => (
                <option value={s.id} key={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <span>Snooze for</span>
            <select
              value={alarm.snoozeMinutes}
              onChange={(e) => updateAlarm({ snoozeMinutes: +e.target.value })}
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <span>
              Alarm volume <small>{alarm.volume}%</small>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={alarm.volume}
              onChange={(e) => updateAlarm({ volume: +e.target.value })}
            />
          </label>
          <button className="secondary-button" onClick={onPreviewAlarm}>
            <Icon name="play" size={17} />
            Test alarm sound
          </button>
          <p className="data-note">
            Keep this app open and your device awake. Browser alarms cannot wake a closed app or a
            locked device; playback also depends on browser audio permissions.
          </p>
        </section>
        <div>
          <section className="settings-panel">
            <h2>
              <Icon name="headphones" />
              Listening
            </h2>
            <label className="setting-row">
              <span>
                Volume <small>{volume}%</small>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolume(+e.target.value)}
              />
            </label>
            <p className="data-note">On iPhone and iPad, use your device’s volume buttons.</p>
            {canCast && (
              <button className="setting-row full-width" onClick={onCast}>
                <span>Choose audio output</span>
                <Icon name="cast" />
              </button>
            )}
            <p className="data-note">
              Playback continues as you browse. Pausing disconnects the stream to save data.
            </p>
          </section>
          <section className="settings-panel">
            <h2>Stay connected</h2>
            {[
              { label: "Support WXPN", url: "https://xpn.org/donate/" },
              { label: "Contact the station", url: "mailto:wxpndesk@xpn.org" },
              {
                label: "Technical support",
                url: "mailto:wxpndesk@xpn.org?subject=WXPN%20App%20Support",
              },
              { label: "Privacy policy", url: "https://xpn.org/privacy-policy/" },
            ].map((link) => (
              <a
                className="setting-row"
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
                <Icon name="arrowUp" size={17} />
              </a>
            ))}
            <p className="data-note">
              WXPN · 88.5 FM Philadelphia
              <br />
              Listener-supported public radio.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
