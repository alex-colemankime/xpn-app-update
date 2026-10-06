import { Capacitor } from "@capacitor/core";
import { setVolume, togglePlayback } from "../player.js";
import { Icon, Art } from "../ui.jsx";
import { SaveSong } from "./MusicRows.jsx";
import { usePlayer, useVolume, chooseAudioOutput } from "../hooks/usePlayer.js";
import { playbackText } from "../playback-text.js";
import { useLiveSong } from "../nowplaying.js";

// iOS sets volume only with the device's buttons, so the app offers no slider
// there (as in Settings).
const VOLUME_SETTABLE = Capacitor.getPlatform() !== "ios";

// The persistent player along the bottom of every screen.
//   - Phones: a mini player above the tab bar, the song with play at its end.
//   - Tablets and laptops: a bar under the content, lined up with the page.
//     Play leads the song it plays (a live station has no skip or seek, so a
//     lone button in the middle would only float there), then the heart; the
//     volume and output sit at the far edge.
export function PlayerBar({ playlist, onOpen }) {
  const player = usePlayer();
  const current = useLiveSong(playlist);
  const { station, playing, connecting, status, castAvailable } = player;
  const volume = useVolume();
  const text = playbackText(player);
  // A small badge beside the artist says what the stream is doing; paused
  // needs none, the play button already says it.
  const badge = playing || connecting || status === "error" ? text.badge : "";
  return (
    <footer className="player-bar" aria-label="Radio player">
      <button
        className="player-play"
        onClick={togglePlayback}
        aria-label={text.label}
        data-busy={connecting || undefined}
      >
        <Icon name={playing || connecting ? "pause" : "play"} size={24} />
      </button>
      <div className="player-now">
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
            <small>
              {badge && (
                <span className="live-badge" data-state={playing ? "live" : status}>
                  <i />
                  {badge.toLowerCase()}
                </span>
              )}
              {current ? `${current.artist} · ${station.label}` : station.tagline}
            </small>
          </span>
        </button>
        {current && <SaveSong track={current} />}
      </div>
      {(VOLUME_SETTABLE || castAvailable) && (
        <div className="player-utilities">
          {VOLUME_SETTABLE && (
            <label className="player-volume">
              <Icon name="volume" size={19} />
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(+e.target.value)}
                style={{ "--fill": `${volume}%` }}
              />
            </label>
          )}
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
      )}
    </footer>
  );
}
