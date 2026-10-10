import { setVolume, togglePlayback, VOLUME_SETTABLE } from "../player.js";
import { Icon, Art } from "../ui.jsx";
import { SaveSong } from "./MusicRows.jsx";
import {
  usePlayer,
  useVolume,
  chooseAudioOutput,
  chooseEpisodeOutput,
} from "../hooks/usePlayer.js";
import { CAST_KIND, CAST_LABEL } from "../cast.js";
import { playbackText } from "../playback-text.js";
import { useLiveSong } from "../nowplaying.js";
import { clockTime, lengthLabel } from "../time.js";
import {
  closeEpisode,
  resumeEpisode,
  pauseEpisode,
  useAudioFocus,
  useEpisodePlayer,
} from "../episode-player.js";
import { EpisodeScrubber } from "./Archive.jsx";
import { useArtTint } from "../art-tint.js";

// The bar's wash, from the artwork playing (styles/layout.css).
function useBarTint(art) {
  const tint = useArtTint(art || null);
  return tint
    ? { "data-tinted": "", style: { "--tint-light": tint.light, "--tint-dark": tint.dark } }
    : {};
}

// The volume slider, where the device lets the app set it (not on iPhone,
// where only the hardware buttons can).
function PlayerVolume() {
  const volume = useVolume();
  return (
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
  );
}

// AirPlay or Cast (cast.js), where the device has it: at the bar's far edge
// on larger screens, beside play in the mini player on phones.
function CastButton({ onClick }) {
  if (!CAST_KIND) return null;
  return (
    <button
      className="icon-button player-cast"
      aria-label={CAST_LABEL[CAST_KIND]}
      title={CAST_LABEL[CAST_KIND]}
      onClick={onClick}
    >
      <Icon name={CAST_KIND} size={20} />
    </button>
  );
}

// The bar while an archive episode has it: play, the episode (tap to open
// it), the scrubber on larger screens and a thin progress line on phones,
// and a close key that gives the bar back to the station.
function EpisodeBar({ onOpenEpisode }) {
  const { episode, status, position, duration } = useEpisodePlayer();
  const busy = status === "loading";
  const playing = status === "playing" || busy;
  const left = duration ? Math.max(0, duration - position) : 0;
  const tint = useBarTint(episode.image);
  return (
    <footer
      {...tint}
      className="player-bar"
      data-source="episode"
      data-playing={playing || undefined}
      aria-label="Archive player"
    >
      <span className="player-progress" aria-hidden="true">
        <i style={{ width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }} />
      </span>
      <button
        className="player-play"
        onClick={() => (playing ? pauseEpisode() : resumeEpisode())}
        aria-label={`${playing ? "Pause" : "Play"} ${episode.title}`}
        data-busy={busy || undefined}
      >
        <Icon name={playing ? "pause" : "play"} size={24} />
      </button>
      <div className="player-now">
        <button className="player-track" onClick={() => onOpenEpisode(episode)}>
          <span className="sr-only">Open episode: </span>
          <Art src={episode.image} />
          <span>
            <strong>{episode.title}</strong>
            <small>
              <span className="live-badge" data-state="archive">
                Archive
              </span>
              {episode.showName}
              {status === "ended" ? " · Played" : left ? ` · ${lengthLabel(left)} left` : ""}
              <span className="sr-only">
                , {clockTime(position)} of {clockTime(duration)}
              </span>
            </small>
          </span>
        </button>
      </div>
      <div className="player-seek">
        <EpisodeScrubber episode={episode} />
      </div>
      {(VOLUME_SETTABLE || CAST_KIND) && (
        <div className="player-utilities">
          {VOLUME_SETTABLE && <PlayerVolume />}
          <CastButton onClick={chooseEpisodeOutput} />
        </div>
      )}
      <button
        className="icon-button player-close"
        aria-label="Close the episode and return to the station"
        onClick={closeEpisode}
      >
        <Icon name="close" size={18} />
      </button>
    </footer>
  );
}

// The persistent player along the bottom of every screen.
//   - Phones: a mini player above the tab bar, the song with play at its end.
//   - Tablets and laptops: a bar under the content, lined up with the page.
//     Play leads the song it plays (a live station has no skip or seek, so a
//     lone button in the middle would only float there), then the heart; the
//     volume and output sit at the far edge.
export function PlayerBar(props) {
  const focus = useAudioFocus();
  const { episode } = useEpisodePlayer();
  if (focus === "episode" && episode) return <EpisodeBar onOpenEpisode={props.onOpenEpisode} />;
  return <LiveBar {...props} />;
}

function LiveBar({ playlist, onOpen }) {
  const player = usePlayer();
  const current = useLiveSong(playlist);
  const { station, playing, connecting, status } = player;
  const text = playbackText(player);
  // A small badge beside the artist says what the stream is doing; paused
  // needs none, the play button already says it.
  const badge = playing || connecting || status === "error" ? text.badge : "";
  const tint = useBarTint(current?.img);
  return (
    <footer {...tint} className="player-bar" aria-label="Radio player">
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
                  {badge}
                </span>
              )}
              {current ? `${current.artist} · ${station.label}` : station.tagline}
            </small>
          </span>
        </button>
        {current && <SaveSong track={current} />}
      </div>
      {(VOLUME_SETTABLE || CAST_KIND) && (
        <div className="player-utilities">
          {VOLUME_SETTABLE && <PlayerVolume />}
          <CastButton onClick={chooseAudioOutput} />
        </div>
      )}
    </footer>
  );
}
