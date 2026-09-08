import { useEffect, useState } from "react";
import { easternParts } from "./catalog.js";
const ENDPOINTS = {
  xpn: "https://origin.xpn.org/utils/playlist/json/",
  xpn2: "https://origin.xpn.org/xpn2/json/",
};
// The station publishes one file per Eastern calendar day. Just after
// midnight ET that file is nearly empty, so the previous day is merged in
// until the new day has built up its own history.
const EARLY_HOUR = 5;
export function previousDate(date) {
  const stamp = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(stamp.valueOf())) return date;
  stamp.setUTCDate(stamp.getUTCDate() - 1);
  return stamp.toISOString().slice(0, 10);
}
const reportedKey = (track) => `${track.date} ${track.time} ${track.title} ${track.artist}`;
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
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
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
      title: t.song,
      artist: t.artist,
      album: t.album || "",
      img: /^https?:\/\//.test(t.image || "") ? t.image : "",
      time: String(t.timeslice || "").slice(11, 16),
      date: String(t.timeslice || "").slice(0, 10),
    }))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}
export function useNowPlaying(streamId) {
  const [result, setResult] = useState({ streamId, tracks: [], status: "loading" });
  useEffect(() => {
    let active = true;
    let controller;
    const endpoint = ENDPOINTS[streamId];
    setResult({ streamId, tracks: [], status: endpoint ? "loading" : "unavailable" });
    if (!endpoint) return;
    async function loadDay(date, signal) {
      const response = await fetch(`${endpoint}${date}.json`, { signal, cache: "no-store" });
      if (!response.ok) throw Error("Playlist unavailable");
      return normalizePlaylist(await response.json());
    }
    async function update() {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      // A timeout is a real failure; a superseding request is not. Both
      // surface as AbortError, so they are told apart here.
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 10000);
      try {
        const now = easternParts();
        const days = [now.date];
        if (Number(now.time.slice(0, 2)) < EARLY_HOUR) days.push(previousDate(now.date));
        const lists = await Promise.all(
          days.map((date, index) =>
            // Only today's file is required; yesterday's is a courtesy.
            index === 0 ? loadDay(date, signal) : loadDay(date, signal).catch(() => []),
          ),
        );
        const tracks = mergeTracks(lists).slice(0, 80);
        if (active) setResult({ streamId, tracks, status: tracks.length ? "ready" : "empty" });
      } catch (error) {
        // A superseded or unmounted request is not a station failure.
        if (error?.name === "AbortError" && !timedOut) return;
        if (active)
          setResult((prev) => ({
            streamId,
            tracks: prev.streamId === streamId ? prev.tracks : [],
            status: "unavailable",
          }));
      } finally {
        clearTimeout(timeout);
      }
    }
    update();
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("wxpn:refresh-playlist", update);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("wxpn:refresh-playlist", update);
    };
  }, [streamId]);
  return result.streamId === streamId ? result : { streamId, tracks: [], status: "loading" };
}
