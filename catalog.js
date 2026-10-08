import suppliedShows from "./shows.json" with { type: "json" };
import { publicAsset } from "./assets.js";
import { onAir, nextAiring, scheduleLines, slotMinutes, toHHMM } from "./schedule.js";
import { easternParts, easternToEpoch, localClock, localWhen, shiftDate } from "./time.js";

// Local show art lives in public/shows; everything else is a full URL.
export const SHOWS = Object.fromEntries(
  Object.entries(suppliedShows).map(([id, show]) => [
    id,
    {
      ...show,
      img: show.img.startsWith("shows/") ? publicAsset(show.img) : show.img,
      // When it airs, generated from the schedule so every show reads the
      // same way ("Weekdays, 2–4pm"). Shows without one keep their own text.
      times: show.schedule?.length ? scheduleLines(show) : show.time ? [show.time] : [],
    },
  ]),
);

// A show's name without the station prefix, for tight spaces such as cards.
export const shortName = (show) => show.name.replace(/^WXPN /, "");

// The station playlist names a show between bars in place of an artist
// ("|World Cafe|") for its own segments, such as a World Cafe session hour.
// The name inside, and the show it is, when it is one of the station's.
const BY_NAME = new Map(
  Object.values(SHOWS).flatMap((show) => [
    [show.name.toLowerCase(), show],
    [shortName(show).toLowerCase(), show],
  ]),
);
export function showSegment(artist) {
  const inside = /^\|\s*(.+?)\s*\|$/.exec(String(artist || "").trim())?.[1];
  return inside ? { name: inside, show: BY_NAME.get(inside.toLowerCase()) || null } : null;
}

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

// When a show next starts: { startsAt, start, end, label } with a label such
// as "Today at 2pm" or "Friday at 10am" in the listener's time. Null for
// shows with no schedule.
export function nextAiringOf(show, date = new Date()) {
  const parts = easternParts(date);
  const next = nextAiring(show, parts);
  if (!next) return null;
  const startsAt = easternToEpoch(shiftDate(parts.date, next.daysAhead), next.start);
  return {
    startsAt,
    start: next.start,
    end: next.end,
    // A start inside the hour skipped when clocks spring forward (no
    // startsAt): keep the station's own wording.
    label: startsAt === null ? next.label : localWhen(startsAt, date.valueOf()),
  };
}

// A show's airing that is on now or starts within `leadMinutes`, as epochs
// { starts, ends }; otherwise null. Used to look for the week's Free at Noon
// video only around the broadcast.
export function airingSoon(showId, leadMinutes, date = new Date()) {
  const current = onAirAt(date);
  if (current?.show.id === showId) {
    return { starts: current.endsAt - (current.end - current.start) * 60000, ends: current.endsAt };
  }
  const show = SHOWS[showId];
  const next = show && nextAiringOf(show, date);
  if (!next?.startsAt || next.startsAt - date.valueOf() > leadMinutes * 60000) return null;
  return { starts: next.startsAt, ends: next.startsAt + slotMinutes(next) * 60000 };
}
