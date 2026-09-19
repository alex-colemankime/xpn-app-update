import { Icon, Art } from "../ui.jsx";
import { useFavorites, songId } from "../favorites.js";
import { clockLabel } from "../catalog.js";

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

