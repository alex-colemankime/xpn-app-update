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
  localClock,
  reportedAt,
  reportedMoments,
  shiftDate,
} from "./time.js";

// The station publishes one file per Eastern calendar day. Just after
// midnight ET that file is nearly empty, so the previous day is merged in
// until the new day has built up its own history.
const EARLY_HOUR = 5;
const reportedKey = (track) => `${track.date} ${track.time} ${track.title} ${track.artist}`;
// When a song really played (epoch ms): the moment worked out from its
// file's order when it was read (`at`, time.js reportedMoments), else from
// its date and time alone (a saved song). Null when unknown.
const momentOf = (t, now = Date.now()) =>
  Number.isFinite(t?.at) ? t.at : t?.date && t?.time ? reportedAt(t.date, t.time, now) : null;

// Songs newest first by when they really played, so the hour repeated when
// clocks fall back sorts in the order it happened.
function newestFirst(tracks, now = Date.now()) {
  const at = new Map(tracks.map((t) => [t, momentOf(t, now) ?? 0]));
  return tracks.sort((a, b) => at.get(b) - at.get(a));
}
export function mergeTracks(lists, now = Date.now()) {
  const seen = new Set();
  return newestFirst(
    lists.flat().filter((track) => {
      const key = reportedKey(track);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    now,
  );
}
// A song is presented as playing until it should have ended, plus a little
// slack, when the station says how long it runs (so a 20-minute jam stays
// "now playing" to the end, and a 3-minute song isn't still "playing" ten
// minutes later through the host's talk); otherwise for this long.
const FRESH_MINUTES = 15;
const SLACK_MINUTES = 3;

// Whole minutes since a song was reported, in real time (so 23:58 is three
// minutes before 00:01, and the repeated hour in the fall counts once). A
// report a minute or two ahead of this clock is new; one further ahead is
// unknown. Null when unknown.
function reportAge(track, now) {
  const at = momentOf(track, now.getTime());
  const ms = at === null ? NaN : now.getTime() - at;
  return ms >= -2 * 60000 ? Math.max(0, Math.floor(ms / 60000)) : null;
}

// Is the reported song plausibly still on air?
export function isFresh(track, now = new Date()) {
  if (!track) return false;
  const age = reportAge(track, now);
  const freshFor = track.minutes > 0 ? track.minutes + SLACK_MINUTES : FRESH_MINUTES;
  return age !== null && age < freshFor;
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
  const at = momentOf(track);
  return at === null ? (track?.time ? clockLabel(track.time) : "") : localClock(at, timeZone);
}

// The song on air now, or null once the latest report has gone stale (the
// feed has paused overnight, or failed and kept its last list). Stale songs
// stay in Recently played but are never shown as current.
export function useLiveSong(playlist) {
  const now = useNow();
  const latest = playlist.tracks[0];
  return latest && isFresh(latest, new Date(now)) ? latest : null;
}

export function normalizePlaylist(data, now = Date.now()) {
  if (!Array.isArray(data)) return [];
  const tracks = data
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
    }));
  // Each song's real moment, placed by the file's own order (the repeated
  // hour in the fall needs it).
  const moments = reportedMoments(tracks, now);
  tracks.forEach((t, i) => {
    if (moments[i] !== null) t.at = moments[i];
  });
  return newestFirst(tracks, now);
}
const LOADING = { tracks: [], status: "loading" };
const UNAVAILABLE = { tracks: [], status: "unavailable" };
const trackKey = (t) => `${reportedKey(t)} ${t.at || ""} ${t.minutes || ""} ${t.img}`;
const sameTracks = (a, b) =>
  a.length === b.length && a.every((track, i) => trackKey(track) === trackKey(b[i]));

// One read of a station's playlist: today's file (and yesterday's in the
// small hours, when the overnight songs are in it), plus the now-playing file
// for the current song's length. Today's file is required, except in the
// small hours: until the station logs the new day's first song its file
// doesn't exist yet, and yesterday's carries the list meanwhile.
export async function readPlaylist(endpoint, signal, date = new Date()) {
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
  const now = easternParts(date);
  const early = Number(now.time.slice(0, 2)) < EARLY_HOUR;
  const [nowFile, today, yesterday] = await Promise.all([
    loadNow(),
    early ? loadDay(now.date).catch(() => null) : loadDay(now.date),
    early ? loadDay(shiftDate(now.date, -1)).catch(() => null) : [],
  ]);
  if (!today && !yesterday) throw new Error("Playlist unavailable");
  return { nowFile, tracks: mergeTracks([today || [], yesterday || []]).slice(0, 80) };
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
    // Keep the last good list on screen; the status line explains. A request
    // the app called off (superseded, or the screen gone) is not a station
    // failure; a timeout is. Judged by the app's own controller, not the
    // error's name: some Safari versions report a timeout as AbortError.
    const failed = (cancelled) => {
      if (!active || cancelled) return;
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
      const mine = (controller = new AbortController());
      let result;
      try {
        result = await readPlaylist(endpoint, withTimeout(mine.signal));
      } catch {
        failed(mine.signal.aborted);
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
    // A refresh asked for by the listener (refreshPlaylist) waits on this read.
    // Pressing play asks too, without waiting on it.
    const asked = (e) => {
      const read = update();
      e.detail?.push?.(read);
    };
    window.addEventListener("wxpn:refresh-playlist", asked, { signal: listening.signal });
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

// Reads the song list again now (a pull down on Listen), settling when the
// read has.
export function refreshPlaylist() {
  const reads = [];
  window.dispatchEvent(new CustomEvent("wxpn:refresh-playlist", { detail: reads }));
  return Promise.all(reads);
}
