import { useState } from "react";
import { Icon, Art, Segmented, Empty, SearchField, shareText } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import { easternToday } from "../concerts.js";
import { ARCHIVE_ENABLED, CONCERTS_ENABLED, SHOW_SAMPLES } from "../config.js";
import { EpisodeRow } from "../components/Archive.jsx";
import { showToast } from "../toast.js";
import { TrackRow, ShowCard, SaveButton } from "../components/MusicRows.jsx";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { PlaylistSyncPrompt } from "../components/PlaylistSync.jsx";
import { calendarIsNative, downloadIcs } from "../calendar.js";

// Empty-state copy and the screen each category's call to action opens.
const EMPTY = {
  songs: {
    icon: "music",
    action: "Find a song",
    target: "listen",
    text: "Hear something you love? Tap the heart beside a song to keep it here.",
  },
  shows: {
    icon: "headphones",
    action: "Explore shows",
    target: "shows",
    text: "Follow your favorite voices and keep their schedules close.",
  },
  episodes: {
    icon: "headphones",
    action: "Explore shows",
    target: "shows",
    text: "Save an episode from the archive to listen later.",
  },
  concerts: {
    icon: "navConcerts",
    action: "Explore concerts",
    target: "concerts",
    text: "Save a concert and make a night of it.",
  },
};

const searchText = (item) =>
  `${item.title || ""} ${item.artist || ""} ${item.name || ""} ${item.showName || ""}`.toLowerCase();

export function LibraryScreen({ onOpenShow, onNavigate }) {
  const [type, setType] = useState("songs");
  const [query, setQuery] = useState("");
  const songs = useFavoriteItems("songs");
  const shows = useFavoriteItems("shows");
  const episodes = useFavoriteItems("episodes");
  const concertsSaved = useFavoriteItems("concerts");
  const today = easternToday();

  // Episodes come from the archive; in preview builds also the samples.
  const items = {
    songs,
    shows,
    ...(ARCHIVE_ENABLED || SHOW_SAMPLES
      ? { episodes: SHOW_SAMPLES ? episodes : episodes.filter((ep) => ep.audio) }
      : {}),
    // Saved with their details, so they show even while the feed is down;
    // past dates drop off.
    ...(CONCERTS_ENABLED ? { concerts: concertsSaved.filter((c) => c.date >= today) } : {}),
  };
  const category = items[type] ? type : "songs";
  const q = query.trim().toLowerCase();
  const filtered = items[category].filter((item) => !q || searchText(item).includes(q));
  const empty = EMPTY[category];
  // Until something is saved, the counts and search have nothing to work on.
  const anything = Object.values(items).some((list) => list.length);

  const shareSongs = async () =>
    showToast(
      await shareText(
        "My WXPN discoveries",
        songs.map((t) => `${t.title} — ${t.artist}`).join("\n"),
      ),
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Favorites</h1>
        </div>
        {category === "songs" && songs.length > 0 && (
          <button className="text-button" onClick={shareSongs}>
            <Icon name="shareAlt" size={18} />
            Share songs
          </button>
        )}
      </div>
      <div className="toolbar">
        <Segmented
          label="Favorites category"
          value={category}
          onChange={(next) => {
            setType(next);
            setQuery("");
          }}
          options={Object.keys(items).map((key) => ({
            value: key,
            label: key[0].toUpperCase() + key.slice(1),
            count: items[key].length || undefined,
          }))}
        />
        {anything && (
          <SearchField value={query} onChange={setQuery} placeholder="Search your favorites" />
        )}
      </div>
      <p className="sr-only" role="status">
        {filtered.length} saved {category}
        {q ? " match your search" : ""}
      </p>
      {category === "songs" && songs.length > 0 ? (
        <PlaylistSyncPrompt onSetUp={() => onNavigate("settings")} />
      ) : category === "concerts" && items.concerts?.length > 1 && !calendarIsNative() ? (
        <button className="playlist-prompt" onClick={() => downloadIcs(items.concerts)}>
          <Icon name="calendarAdd" size={18} />
          <span>Add all {items.concerts.length} concerts to your calendar</span>
          <Icon name="chev" size={16} />
        </button>
      ) : (
        anything && <p className="data-note">Saved on this device.</p>
      )}
      {!filtered.length ? (
        <Empty
          icon={empty.icon}
          title={q ? "No matching favorites" : `No saved ${category} yet`}
          action={q ? "Clear search" : empty.action}
          onAction={() => (q ? setQuery("") : onNavigate(empty.target))}
        >
          {q ? "Try a different name." : empty.text}
        </Empty>
      ) : category === "songs" ? (
        filtered.map((t) => <TrackRow key={t.id} track={t} />)
      ) : category === "shows" ? (
        <div className="show-grid all-shows">
          {filtered.map((s) => (
            <div className="saved-show" key={s.id}>
              <ShowCard show={SHOWS[s.id] || s} onOpen={onOpenShow} />
              <SaveButton type="shows" item={s} name={s.name} />
            </div>
          ))}
        </div>
      ) : category === "concerts" ? (
        filtered.map((c) => <ConcertRow key={c.id} concert={c} />)
      ) : (
        filtered.map((ep) =>
          ep.audio ? (
            <EpisodeRow
              key={ep.id}
              episode={ep}
              onOpen={(e) => onOpenShow(e.show || e.showId, e.id)}
            />
          ) : (
            <div className="episode-row" key={ep.id}>
              <button className="episode-open" onClick={() => onOpenShow(ep.showId, ep.id)}>
                <Art src={ep.img} alt="" />
                <span>
                  <strong>{ep.title}</strong>
                  <small>
                    {ep.showName} · {ep.date}
                  </small>
                </span>
                <Icon name="chev" size={18} />
              </button>
              <SaveButton type="episodes" item={ep} name={ep.title} />
            </div>
          ),
        )
      )}
    </>
  );
}
