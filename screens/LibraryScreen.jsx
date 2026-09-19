import { useState } from "react";
import { Icon, Art, Segmented, Empty, SearchField, shareText } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { useFavorites } from "../favorites.js";
import { useSavedConcerts } from "../concerts.js";
import { TrackRow, ShowCard } from "../components/MusicRows.jsx";
import { ConcertRow } from "./ConcertsScreen.jsx";

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
          filtered.map((c, index) => (
            <ConcertRow
              key={c.id}
              concert={c}
            index={index}
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

