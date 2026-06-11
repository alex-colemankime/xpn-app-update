// concerts.js — the concert calendar data layer.
//
// Built to consume the live feed behind xpn.org/concert-and-events/ once
// the endpoint is confirmed. That page is client-rendered, so the rows
// come from an API already — the app just needs the same URL. To find it:
// open the calendar page, DevTools → Network → Fetch/XHR, reload, and the
// request that returns the event rows is the one to drop in below.
// (Inside the Capacitor app there's no CORS wall, so the feed works even
// if it doesn't send CORS headers. For the web/PWA build it would need
// permissive headers or a proxy.)
//
// Until then, fetchConcerts() falls back to SAMPLE_CONCERTS so the UI is
// fully functional for design review.

import { useState } from "react";

// TODO: real feed URL, e.g. something like
// https://backend.xpn.org/wp-json/<namespace>/events?...
const CONCERTS_ENDPOINT = "";

/* Each concert normalizes to:
   {
     id:          stable string (used for saving hearts)
     date:        ISO "2026-06-18"
     day:         "THU"
     artist:      "Waxahatchee"
     venue:       "Union Transfer"
     region:      "Philadelphia" | "Suburbs" | "Central PA" | "Lehigh Valley" | "New Jersey"
     age:         "All Ages" | "21+" | "18+" | ""
     xpnWelcomes: boolean
     ticketUrl:   external link or ""
   }
*/

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Best-guess mapper for a WP REST event object. Adjust the field paths
// once the real feed shape is known — everything else keeps working.
function normalizeWpEvent(e) {
  const d = new Date(e.start_date || e.date || e.event_date);
  return {
    id: String(e.id ?? `${e.title}-${e.start_date}`),
    date: isNaN(d) ? "" : d.toISOString().slice(0, 10),
    day: isNaN(d) ? "" : DAYS[d.getDay()],
    artist: (e.title?.rendered || e.title || "").replace(/&amp;/g, "&"),
    venue: e.venue?.venue || e.venue || "",
    region: e.region || "",
    age: e.age || "",
    xpnWelcomes: !!(e.xpn_welcomes ?? e.categories?.includes?.("WXPN Welcomes")),
    ticketUrl: e.website || e.url || e.ticket_url || "",
  };
}

export async function fetchConcerts() {
  if (CONCERTS_ENDPOINT) {
    try {
      const res = await fetch(CONCERTS_ENDPOINT);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.events || data.items || [];
        const normalized = list.map(normalizeWpEvent).filter(c => c.date);
        if (normalized.length) return normalized;
      }
    } catch {
      // fall through to samples — never show an empty screen over a network blip
    }
  }
  return SAMPLE_CONCERTS;
}

/* ── Saved concerts (hearts) ──
   Persisted to device storage so they survive app restarts. Same
   pattern will work for favorite songs/shows when those go live. */

const STORAGE_KEY = "xpn.savedConcerts";

function loadSaved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set(); // private mode / storage unavailable — hearts just don't persist
  }
}

function persistSaved(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* non-fatal */ }
}

export function useSavedConcerts() {
  const [saved, setSaved] = useState(loadSaved);
  const toggleSaved = (id) => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistSaved(next);
      return next;
    });
  };
  return [saved, toggleSaved];
}

/* ── Sample data ──
   Placeholder listings for design review, shaped exactly like the real
   calendar (real Philly-area venues, plausible routing). Replaced
   wholesale by the live feed once CONCERTS_ENDPOINT is set. */

export const SAMPLE_CONCERTS = [
  { id: "c1", date: "2026-06-12", day: "FRI", artist: "Waxahatchee", venue: "The Fillmore", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c2", date: "2026-06-13", day: "SAT", artist: "Hurray for the Riff Raff", venue: "Union Transfer", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c3", date: "2026-06-13", day: "SAT", artist: "The Districts", venue: "Ardmore Music Hall", region: "Suburbs", age: "21+", xpnWelcomes: false, ticketUrl: "" },
  { id: "c4", date: "2026-06-17", day: "WED", artist: "Japanese Breakfast", venue: "The Met Philadelphia", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c5", date: "2026-06-19", day: "FRI", artist: "Free At Noon: Gigi Perez", venue: "World Cafe Live", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c6", date: "2026-06-20", day: "SAT", artist: "Kim Deal", venue: "Franklin Music Hall", region: "Philadelphia", age: "All Ages", xpnWelcomes: false, ticketUrl: "" },
  { id: "c7", date: "2026-06-21", day: "SUN", artist: "Dr. Dog", venue: "Levitt Pavilion SteelStacks", region: "Lehigh Valley", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c8", date: "2026-06-25", day: "THU", artist: "Fontaines D.C.", venue: "The Mann Center", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c9", date: "2026-06-26", day: "FRI", artist: "Soccer Mommy", venue: "Johnny Brenda's", region: "Philadelphia", age: "21+", xpnWelcomes: false, ticketUrl: "" },
  { id: "c10", date: "2026-06-27", day: "SAT", artist: "Lake Street Dive", venue: "Hershey Theatre", region: "Central PA", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c11", date: "2026-07-02", day: "THU", artist: "The War on Drugs", venue: "Skyline Stage at the Mann", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c12", date: "2026-07-08", day: "WED", artist: "Adrianne Lenker", venue: "Keswick Theatre", region: "Suburbs", age: "All Ages", xpnWelcomes: false, ticketUrl: "" },
  { id: "c13", date: "2026-07-10", day: "FRI", artist: "Sierra Ferrell", venue: "ArtsQuest Musikfest Café", region: "Lehigh Valley", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
  { id: "c14", date: "2026-07-17", day: "FRI", artist: "MJ Lenderman", venue: "Union Transfer", region: "Philadelphia", age: "All Ages", xpnWelcomes: true, ticketUrl: "" },
];

// "June 2026" style group label from an ISO date
export function monthLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
