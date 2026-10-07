import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { getPlayerSnapshot, isConnecting, pauseStream, playStream } from "../player.js";
import { getEpisodeState, pauseEpisode, resumeEpisode } from "../episode-player.js";
import { openPage } from "../links.js";
import { showToast } from "../toast.js";
import { youTubeEmbed } from "../updates.js";

// The radio or an archive episode, paused for a video and offered back.
let radioWasOn = false;
let episodeWasOn = false;
function pauseForVideo() {
  const { playing, status } = getPlayerSnapshot();
  radioWasOn = playing || isConnecting(status);
  if (radioWasOn) pauseStream();
  const episode = getEpisodeState();
  episodeWasOn =
    Boolean(episode.episode) && (episode.status === "playing" || episode.status === "loading");
  if (episodeWasOn) pauseEpisode();
}
function offerAudioBack() {
  if (radioWasOn)
    showToast("The radio paused for the video.", { label: "Resume", onClick: playStream });
  else if (episodeWasOn)
    showToast("The episode paused for the video.", { label: "Resume", onClick: resumeEpisode });
  radioWasOn = episodeWasOn = false;
}

// What is being watched on the watch page. Both kinds are part of the route,
// so Back (the browser's, or Android's) closes them: a station video by its
// id (#/videos/video/id), the live video as #/listen/live. The live video's
// details are held here; `currentLive` (the station's live video now)
// stands in when the page was reached some other way, such as a reload,
// once the station's updates have been checked (`updatesLoaded`).
// iOS opens YouTube in the browser view, since YouTube refuses embeds
// without a web referrer, which the iOS app (capacitor://localhost) can't
// send; any other link opens as a web page. Either way, and on the watch
// page, the radio (or an episode) pauses, and is offered back afterwards.
export function useWatching(
  { videoId, live: liveRoute, openVideo, openLive, closeVideo },
  currentLive = null,
  updatesLoaded = true,
) {
  const [held, setHeld] = useState(null);
  const watchLive = useCallback(
    (update) => {
      if (Capacitor.getPlatform() === "ios" || !youTubeEmbed(update.watch)) {
        pauseForVideo();
        openPage(update.watch, { onClose: offerAudioBack });
        return;
      }
      // Held first, in its own render, so the route's render finds it.
      flushSync(() => setHeld(update));
      openLive();
    },
    [openLive],
  );
  const watchVideo = useCallback((video) => openVideo(video.id), [openVideo]);

  const embeddable = (update) => (youTubeEmbed(update?.watch) ? update : null);
  const live = liveRoute ? embeddable(held) || embeddable(currentLive) : null;
  // The live route with nothing to show (the video has ended): close it.
  const stranded = liveRoute && !live && updatesLoaded;
  useEffect(() => {
    if (stranded) closeVideo();
  }, [stranded, closeVideo]);

  const watching = Boolean(videoId || live);
  useEffect(() => {
    if (!watching) return;
    pauseForVideo();
    return offerAudioBack;
  }, [watching]);

  return {
    watching,
    live: videoId ? null : live,
    watchLive,
    watchVideo,
    // From the page's Up next: that video, in place of whatever was showing.
    pick: (video) => openVideo(video.id),
    close: closeVideo,
  };
}
