import { useCallback, useMemo } from "react";
import { createLocalStore, useLocalStore } from "./storage.js";

const CONCERTS_ENDPOINT = import.meta.env?.VITE_XPN_CONCERTS_ENDPOINT || "";
export const hasConcertFeed = Boolean(CONCERTS_ENDPOINT);
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const asText = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .trim();

function normalizeWpEvent(event) {
  const rawDate = event.start_date || event.date || event.event_date || event.acf?.date;
  const date = new Date(rawDate);
  const title = typeof event.title === "object" ? event.title?.rendered : event.title;

  return {
    id: String(event.id ?? `${title}-${rawDate}`),
    date: Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10),
    day: Number.isNaN(date.valueOf()) ? "" : DAYS[date.getDay()],
    artist: asText(title),
    venue: asText(event.venue?.venue || event.venue || event.acf?.venue),
    region: asText(event.region || event.acf?.region),
    age: asText(event.age || event.acf?.age),
    xpnWelcomes: Boolean(event.xpn_welcomes ?? event.acf?.xpn_welcomes),
    ticketUrl: event.website || event.url || event.ticket_url || event.acf?.ticket_url || "",
  };
}

export async function fetchConcertResult() {
  if (!CONCERTS_ENDPOINT) return { concerts: SAMPLE_CONCERTS, source: "sample" };

  try {
    const response = await fetch(CONCERTS_ENDPOINT);
    if (!response.ok) throw new Error("Concert feed unavailable");

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.events || data.items || [];
    const normalized = list
      .map(normalizeWpEvent)
      .filter((concert) => concert.date && concert.artist);
    return { concerts: normalized, source: "live" };
  } catch {
    return { concerts: [], source: "error" };
  }
}

export async function fetchConcerts() {
  return (await fetchConcertResult()).concerts;
}

const savedConcertStore = createLocalStore("xpn.savedConcerts", [], (value) =>
  Array.isArray(value) ? value.filter(Boolean) : [],
);

export function useSavedConcerts() {
  const savedIds = useLocalStore(savedConcertStore);
  const saved = useMemo(() => new Set(savedIds), [savedIds]);

  const toggleSaved = useCallback((id) => {
    savedConcertStore.set((prev) =>
      prev.includes(id) ? prev.filter((savedId) => savedId !== id) : [...prev, id],
    );
  }, []);

  return [saved, toggleSaved];
}

export const SAMPLE_CONCERTS = [
  {
    id: "c1",
    date: "2026-06-12",
    day: "FRI",
    artist: "Waxahatchee",
    venue: "The Fillmore",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c2",
    date: "2026-06-13",
    day: "SAT",
    artist: "Hurray for the Riff Raff",
    venue: "Union Transfer",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c3",
    date: "2026-06-13",
    day: "SAT",
    artist: "The Districts",
    venue: "Ardmore Music Hall",
    region: "Suburbs",
    age: "21+",
    xpnWelcomes: false,
    ticketUrl: "",
  },
  {
    id: "c4",
    date: "2026-06-17",
    day: "WED",
    artist: "Japanese Breakfast",
    venue: "The Met Philadelphia",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c5",
    date: "2026-06-19",
    day: "FRI",
    artist: "Free At Noon: Gigi Perez",
    venue: "World Cafe Live",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c6",
    date: "2026-06-20",
    day: "SAT",
    artist: "Kim Deal",
    venue: "Franklin Music Hall",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: false,
    ticketUrl: "",
  },
  {
    id: "c7",
    date: "2026-06-21",
    day: "SUN",
    artist: "Dr. Dog",
    venue: "Levitt Pavilion SteelStacks",
    region: "Lehigh Valley",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c8",
    date: "2026-06-25",
    day: "THU",
    artist: "Fontaines D.C.",
    venue: "The Mann Center",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c9",
    date: "2026-06-26",
    day: "FRI",
    artist: "Soccer Mommy",
    venue: "Johnny Brenda's",
    region: "Philadelphia",
    age: "21+",
    xpnWelcomes: false,
    ticketUrl: "",
  },
  {
    id: "c10",
    date: "2026-06-27",
    day: "SAT",
    artist: "Lake Street Dive",
    venue: "Hershey Theatre",
    region: "Central PA",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c11",
    date: "2026-07-02",
    day: "THU",
    artist: "The War on Drugs",
    venue: "Skyline Stage at the Mann",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c12",
    date: "2026-07-08",
    day: "WED",
    artist: "Adrianne Lenker",
    venue: "Keswick Theatre",
    region: "Suburbs",
    age: "All Ages",
    xpnWelcomes: false,
    ticketUrl: "",
  },
  {
    id: "c13",
    date: "2026-07-10",
    day: "FRI",
    artist: "Sierra Ferrell",
    venue: "ArtsQuest Musikfest Cafe",
    region: "Lehigh Valley",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
  {
    id: "c14",
    date: "2026-07-17",
    day: "FRI",
    artist: "MJ Lenderman",
    venue: "Union Transfer",
    region: "Philadelphia",
    age: "All Ages",
    xpnWelcomes: true,
    ticketUrl: "",
  },
];

export function monthLabel(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
