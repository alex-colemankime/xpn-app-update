import { Art } from "../ui.jsx";
import { clockTime, lengthLabel, shortDay } from "../time.js";

// One video: its poster with the length on it, then who and what; the whole
// card plays it, as on any video service, so no play badge sits on the
// picture. The hero is the same card, larger, for the newest video.
export function VideoCard({ video, onWatch, hero = false }) {
  const label = [video.artist, video.detail, lengthLabel(video.duration)]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      className={`video-card ${hero ? "video-hero" : ""}`}
      onClick={() => onWatch(video)}
      aria-label={`Play ${label}`}
    >
      <span className="video-thumb">
        <Art src={video.poster} alt="" loading={hero ? "eager" : "lazy"} />
        {video.duration && (
          <span className="video-length" aria-hidden="true">
            {clockTime(video.duration)}
          </span>
        )}
      </span>
      <span className="video-text" aria-hidden="true">
        <strong>{video.artist || video.detail}</strong>
        {video.artist && <small>{video.detail}</small>}
        {video.published && <small className="video-date">{shortDay(video.published)}</small>}
      </span>
    </button>
  );
}
