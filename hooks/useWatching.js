import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { getPlayerSnapshot, isConnecting, pauseStream, playStream } from "../player.js";
import { getEpisodeState, pauseEpisode, resumeEpisode } from "../episode-player.js";
import { openPage } from "../links.js";
import { showToast } from "../toast.js";
import { youTubeEmbed } from "../updates.js";
import { track } from "../analytics.js";

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

// Which live video the live route shows. The one the listener chose, as the
// station reports it now (so "soon" turns to "live"), until the station no
// longer lists it (it has ended); before the station's updates have been
// checked, as it was when chosen. With no choice made (a reload, a link, Back
// and Forward), the station's live video now. Only videos that play in the
// page count.
export function liveToShow({ chosen, current, updatesLoaded }) {
  const now = youTubeEmbed(current?.watch) ? current : null;
  if (!chosen) return now;
  if (now?.id === chosen.id) return now;
  return !updatesLoaded && youTubeEmbed(chosen.watch) ? chosen : null;
}

// What is being watched on the watch page. Both kinds are part of the route,
// so Back (the browser's, or Android's) closes them: a station video by its
// id (#/videos/video/id), the live video as #/listen/live (see liveToShow;
// the choice is let go when the route closes).
// iOS opens YouTube in the browser view, since YouTube refuses embeds
// without a web referrer, which the iOS app (capacitor://localhost) can't
// send; any other link opens as a web page. Either way, and on the watch
// page, the radio (or an episode) pauses, and is offered back afterwards.
export function useWatching(
  { videoId, live: liveRoute, openVideo, openLive, closeVideo },
  currentLive = null,
  updatesLoaded = true,
) {
  const [chosen, setChosen] = useState(null);
  // Leaving the live route lets the choice go, so a later visit shows what
  // is live then. (Adjusted during render: React's pattern for state that
  // follows a prop.)
  const [onLiveRoute, setOnLiveRoute] = useState(liveRoute);
  if (onLiveRoute !== liveRoute) {
    setOnLiveRoute(liveRoute);
    if (!liveRoute) setChosen(null);
  }
  const watchLive = (update) => {
    track("video_play", { video_id: update.id || "live" });
    if (Capacitor.getPlatform() === "ios" || !youTubeEmbed(update.watch)) {
      pauseForVideo();
      openPage(update.watch, { onClose: offerAudioBack });
      return;
    }
    // Chosen first, in its own render, so the route's render finds it.
    flushSync(() => setChosen(update));
    openLive();
  };
  // A station video, from a list or from the watch page's Up next (in place
  // of whatever was showing).
  const watchVideo = (video) => {
    track("video_play", { video_id: video.id });
    openVideo(video.id);
  };

  const live = liveRoute ? liveToShow({ chosen, current: currentLive, updatesLoaded }) : null;
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
  };
}
