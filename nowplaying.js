import { useEffect, useState } from "react";
import { getPlayerSnapshot } from "./player.js";
import { STREAMS } from "./streams.js";
import { useNow } from "./hooks/useNow.js";
import { decodeEntities } from "./text.js";
import { withTimeout } from "./net.js";
import { showSegment } from "./catalog.js";
import {
  clockLabel,
  easternParts,
  easternToEpoch,
  localClock,
  reportedMinutes,
  shiftDate,
} from "./time.js";

// The station publishes one file per Eastern calendar day. Just after
// midnight ET that file is nearly empty, so the previous day is merged in
// until the new day has built up its own history.
const EARLY_HOUR = 5;
const reportedKey = (track) => `${track.date} ${track.time} ${track.title} ${track.artist}`;
const newestFirst = (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
export function mergeTracks(lists) {
  const seen = new Set();
  return lists
    .flat()
    .filter((track) => {
      const key = reportedKey(track);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(newestFirst);
}
// A song is presented as playing until it should have ended, plus a little
// slack, when the station says how long it runs (so a 20-minute jam stays
// "now playing" to the end, and a 3-minute song isn't still "playing" ten
// minutes later through the host's talk); otherwise for this long.
const FRESH_MINUTES = 15;
const SLACK_MINUTES = 3;

// Minutes since a song was reported, compared in absolute minutes so a song
// reported at 23:58 is 3 minutes old at 00:01. Null when unknown.
function reportAge(track, now) {
  const { date, time } = easternParts(now);
  const age = reportedMinutes(date, time) - reportedMinutes(track.date, track.time);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

// Is the reported song plausibly still on air?
export function isFresh(track, now = new Date()) {
  if (!track) return false;
  const age = reportAge(track, now);
  const window = track.minutes > 0 ? track.minutes + SLACK_MINUTES : FRESH_MINUTES;
  return age !== null && age < window;
}

// "04:22" -> 5 (whole minutes, rounded up). Null when missing or odd.
export function durationMinutes(text) {
  const m = /^(?:(\d+):)?(\d{1,3}):(\d{2})$/.exec(String(text || "").trim());
  if (!m) return null;
  const total = Number(m[1] || 0) * 60 + Number(m[2]) + Number(m[3]) / 60;
  return total > 0 && total < 24 * 60 ? Math.ceil(total) : null;
}

// An artist as the app shows it: a show's segment by the show's name, without
// the bars the playlist puts around it. A segment of one of the station's
// shows also carries the show's id.
const artistOf = (raw) => {
  const plain = decodeEntities(raw).trim();
  const segment = showSegment(plain);
  if (!segment) return { artist: plain };
  return {
    artist: segment.show?.name || segment.name,
    ...(segment.show ? { show: segment.show.id } : {}),
  };
};

const sameSong = (a, b) =>
  a.artist.trim().toLowerCase() === artistOf(b.artist).artist.toLowerCase() &&
  a.title.trim().toLowerCase() === decodeEntities(b.song).trim().toLowerCase();

// Adds what the now-playing file knows to the latest playlist entry when they
// are the same song: its length, and its artwork if the playlist has none yet.
export function withNowPlaying(tracks, nowFile) {
  const now = Array.isArray(nowFile) ? nowFile[0] : null;
  const latest = tracks[0];
  if (!now || !latest || !sameSong(latest, now)) return tracks;
  const minutes = durationMinutes(now.duration);
  const img = latest.img || (/^https:\/\//.test(now.image || "") ? now.image : "");
  return [{ ...latest, ...(minutes ? { minutes } : {}), img }, ...tracks.slice(1)];
}

// When a song played, in the listener's time: "2:32pm".
export function playedAt(track, timeZone) {
  const at = track?.date && track?.time ? easternToEpoch(track.date, track.time) : null;
  return at === null ? (track?.time ? clockLabel(track.time) : "") : localClock(at, timeZone);
}

// "Played just now", "Played 3 min ago" for the last hour, then the time.
export function playedLabel(track, now = new Date(), timeZone) {
  if (!track?.time) return "";
  const age = reportAge(track, now);
  if (age !== null && age < 60) return age < 1 ? "Played just now" : `Played ${age} min ago`;
  return `Played at ${playedAt(track, timeZone)}`;
}

// The song on air now, or null once the latest report has gone stale (the
// feed has paused overnight, or failed and kept its last list). Stale songs
// stay in Recently played but are never shown as current.
export function useLiveSong(playlist) {
  const now = useNow();
  const latest = playlist.tracks[0];
  return latest && isFresh(latest, new Date(now)) ? latest : null;
}

export function normalizePlaylist(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (t) =>
        t &&
        typeof t.artist === "string" &&
        typeof t.song === "string" &&
        t.artist.trim() &&
        t.song.trim(),
    )
    .map((t) => ({
      title: decodeEntities(t.song).trim(),
      // A show's own segment carries the show, so its heart takes the show's
      // color (the segment's photo is often black and white).
      ...artistOf(t.artist),
      album: decodeEntities(t.album).trim(),
      img: /^https?:\/\//.test(t.image || "") ? t.image : "",
      time: String(t.timeslice || "").slice(11, 16),
      date: String(t.timeslice || "").slice(0, 10),
    }))
    .sort(newestFirst);
}
const LOADING = { tracks: [], status: "loading" };
const UNAVAILABLE = { tracks: [], status: "unavailable" };
const trackKey = (t) => `${reportedKey(t)} ${t.minutes || ""} ${t.img}`;
const sameTracks = (a, b) =>
  a.length === b.length && a.every((track, i) => trackKey(track) === trackKey(b[i]));

// One read of a station's playlist: today's file (and yesterday's in the
// small hours, when the overnight songs are in it), plus the now-playing file
// for the current song's length. Only today's file is required.
async function readPlaylist(endpoint, signal) {
  const loadDay = async (date) => {
    const response = await fetch(`${endpoint.day}${date}.json`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Playlist unavailable");
    return normalizePlaylist(await response.json());
  };
  const loadNow = async () => {
    try {
      const response = await fetch(endpoint.now, { signal, cache: "no-store" });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };
  const now = easternParts();
  const early = Number(now.time.slice(0, 2)) < EARLY_HOUR;
  const [nowFile, ...lists] = await Promise.all([
    loadNow(),
    loadDay(now.date),
    ...(early ? [loadDay(shiftDate(now.date, -1)).catch(() => [])] : []),
  ]);
  return { nowFile, tracks: mergeTracks(lists).slice(0, 80) };
}

// The playlist for one station, polled every 30 seconds while the app is
// visible. Results are kept per station, so switching back to a station
// shows its list at once while it refreshes.
export function useNowPlaying(streamId) {
  const [byStream, setByStream] = useState({});
  useEffect(() => {
    const endpoint = STREAMS[streamId]?.songFeed;
    if (!endpoint) return;
    let active = true;
    // The last now-playing file that loaded, so one failed fetch does not
    // drop the current song's length (it only applies to the same song).
    let lastNow = null;
    let controller;
    const store = (next) =>
      setByStream((prev) => {
        const old = prev[streamId];
        // An unchanged poll keeps the old object, so nothing re-renders.
        if (old && old.status === next.status && sameTracks(old.tracks, next.tracks)) return prev;
        return { ...prev, [streamId]: next };
      });
    // Keep the last good list on screen; the status line explains. A
    // superseded or unmounted request (AbortError) is not a station failure;
    // a timeout (TimeoutError) is.
    const failed = (error) => {
      if (!active || error?.name === "AbortError") return;
      setByStream((prev) =>
        prev[streamId]?.status === "unavailable"
          ? prev
          : {
              ...prev,
              [streamId]: { tracks: prev[streamId]?.tracks || [], status: "unavailable" },
            },
      );
    };
    async function update() {
      // While hidden, keep polling only if audio is playing: the lock screen
      // and media notification still show the song.
      if (document.visibilityState === "hidden" && !getPlayerSnapshot().playing) return;
      controller?.abort();
      controller = new AbortController();
      let result;
      try {
        result = await readPlaylist(endpoint, withTimeout(controller.signal));
      } catch (error) {
        failed(error);
        return;
      }
      if (result.nowFile) lastNow = result.nowFile;
      const tracks = withNowPlaying(result.tracks, result.nowFile || lastNow);
      if (active) store({ tracks, status: tracks.length ? "ready" : "empty" });
    }
    update();
    const timer = setInterval(update, 30000);
    const listening = new AbortController();
    document.addEventListener("visibilitychange", update, { signal: listening.signal });
    window.addEventListener("wxpn:refresh-playlist", update, { signal: listening.signal });
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      listening.abort();
    };
  }, [streamId]);
  if (!STREAMS[streamId]?.songFeed) return UNAVAILABLE; // Homegrown has no song feed
  return byStream[streamId] || LOADING;
}
