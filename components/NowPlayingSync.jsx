import { useEffect } from "react";
import { setMetadata } from "../player.js";
import { useLiveSong } from "../nowplaying.js";
import { usePlayer } from "../hooks/usePlayer.js";
import { keepClockRunning } from "../hooks/useNow.js";
import { useAudioFocus, useEpisodePlayer } from "../episode-player.js";

// Keeps the lock screen, media notification and browser tab in step with the
// song on air (or the station, when no song is current), or with the archive
// episode playing. Renders nothing.
export function NowPlayingSync({ playlist }) {
  const { playing: livePlaying, station } = usePlayer();
  const current = useLiveSong(playlist);
  const focus = useAudioFocus();
  const archive = useEpisodePlayer();
  const episode = focus === "episode" && archive.status === "playing" ? archive.episode : null;
  const playing = livePlaying || Boolean(episode);
  // While audio plays in the background, time keeps moving for the song info.
  useEffect(() => keepClockRunning(playing), [playing]);
  useEffect(() => {
    setMetadata(current);
  }, [current]);
  useEffect(() => {
    document.title = episode
      ? `${episode.title} — ${episode.showName}`
      : playing && current
        ? `${current.title} · ${current.artist} — ${station.label}`
        : playing
          ? `${station.label} — Listening live`
          : "WXPN — Listen live";
  }, [playing, current, station, episode]);
  return null;
}
