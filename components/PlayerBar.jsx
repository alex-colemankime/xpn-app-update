import { setVolume, togglePlayback } from "../player.js";
import { Icon, Art } from "../ui.jsx";
import { SaveSong } from "./MusicRows.jsx";
import { usePlayer, useVolume, chooseAudioOutput } from "../hooks/usePlayer.js";
import { playbackText } from "../playback-text.js";
import { useLiveSong } from "../nowplaying.js";

// The persistent mini player along the bottom of every screen.
export function PlayerBar({ playlist, onOpen }) {
  const player = usePlayer();
  const current = useLiveSong(playlist);
  const { station, playing, connecting, castAvailable } = player;
  const volume = useVolume();
  const text = playbackText(player);
  return (
    <footer className="player-bar" aria-label="Radio player">
      <button className="player-track" onClick={onOpen}>
        <span className="sr-only">Open Listen live: </span>
        {current?.img ? (
          <Art src={current.img} />
        ) : (
          <span className="station-mark" aria-hidden="true">
            {station.shortMark}
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
          onClick={togglePlayback}
          aria-label={text.label}
          data-busy={connecting || undefined}
        >
          <Icon name={playing || connecting ? "pause" : "play"} size={26} />
        </button>
        <span className="player-live" data-live={playing || undefined}>
          <i />
          {text.badge}
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
          onChange={(e) => setVolume(+e.target.value)}
        />
        {castAvailable && (
          <button
            className="icon-button"
            aria-label="Choose audio output"
            onClick={chooseAudioOutput}
          >
            <Icon name="cast" size={19} />
          </button>
        )}
      </div>
    </footer>
  );
}
