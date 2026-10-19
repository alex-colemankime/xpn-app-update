import { Art } from "../ui.jsx";
import { MenuHead, MenuItem, MenuSave } from "./MusicRows.jsx";
import { holdable, openHoldMenu } from "../hold.js";
import { savedVideoItem } from "../videos.js";
import { clockTime, lengthLabel, shortDay } from "../time.js";

// One video: its poster with the length on it, then who and what; the whole
// card plays it, as on any video service, so no play badge sits on the
// picture. The hero is the same card, larger, for the newest video.
// `date` false leaves out when it was posted (the Videos tab, newest first).
export function VideoCard({ video, onWatch, hero = false, date = true }) {
  const title = video.artist || video.detail;
  // Press and hold: watch it, or save it.
  const hold = holdable(() =>
    openHoldMenu({
      label: title,
      render: (close) => (
        <>
          <MenuHead art={video.poster} title={title} line={video.artist && video.detail} />
          <MenuItem
            icon="play"
            onClick={() => {
              close();
              onWatch(video);
            }}
          >
            Watch
          </MenuItem>
          <MenuSave type="videos" item={savedVideoItem(video)} name={title} close={close} />
        </>
      ),
    }),
  );
  return (
    <button
      ref={hold}
      className={`video-card ${hero ? "video-hero" : ""}`}
      onClick={() => onWatch(video)}
    >
      {/* Named by what it shows (Label in Name): "Play", then the words on
          the card, then the length said in full. */}
      <span className="sr-only">Play </span>
      <span className="video-thumb">
        <Art src={video.poster} alt="" loading={hero ? "eager" : "lazy"} />
        {video.duration && (
          <span className="video-length" aria-hidden="true">
            {clockTime(video.duration)}
          </span>
        )}
      </span>
      <span className="video-text">
        <strong>{video.artist || video.detail}</strong>
        {video.artist && (
          <small>
            <span className="sr-only">, </span>
            {video.detail}
          </small>
        )}
        {date && video.published && (
          <small className="video-date">
            <span className="sr-only">, </span>
            {shortDay(video.published)}
          </small>
        )}
      </span>
      {video.duration && <span className="sr-only">, {lengthLabel(video.duration)}</span>}
    </button>
  );
}
