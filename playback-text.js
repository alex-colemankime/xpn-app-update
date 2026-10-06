import { STREAMS } from "./streams.js";

// Every word the player shows, in one pure module so the big button, the
// mini player, the status line and screen-reader labels never disagree.

// Labels for the play control. `station` is a STREAMS entry.
export function playbackText({ status, playing, station }) {
  if (status === "loading") {
    return {
      button: "Connecting…",
      badge: "CONNECTING",
      label: `Cancel connecting to ${station.label}`,
    };
  }
  if (status === "reconnecting") {
    return {
      button: "Reconnecting…",
      badge: "RECONNECTING",
      label: `Stop reconnecting to ${station.label}`,
    };
  }
  if (playing) return { button: "Pause", badge: "LIVE", label: `Pause ${station.label}` };
  if (status === "error")
    return { button: "Try again", badge: "OFFLINE", label: `Retry ${station.label}` };
  return { button: "Listen live", badge: "PAUSED", label: `Play ${station.label}` };
}

// The one line under the controls, or "" when the controls say it all.
// Playback problems come first, because they are what the listener can act
// on; song-info problems never stop the music.
export function statusLine({ status, streamId, playing }, playlist) {
  if (status === "error")
    return "The stream could not connect. Check your connection and try again.";
  if (status === "blocked") return "Tap Listen live to start.";
  if (status === "reconnecting") return "Having trouble reaching the stream. Trying again…";
  if (!STREAMS[streamId]?.songFeed) return "";
  if (playlist.status === "unavailable")
    return playing || status === "loading"
      ? "Song info is unavailable right now. The music keeps playing."
      : "Song info is unavailable right now. You can still listen live.";
  return "";
}
