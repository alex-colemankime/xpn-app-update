import { useState } from "react";
import { Art, Icon, Segmented, Empty, SearchField, shareText } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import { easternToday } from "../concerts.js";
import { ARCHIVE_ENABLED, CONCERTS_ENABLED, VIDEOS_ENABLED } from "../config.js";
import { VideoCard } from "../components/VideoCard.jsx";
import { EpisodeRow } from "../components/Archive.jsx";
import { hasLeftArchive, useArchiveState } from "../archive.js";
import { showToast } from "../toast.js";
import { TrackRow, SaveButton } from "../components/MusicRows.jsx";
import { ConcertRow } from "../components/ConcertRow.jsx";
import { PlaylistSyncPrompt } from "../components/PlaylistSync.jsx";
import { calendarIsNative, downloadIcs } from "../calendar.js";
import { useFeatures } from "../features.js";
import { savedShowGroups } from "../saved-shows.js";
import { YouTubeSubscribe } from "../components/SocialLinks.jsx";

// Empty-state copy and the screen each category's call to action opens.
const EMPTY = {
  songs: {
    icon: "music",
    action: "Find a song",
    target: "listen",
    text: "Tap the heart beside a song to save it here.",
  },
  shows: {
    icon: "headphones",
    action: "Explore shows",
    target: "shows",
    text: "Follow a show to keep its schedule here and get reminders, or save an episode to listen later.",
  },
  concerts: {
    icon: "navConcerts",
    action: "Explore concerts",
    target: "concerts",
    text: "Save a concert to keep it here and add it to your calendar.",
  },
  videos: {
    icon: "video",
    action: "Explore videos",
    target: "videos",
    text: "Save a video to watch it later.",
  },
};

const searchText = (item) =>
  `${item.title || ""} ${item.artist || ""} ${item.name || ""} ${item.showName || ""}`.toLowerCase();

export function LibraryScreen({ onOpenShow, onOpenVideo, onNavigate }) {
  const [type, setType] = useState("songs");
  const [query, setQuery] = useState("");
  const songs = useFavoriteItems("songs");
  const shows = useFavoriteItems("shows");
  const episodes = useFavoriteItems("episodes");
  const concertsSaved = useFavoriteItems("concerts");
  const videos = useFavoriteItems("videos");
  const today = easternToday();

  const archive = useArchiveState();
  const features = useFeatures();
  const archiveOn = ARCHIVE_ENABLED && features.archive;
  const q = query.trim().toLowerCase();
  // Followed shows and saved episodes, together: one list per show.
  const showGroups = savedShowGroups({
    followed: shows,
    episodes: archiveOn ? episodes : [],
    catalog: SHOWS,
    query: q,
  });
  const items = {
    songs,
    shows: showGroups,
    ...(VIDEOS_ENABLED && features.videos ? { videos } : {}),
    // Saved with their details, so they show even while the feed is down;
    // past dates drop off.
    ...(CONCERTS_ENABLED && features.concerts
      ? { concerts: concertsSaved.filter((c) => c.date >= today) }
      : {}),
  };
  const category = items[type] ? type : "songs";
  // Show groups arrive searched already.
  const filtered =
    category === "shows"
      ? showGroups
      : items[category].filter((item) => !q || searchText(item).includes(q));
  const empty = EMPTY[category];
  // Until something is saved, search has nothing to work on.
  const anything = Boolean(q) || Object.values(items).some((list) => list.length);

  const shareSongs = async () =>
    showToast(
      await shareText(
        "My WXPN discoveries",
        songs.map((t) => `${t.title} — ${t.artist}`).join("\n"),
      ),
    );

  return (
    <>
      {/* The tab bar (or sidebar) already says where this is. */}
      <h1 className="sr-only">Favorites</h1>
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
        <>
          {filtered.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
          <button className="text-button share-songs" onClick={shareSongs}>
            <Icon name="shareAlt" size={17} />
            Share your saved songs
          </button>
        </>
      ) : category === "shows" ? (
        <div className="archive-list saved-shows">
          {filtered.map((group) => (
            <SavedShow
              key={group.id}
              group={group}
              gone={(ep) => hasLeftArchive(archive, ep)}
              onOpenShow={onOpenShow}
            />
          ))}
        </div>
      ) : category === "concerts" ? (
        filtered.map((c) => <ConcertRow key={c.id} concert={c} />)
      ) : category === "videos" ? (
        <div className="video-grid saved-videos">
          {filtered.map((v) => (
            <div className="saved-video" key={v.id}>
              <VideoCard video={v} onWatch={onOpenVideo} />
              <SaveButton type="videos" item={v} name={v.artist || v.name} />
            </div>
          ))}
        </div>
      ) : null}
      {category === "videos" && !q && <YouTubeSubscribe />}
    </>
  );
}

// One show in Favorites › Shows: the show at the head, its heart full if
// it's followed, empty if only episodes are saved, then those episodes.
function SavedShow({ group, gone, onOpenShow }) {
  const { id, show, followed, episodes } = group;
  const headId = `saved-show-${id}`;
  return (
    <section className="archive-show" aria-labelledby={headId}>
      <div className="archive-show-head saved-show-head">
        <button className="saved-show-open" onClick={() => onOpenShow(id)}>
          <Art src={show.img} alt="" loading="lazy" />
          <span>
            <strong id={headId}>{show.name}</strong>
            <small>
              {followed
                ? [show.times?.[0], show.host].filter(Boolean).join(" · ") || "Following"
                : "Not following"}
            </small>
          </span>
        </button>
        <SaveButton type="shows" item={{ ...show, id }} name={show.name} verb="Follow" />
      </div>
      {episodes.map((ep) => (
        <EpisodeRow
          key={ep.id}
          episode={ep}
          showShow={false}
          gone={gone(ep)}
          onOpen={(e) => onOpenShow(e.show || e.showId || id, e.id)}
        />
      ))}
    </section>
  );
}
