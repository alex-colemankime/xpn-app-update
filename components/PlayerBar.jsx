import { Icon, Art } from "../ui.jsx";
import { SaveSong } from "./MusicRows.jsx";

export function PlayerBar({ current, streamId, station, navigate, togglePlay, status, playing, volume, changeVolume, castAvailable, cast }) {
 return (
      <footer className="player-bar" aria-label="Radio player">
        <button className="player-track" onClick={() => navigate("listen")}>
          {current?.img ? (
            <Art src={current.img} />
          ) : (
            <span className="station-mark">
              {streamId === "xpn2" ? "xpn2" : streamId === "kids" ? "KC" : "xpn"}
            </span>
          )}
          <span>
            <strong>{current?.title || station.label}</strong>
            <small>{current ? `${current.artist} · ${station.label}` : station.tagline}</small>
          </span>
        </button>
        <div className="player-center">
          <button
            className="player-play"
            onClick={togglePlay}
            aria-label={
              status === "loading"
                ? "Cancel connecting to radio"
                : playing
                  ? "Pause live radio"
                  : "Play live radio"
            }
          >
            <Icon name={playing || status === "loading" ? "pause" : "play"} size={26} />
          </button>
          <span className="player-live">
            <i />
            {status === "loading" ? "CONNECTING" : playing ? "LIVE" : "PAUSED"}
          </span>
        </div>
        <div className="player-utilities">
          {current && <SaveSong track={current} />}
          <Icon name="volume" size={19} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => changeVolume(+e.target.value)}
          />
          {castAvailable && (
            <button className="icon-button" aria-label="Choose audio output" onClick={cast}>
              <Icon name="cast" size={19} />
            </button>
          )}
        </div>
      </footer>
);
}
