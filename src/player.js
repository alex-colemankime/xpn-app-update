// player.js — real audio for the WXPN app.
//
// One shared <audio> element does the actual playback on every platform
// (plain HTTPS MP3/AAC from StreamGuys — no HLS library needed).
//
// Media session handling goes through @capgo/capacitor-media-session,
// which gives one code path everywhere:
//   - iOS (Capacitor): lock screen / control center controls + metadata
//   - Android (Capacitor): media notification with controls, PLUS a
//     foreground service so Android doesn't kill audio when the app
//     is backgrounded — this is the part a bare WebView can't do
//   - Web/PWA: thin wrapper over the standard Media Session API
//
// iOS background audio additionally needs two native-side settings,
// already applied in the ios/ project (see README):
//   1. UIBackgroundModes: audio in Info.plist
//   2. AVAudioSession category .playback in AppDelegate

import { MediaSession } from '@capgo/capacitor-media-session';

export const STREAMS = {
  xpn: {
    id: 'xpn',
    label: 'WXPN',
    // Public hi-bitrate stream. Confirm internally whether the app
    // should use the -nopreroll variant or the standard mount.
    url: 'https://wxpnhi.xpn.org/xpnhi-nopreroll',
  },
  xpn2: {
    id: 'xpn2',
    label: 'XPN2',
    // TODO: drop in the XPN2 mount URL (check the StreamGuys dashboard).
    url: '',
  },
};

const ARTWORK = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
];

let audio = null;
let currentStream = STREAMS.xpn;
let onPlayingChange = () => {};

export function initPlayer(setPlaying) {
  onPlayingChange = setPlaying;
  if (audio) return audio;

  audio = new Audio();
  audio.preload = 'none'; // don't buffer a live stream until play is tapped

  // Keep React state honest if playback is interrupted (network drop,
  // a phone call, another app taking the audio session, etc.)
  audio.addEventListener('pause', () => {
    onPlayingChange(false);
    MediaSession.setPlaybackState({ playbackState: 'paused' });
  });
  audio.addEventListener('play', () => {
    onPlayingChange(true);
    MediaSession.setPlaybackState({ playbackState: 'playing' });
  });
  // A live stream that errors or runs dry should flip the UI back to
  // paused — otherwise the app shows "playing" over dead air. (Ignore
  // the error fired by intentional source detach in pauseStream.)
  audio.addEventListener('error', () => {
    if (audio.getAttribute('src')) onPlayingChange(false);
  });
  audio.addEventListener('ended', () => onPlayingChange(false));

  // Lock screen / notification / headset buttons drive the same state
  // as the on-screen play button.
  MediaSession.setActionHandler({ action: 'play' }, () => onPlayingChange(true));
  MediaSession.setActionHandler({ action: 'pause' }, () => onPlayingChange(false));
  MediaSession.setActionHandler({ action: 'stop' }, () => onPlayingChange(false));

  setMetadata();
  return audio;
}

export function playStream() {
  if (!audio) return;
  // For a live stream, re-attach the source on every play so listeners
  // rejoin "now" instead of resuming a stale buffer.
  audio.src = currentStream.url;
  audio.play().catch(() => onPlayingChange(false));
  setMetadata();
}

export function pauseStream() {
  if (!audio) return;
  audio.pause();
  // Detach the source so the stream stops buffering in the background
  // (saves listener data on mobile).
  audio.removeAttribute('src');
  audio.load();
}

export function setStream(id) {
  const next = STREAMS[id];
  if (!next || !next.url || next.id === currentStream.id) return;
  const wasPlaying = audio && !audio.paused;
  currentStream = next;
  if (wasPlaying) playStream();
  else setMetadata();
}

// Hook point for live "now playing" data. Poll the playlist feed and
// call this with {title, artist, album} — the lock screen and the
// Android notification will show the current song.
export function setMetadata(track) {
  MediaSession.setMetadata({
    title: track?.title || currentStream.label,
    artist: track?.artist || '88.5 WXPN Philadelphia',
    album: track?.album || '',
    artwork: ARTWORK,
  });
}
