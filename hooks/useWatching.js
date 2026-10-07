import { useCallback, useEffect, useState } from "react";
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

// What is being watched on the watch page. A station video is part of the
// route (#/videos/video/id), so Back closes it; a live YouTube video (Free at
// Noon) is held here. iOS opens YouTube in the browser view, since YouTube
// refuses embeds without a web referrer, which the iOS app
// (capacitor://localhost) can't send; any other link opens as a web page.
// While anything is watched, the radio (or an episode) is paused, and offered
// back once the video is closed.
export function useWatching({ videoId, openVideo, closeVideo }) {
  const [live, setLive] = useState(null);
  const watchLive = useCallback((update) => {
    if (Capacitor.getPlatform() === "ios" || !youTubeEmbed(update.watch)) openPage(update.watch);
    else setLive(update);
  }, []);
  const watchVideo = useCallback((video) => openVideo(video.id), [openVideo]);

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
    pick: (video) => {
      openVideo(video.id);
      setLive(null);
    },
    close: videoId ? closeVideo : () => setLive(null),
  };
}
