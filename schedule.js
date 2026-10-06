// What is on the air, worked out from the weekly schedule in shows.json.
// Everything here is pure: it takes the shows and an Eastern day/time (from
// time.js easternParts) so it can be tested with fixed moments.
//
// Schedule quirks this handles rather than papers over:
//   - A slot whose end is at or before its start runs past midnight
//     ("22:00"–"00:00" ends at midnight; "23:00"–"01:00" spills into the
//     next day's first hour).
//   - Gaps: some overnight hours have no show. Nothing is reported then;
//     the app never guesses a host.
//   - Overlaps: if two slots claim the same minute, the one that started
//     most recently wins.

import { DAYS, clockLabel, shiftDate } from "./time.js";

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

// A slot's span in minutes from the start of the day it is listed on.
const span = (slot) => {
  const start = toMinutes(slot.start);
  let end = toMinutes(slot.end);
  if (end <= start) end += 24 * 60;
  return { start, end };
};

const dayIndex = (day) => DAYS.indexOf(day);
const dayAt = (index) => DAYS[(index + 7) % 7];

// Every slot, once for each day it airs, with its span in minutes.
function* slots(shows) {
  for (const show of Object.values(shows)) {
    for (const slot of show.schedule || []) {
      for (const day of slot.days) yield { show, slot, day, ...span(slot) };
    }
  }
}

// The show on the air at an Eastern { day, time }, or null.
export function onAir(shows, { day, time }) {
  const now = toMinutes(time);
  const today = dayIndex(day);
  let best = null;
  for (const s of slots(shows)) {
    const offset = s.day === day ? 0 : s.day === dayAt(today - 1) ? -24 * 60 : null;
    if (offset === null) continue;
    const start = s.start + offset;
    const end = s.end + offset;
    if (now >= start && now < end && (!best || start > best.start)) {
      best = { show: s.show, slot: s.slot, start, end, minutesLeft: end - now };
    }
  }
  return best;
}

// "until 4pm", "until midnight", "until 1am".
export function easternUntilLabel(onAirNow) {
  const end = ((onAirNow.end % 1440) + 1440) % 1440;
  if (end === 0) return "until midnight";
  const hh = String(Math.floor(end / 60)).padStart(2, "0");
  const mm = String(end % 60).padStart(2, "0");
  return `until ${clockLabel(`${hh}:${mm}`)}`;
}

const SHORT_DAYS = DAYS.map((d) => d.slice(0, 3));

// "Weekdays", "Weekends", "Daily", "Fridays", "Mon–Thu", "Wed & Thu".
function daysLabel(days) {
  const idx = days.map(dayIndex).sort((a, b) => a - b);
  const key = idx.join();
  if (key === "0,1,2,3,4,5,6") return "Daily";
  if (key === "0,1,2,3,4") return "Weekdays";
  if (key === "5,6") return "Weekends";
  if (idx.length === 1) return `${DAYS[idx[0]]}s`;
  const runs = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (runs && idx.length > 2) return `${SHORT_DAYS[idx[0]]}–${SHORT_DAYS[idx.at(-1)]}`;
  return idx.map((i) => SHORT_DAYS[i]).join(idx.length === 2 ? " & " : ", ");
}

// "2–4pm", "10am–2pm", "11pm–midnight", "noon–5pm".
function rangeLabel(start, end) {
  const a = clockLabel(start);
  const b = clockLabel(end);
  const half = (label) => label.match(/[ap]m$/)?.[0];
  return half(a) && half(a) === half(b) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}

// When a show airs, in Eastern time, as lines such as "Weekdays, 2–4pm" or
// "Fridays, 10am–noon & 1–2pm". Days with the same hours share a line.
export function scheduleLines(show) {
  const byDay = new Map();
  for (const slot of show.schedule || []) {
    for (const day of slot.days) {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(slot);
    }
  }
  const groups = new Map();
  for (const [day, daySlots] of byDay) {
    const ranges = daySlots
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((s) => rangeLabel(s.start, s.end))
      .join(" & ");
    if (!groups.has(ranges)) groups.set(ranges, []);
    groups.get(ranges).push(day);
  }
  return [...groups]
    .sort((a, b) => Math.min(...a[1].map(dayIndex)) - Math.min(...b[1].map(dayIndex)))
    .map(([ranges, days]) => `${daysLabel(days)}, ${ranges}`);
}

// When a show next starts after an Eastern { day, time }:
// { daysAhead, start, label } such as "Today at 4pm" or "Friday at 10am".
// Null for shows with no schedule (they air on their own stream).
export function nextAiring(show, { day, time }) {
  const now = toMinutes(time);
  const today = dayIndex(day);
  let best = null;
  for (const slot of show.schedule || []) {
    const { start } = span(slot);
    for (const d of slot.days) {
      let ahead = (dayIndex(d) - today + 7) % 7;
      if (ahead === 0 && start <= now) ahead = 7; // today's slot already started
      const key = ahead * 1440 + start;
      if (!best || key < best.key) best = { key, daysAhead: ahead, start: slot.start, day: d };
    }
  }
  if (!best) return null;
  const when = best.daysAhead === 0 ? "Today" : best.daysAhead === 1 ? "Tomorrow" : best.day;
  return {
    daysAhead: best.daysAhead,
    start: best.start,
    label: `${when} at ${clockLabel(best.start)}`,
  };
}

// Start times of the given shows over the next `days` days, soonest first,
// as Eastern { show, date, start }. Today's slots that have already begun
// are left out.
export function upcomingStarts(shows, showIds, { date, day, time }, days = 7) {
  const now = toMinutes(time);
  const today = dayIndex(day);
  const out = [];
  for (const id of showIds) {
    const show = shows[id];
    for (const slot of show?.schedule || []) {
      const start = toMinutes(slot.start);
      for (let k = 0; k <= days; k++) {
        if (!slot.days.includes(dayAt(today + k))) continue;
        if (k === 0 && start <= now) continue;
        out.push({ show, date: shiftDate(date, k), start: slot.start });
      }
    }
  }
  return out.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}
