import suppliedShows from "./shows.json";
import { publicAsset } from "./data.js";
export const SHOWS = Object.fromEntries(
  Object.entries(suppliedShows).map(([id, show]) => [
    id,
    { ...show, img: show.img.startsWith("shows/") ? publicAsset(show.img) : show.img },
  ]),
);
// Weekday corrections verified against https://xpn.org/program_guide/ on September 7, 2026.
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday"];
SHOWS.afternoons.schedule = [
  { days: weekdays, start: "16:00", end: "18:00" },
  { days: weekdays, start: "19:00", end: "20:00" },
];
SHOWS.afternoons.time = "Mon–Thu · 4–6pm & 7–8pm";
SHOWS.middays.schedule = [
  { days: weekdays, start: "10:00", end: "14:00" },
  { days: ["Friday"], start: "10:00", end: "12:00" },
  { days: ["Friday"], start: "13:00", end: "14:00" },
];
SHOWS.funky.time = "Fridays · 4–7pm";
SHOWS.overnight.schedule = [
  { days: ["Monday"], start: "00:00", end: "05:00" },
  { days: ["Tuesday", "Wednesday", "Thursday", "Friday"], start: "02:00", end: "05:00" },
  { days: ["Saturday"], start: "02:00", end: "06:00" },
];
// Kids Corner is available as its own continuous stream; the current weekday FM guide places Afternoons in its former slot.
SHOWS.kidscorner.schedule = [];
SHOWS.kidscorner.time = "Listen anytime on the Kids Corner stream";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    day: obj.weekday,
    date: `${obj.year}-${obj.month}-${obj.day}`,
    time: `${obj.hour}:${obj.minute}`,
  };
}
export function clockLabel(time) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
}
export function scheduleForDay(day) {
  return Object.values(SHOWS)
    .flatMap((show) =>
      (show.schedule || [])
        .filter((slot) => slot.days.includes(day))
        .map((slot) => ({ ...slot, show })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function showUrl(show) {
  return show.id === "freeatnoon"
    ? "https://xpn.org/free-at-noon/"
    : show.id === "worldcafe"
      ? "https://xpn.org/program/world-cafe/"
      : "https://xpn.org/program_guide/";
}
