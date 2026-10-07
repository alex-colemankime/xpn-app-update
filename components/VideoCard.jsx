import { Art, Icon } from "../ui.jsx";
import { clockTime, lengthLabel } from "../archive.js";

// "Oct 1", or "Oct 1, 2025" before this year.
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const videoDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.getFullYear() === new Date().getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
};

// One video: its poster with the length on it, then who and what. The hero
// is the same card, larger, for the newest video.
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
        <span className="video-play" aria-hidden="true">
          <Icon name="play" size={hero ? 26 : 18} />
        </span>
        {video.duration && (
          <span className="video-length" aria-hidden="true">
            {clockTime(video.duration)}
          </span>
        )}
      </span>
      <span className="video-text" aria-hidden="true">
        {hero && <span className="eyebrow">Newest · {videoDay(video.published)}</span>}
        <strong>{video.artist || video.detail}</strong>
        {video.artist && <small>{video.detail}</small>}
        {!hero && video.published && (
          <small className="video-date">{videoDay(video.published)}</small>
        )}
      </span>
    </button>
  );
}
