import { useState } from "react";
import { Icon, Segmented, Empty, SearchField, shareText } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import { easternToday, inShowOrder } from "../concerts.js";
import { VideoCard } from "../components/VideoCard.jsx";
import { EpisodeRow, ShowHead } from "../components/Archive.jsx";
import { hasLeftArchive, useArchiveState } from "../archive.js";
import { showToast } from "../toast.js";
import { TrackRow, SaveButton } from "../components/MusicRows.jsx";
import { ConcertList } from "../components/ConcertRow.jsx";
import { PlaylistSyncPrompt, PlaylistSyncStatus } from "../components/PlaylistSync.jsx";
import { calendarIsNative, downloadIcs } from "../calendar.js";
import { useFeatures } from "../features.js";
import { savedShowGroups } from "../saved-shows.js";
import { tap } from "../haptics.js";
import { YouTubeSubscribe } from "../components/SocialLinks.jsx";

// Empty-state copy and the screen each category's call to action opens.
// Concerts and videos say no more than their title.
const EMPTY = {
  songs: {
    icon: "music",
    action: "Go to Listen",
    target: "listen",
    text: "Tap the heart beside a song to save it here.",
  },
  shows: {
    icon: "headphones",
    action: "Go to Shows",
    target: "shows",
    text: "Follow a show to keep its schedule here and get reminders, or save an episode to listen later.",
  },
  concerts: {
    icon: "navConcerts",
    action: "Go to Concerts",
    target: "concerts",
  },
  videos: {
    icon: "video",
    action: "Go to Videos",
    target: "videos",
  },
};

const searchText = (item) =>
  `${item.title || ""} ${item.artist || ""} ${item.name || ""} ${item.showName || ""}`.toLowerCase();

export function LibraryScreen({ visit = 0, onOpenShow, onOpenVideo, onNavigate }) {
  const [type, setType] = useState("songs");
  const [query, setQuery] = useState("");
  const songs = useFavoriteItems("songs");
  const shows = useFavoriteItems("shows");
  const episodes = useFavoriteItems("episodes");
  const concertsSaved = useFavoriteItems("concerts");
  const videos = useFavoriteItems("videos");
  const today = easternToday();

  const archive = useArchiveState();
  // Each feature here is on only when the build has it and the station
  // hasn't switched it off (features.js).
  const features = useFeatures();
  const q = query.trim().toLowerCase();
  // Followed shows and saved episodes, together: one list per show.
  const showGroups = savedShowGroups({
    followed: shows,
    episodes: features.archive ? episodes : [],
    catalog: SHOWS,
    query: q,
  });
  const items = {
    songs,
    shows: showGroups,
    ...(features.videos ? { videos } : {}),
    // Saved with their details, so they show even while the feed is down;
    // past dates drop off.
    ...(features.concerts ? { concerts: concertsSaved.filter((c) => c.date >= today) } : {}),
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

  // A category is chosen by its tab, and appears at once.
  const choose = (next) => {
    tap("selection");
    setType(next);
    setQuery("");
  };
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
      <div>
        <div className="toolbar">
          <Segmented
            label="Favorites category"
            value={category}
            onChange={(next) => choose(next)}
            options={Object.keys(items).map((key) => ({
              value: key,
              label: key[0].toUpperCase() + key.slice(1),
            }))}
          />
          {anything && (
            <SearchField value={query} onChange={setQuery} placeholder="Search your favorites" />
          )}
        </div>
        {/* The app keeps Favorites alive behind the other tabs. Each time it
            comes back to the front (`visit`, from App) its list is drawn
            afresh from what is saved now, so a song hearted on Listen is
            there at once: iPhone's web view could keep showing the list as
            it was until the tab was switched. */}
        <div key={`${category}-${visit}`} className="tab-pane">
          <p className="sr-only" role="status">
            {filtered.length} saved {category}
            {q ? " match your search" : ""}
          </p>
          {category === "songs" && songs.length > 0 ? (
            <PlaylistSyncStatus>
              <p className="data-note">Saved on this device.</p>
            </PlaylistSyncStatus>
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
              link={!q}
            >
              {q ? "Try a different name." : empty.text}
            </Empty>
          ) : category === "songs" ? (
            <>
              <div className="saved-songs">
                {filtered.map((t) => (
                  <TrackRow key={t.id} track={t} />
                ))}
              </div>
              <button className="text-button share-songs" onClick={shareSongs}>
                <Icon name="shareAlt" size={17} />
                Share your saved songs
              </button>
              {!q && (
                <PlaylistSyncPrompt count={songs.length} onSetUp={() => onNavigate("settings")} />
              )}
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
            <ConcertList concerts={inShowOrder(filtered)} />
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
        </div>
      </div>
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
      <ShowHead
        id={id}
        show={show}
        headId={headId}
        line={
          followed
            ? [show.times?.[0], show.host].filter(Boolean).join(" · ") || "Following"
            : "Not following"
        }
        onOpen={onOpenShow}
      />
      {episodes.map((ep) => (
        <EpisodeRow key={ep.id} episode={ep} gone={gone(ep)} />
      ))}
    </section>
  );
}
