import suppliedShows from "./shows.json" with { type: "json" };
import { publicAsset } from "./assets.js";
import { onAir, nextAiring, scheduleLines } from "./schedule.js";
import { easternParts, easternToEpoch, localClock, localWhen, shiftDate } from "./time.js";
import { SHOW_SAMPLES } from "./config.js";
import { SHOW_PAGES } from "./links.js";

// Sample episodes, in dev and preview builds only.
const SAMPLE_EPISODES = SHOW_SAMPLES ? (await import("./samples.js")).SAMPLE_EPISODES : {};

// Local show art lives in public/shows; everything else is a full URL.
export const SHOWS = Object.fromEntries(
  Object.entries(suppliedShows).map(([id, show]) => [
    id,
    {
      ...show,
      img: show.img.startsWith("shows/") ? publicAsset(show.img) : show.img,
      // When it airs, generated from the schedule so every show reads the
      // same way ("Weekdays, 2–4pm"). Shows without one keep their own text.
      times: show.schedule?.length ? scheduleLines(show) : [show.time],
      episodes: SAMPLE_EPISODES[id] || [],
    },
  ]),
);

// A show's name without the station prefix, for tight spaces such as cards.
export const shortName = (show) => show.name.replace(/^WXPN /, "");

// Featured shows lead the directory; the rest follow in data order.
const FEATURED = ["worldcafe", "morning", "funky", "freeatnoon", "middays", "afternoons"];
export const SHOW_DIRECTORY = [
  ...FEATURED.map((id) => SHOWS[id]).filter(Boolean),
  ...Object.values(SHOWS).filter((show) => !FEATURED.includes(show.id)),
];

export function scheduleForDay(day) {
  return Object.values(SHOWS)
    .flatMap((show) =>
      (show.schedule || [])
        .filter((slot) => slot.days.includes(day))
        .map((slot) => ({ ...slot, show })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

// The show's own page on xpn.org (from shows.json), or null when it has none.
export const showUrl = (show) => show.page || SHOW_PAGES[show.id] || null;

// Which live stream a show airs on: every show in the guide is on 88.5 FM.
export const showStream = () => "xpn";

const toHHMM = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// The FM schedule, evaluated at a moment (defaults to now). Adds `endsAt`,
// the real moment the show ends, for timers and for labels in local time.
export function onAirAt(date = new Date()) {
  const parts = easternParts(date);
  const found = onAir(SHOWS, parts);
  if (!found) return null;
  const endDate = shiftDate(parts.date, Math.floor(found.end / 1440));
  const endsAt =
    easternToEpoch(endDate, toHHMM(found.end)) ?? date.valueOf() + found.minutesLeft * 60000;
  return { ...found, endsAt };
}

// "until 4pm", in the listener's own time.
export const untilLabel = (onAirNow) => `until ${localClock(onAirNow.endsAt)}`;

// When a show next starts: { startsAt, label } with a label such as
// "Today at 2pm" or "Friday at 10am" in the listener's time. Null for shows
// with no schedule.
export function nextAiringOf(show, date = new Date()) {
  const parts = easternParts(date);
  const next = nextAiring(show, parts);
  if (!next) return null;
  const startsAt = easternToEpoch(shiftDate(parts.date, next.daysAhead), next.start);
  // A start inside the hour skipped when clocks spring forward: keep the
  // station's own wording.
  if (startsAt === null) return { startsAt, start: next.start, label: next.label };
  return { startsAt, start: next.start, label: localWhen(startsAt, date.valueOf()) };
}

// A show's airing that is on now or starts within `leadMinutes`, as epochs
// { starts, ends }; otherwise null. Used to look for the week's Free at Noon
// video only around the broadcast.
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export function airingSoon(showId, leadMinutes, date = new Date()) {
  const current = onAirAt(date);
  if (current?.show.id === showId) {
    return { starts: current.endsAt - (current.end - current.start) * 60000, ends: current.endsAt };
  }
  const show = SHOWS[showId];
  const next = show && nextAiringOf(show, date);
  if (!next?.startsAt || next.startsAt - date.valueOf() > leadMinutes * 60000) return null;
  const slot = show.schedule.find((s) => s.start === next.start) || show.schedule[0];
  const length = (minutesOf(slot.end) - minutesOf(slot.start) + 1440) % 1440 || 1440;
  return { starts: next.startsAt, ends: next.startsAt + length * 60000 };
}
