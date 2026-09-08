import { useEffect, useState } from "react";
import { easternParts } from "./catalog.js";
const ENDPOINTS = {
  xpn: "https://origin.xpn.org/utils/playlist/json/",
  xpn2: "https://origin.xpn.org/xpn2/json/",
};
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
    async function update() {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${endpoint}${easternParts().date}.json`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error("Playlist unavailable");
        const tracks = normalizePlaylist(await response.json()).slice(0, 80);
        if (active) setResult({ streamId, tracks, status: tracks.length ? "ready" : "empty" });
      } catch (error) {
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
