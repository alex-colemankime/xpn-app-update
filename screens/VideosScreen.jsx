import { useState } from "react";
import { Empty, Icon, SearchField, Segmented } from "../ui.jsx";
import {
  chooseVideoSection,
  loadMoreVideos,
  loadVideos,
  matchVideos,
  useVideos,
} from "../videos.js";
import { VideoCard } from "../components/VideoCard.jsx";

// Under the newest video, the next four; each "Show more" adds a page.
const FIRST = 4;
const SHOW_STEP = 24;

function SkeletonVideos() {
  return (
    <div role="status" className="video-grid">
      <span className="sr-only">Loading videos…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span className="video-card skeleton-card" aria-hidden="true" key={i}>
          <span className="video-thumb skeleton-block" />
          <span className="skeleton-lines">
            <span className="skeleton-block skeleton-line" />
            <span className="skeleton-block skeleton-line" />
          </span>
        </span>
      ))}
    </div>
  );
}

// Videos: the station's collections (World Cafe, WXPN), newest first, the
// newest one large. Search looks through everything loaded in the
// collection; "Show more" reveals the rest, loading further pages as needed.
export function VideosScreen({ onWatch }) {
  const state = useVideos();
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(FIRST);
  const section = state.sections.find((s) => s.label === state.section) || state.sections[0];
  const choose = (label) => {
    chooseVideoSection(label);
    setCount(FIRST);
  };
  const videos = section?.videos || [];
  const found = matchVideos(videos, query);
  const searching = Boolean(query.trim());
  const [hero, ...rest] = found;
  const shown = searching ? found : rest.slice(0, count);
  const more = !searching && (rest.length > count || section?.more);
  const showMore = () => {
    if (section.moreFailed) {
      loadMoreVideos(section.playlist);
      return;
    }
    const next = count + SHOW_STEP;
    setCount(next);
    if (next + SHOW_STEP > rest.length) loadMoreVideos(section.playlist);
  };

  const retry = () => loadVideos({ force: true });
  let content;
  if (!videos.length) {
    content =
      section?.status === "error" ? (
        <Empty icon="video" title="Videos are unavailable" action="Try again" onAction={retry}>
          Check your connection and try again.
        </Empty>
      ) : section?.status === "loading" ? (
        <SkeletonVideos />
      ) : (
        <Empty icon="video" title="No videos here yet">
          New sessions appear here as they are posted.
        </Empty>
      );
  } else if (!found.length) {
    content = (
      <Empty
        icon="search"
        title="No matching videos"
        action="Clear search"
        onAction={() => setQuery("")}
      >
        Try an artist, a song or a session.
      </Empty>
    );
  } else {
    content = (
      <>
        {section.status === "cache" && state.loadedAt > 0 && (
          <p className="data-note">
            These may not be the newest videos: the collection couldn’t be refreshed.{" "}
            <button className="text-button" onClick={retry}>
              Try again
            </button>
          </p>
        )}
        {!searching && <VideoCard video={hero} onWatch={onWatch} hero />}
        <div className="video-grid">
          {shown.map((video) => (
            <VideoCard key={video.id} video={video} onWatch={onWatch} />
          ))}
        </div>
        {section.moreFailed && (
          <p className="data-note" role="status">
            Couldn’t load more videos. Check your connection and try again.
          </p>
        )}
        {more && (
          <button className="text-button playlist-expand video-more" onClick={showMore}>
            {section.moreFailed ? "Try again" : "Show more videos"}
            <span className="expand-chevron">
              <Icon name="chevD" size={17} />
            </span>
          </button>
        )}
        {searching && section?.more && (
          <p className="data-note">Searching the {videos.length} most recent videos.</p>
        )}
      </>
    );
  }

  return (
    <>
      {/* The tab bar (or sidebar) already says where this is. */}
      <h1 className="sr-only">Videos</h1>
      <div className="toolbar">
        {state.sections.length > 1 && (
          <Segmented
            label="Video collection"
            value={section.label}
            onChange={choose}
            options={state.sections.map((s) => s.label)}
          />
        )}
        <SearchField value={query} onChange={setQuery} placeholder="Search videos" />
      </div>
      <div className="videos">{content}</div>
    </>
  );
}
