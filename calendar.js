// Hearted concerts into the listener's own calendar.
//   - In the phone apps: the system's "New Event" sheet, filled in, so the
//     listener picks the calendar and confirms (@ebarooni/capacitor-calendar).
//   - In a browser: an .ics file (Apple Calendar, Outlook, and Google on
//     Android open it), or a Google Calendar link.
// Most of the calendar's event times are placeholders, so a concert without
// a real time (concerts.js) is an all-day event and the note says to check
// the venue; one with a time is timed, in Eastern time.

import { Capacitor } from "@capacitor/core";
import { easternToEpoch, shiftDate } from "./time.js";

const plain = (value) => String(value || "").trim();

// What goes in the calendar for one concert.
export function concertEvent(c) {
  const location = [plain(c.venue), plain(c.city) || plain(c.region)].filter(Boolean).join(", ");
  const notes = [
    c.ticketUrl && `Tickets: ${c.ticketUrl}`,
    c.pageUrl && c.pageUrl !== c.ticketUrl && `Details: ${c.pageUrl}`,
    c.time
      ? "Saved from the WXPN app."
      : "Check the venue for door and show times. Saved from the WXPN app.",
  ].filter(Boolean);
  return {
    title: plain(c.artist),
    date: c.date, // "YYYY-MM-DD"
    location,
    description: notes.join("\n"),
    url: c.pageUrl || c.ticketUrl || "",
  };
}

const compact = (date) => date.replaceAll("-", "");
// "2026-10-23" and "12:00" as "20261023T120000". A missing end is an hour
// on, or the day's last minute for a late start.
const local = (date, time) => `${compact(date)}T${time.replace(":", "")}00`;
const endOf = (c) => {
  if (c.endTime) return c.endTime;
  const hour = Number(c.time.slice(0, 2)) + 1;
  return hour > 23 ? "23:59" : `${String(hour).padStart(2, "0")}${c.time.slice(2)}`;
};
const nextDay = (date) => shiftDate(date, 1);

// iCalendar text escaping, and lines folded at 75 octets (RFC 5545).
const escapeText = (text) =>
  plain(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
const encoder = new TextEncoder();
function fold(line) {
  const out = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    const n = encoder.encode(ch).length;
    if (size + n > limit) {
      out.push(current);
      current = ch;
      size = n;
    } else {
      current += ch;
      size += n;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

const stamp = (now) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

// One .ics file holding any number of concerts.
export function icsFor(concerts, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WXPN//WXPN App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const c of concerts) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || "")) continue;
    const e = concertEvent(c);
    lines.push(
      "BEGIN:VEVENT",
      `UID:wxpn-concert-${String(c.id).replace(/[^\w-]/g, "")}@xpn.org`,
      `DTSTAMP:${stamp(now)}`,
      ...(c.time
        ? [
            `DTSTART;TZID=America/New_York:${local(e.date, c.time)}`,
            `DTEND;TZID=America/New_York:${local(e.date, endOf(c))}`,
          ]
        : [
            `DTSTART;VALUE=DATE:${compact(e.date)}`,
            `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
          ]),
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      `DESCRIPTION:${escapeText(e.description)}`,
      ...(/^https:\/\//.test(e.url) ? [`URL:${e.url}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(c) {
  const e = concertEvent(c);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: c.time
      ? `${local(e.date, c.time)}/${local(e.date, endOf(c))}`
      : `${compact(e.date)}/${compact(nextDay(e.date))}`,
    ...(c.time ? { ctz: "America/New_York" } : {}),
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const fileName = (concerts) =>
  concerts.length === 1
    ? `${
        plain(concerts[0].artist)
          .replace(/[^\w]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "concert"
      }.ics`
    : "wxpn-concerts.ics";

export function downloadIcs(concerts) {
  const blob = new Blob([icsFor(concerts)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(concerts);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const calendarIsNative = () => Capacitor.isNativePlatform();

// Add one concert: the system sheet in the apps, an .ics file in a browser.
// Resolves to false only when it could not be offered at all.
export async function addToCalendar(c) {
  if (!calendarIsNative()) {
    downloadIcs([c]);
    return true;
  }
  try {
    const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
    const [y, m, d] = c.date.split("-").map(Number);
    const e = concertEvent(c);
    await CapacitorCalendar.createEventWithPrompt({
      title: e.title,
      location: e.location,
      description: e.description,
      url: e.url || undefined,
      ...(c.time
        ? {
            isAllDay: false,
            startDate: easternToEpoch(c.date, c.time),
            endDate: easternToEpoch(c.date, endOf(c)),
          }
        : {
            isAllDay: true,
            startDate: new Date(y, m - 1, d).valueOf(),
            endDate: new Date(y, m - 1, d + 1).valueOf(),
          }),
    });
    return true;
  } catch {
    return false;
  }
}
