// Hearted concerts into the listener's own calendar.
//   - In the phone apps: the system's "New Event" sheet, filled in, so the
//     listener picks the calendar and confirms (@ebarooni/capacitor-calendar).
//   - In a browser: an .ics file (Apple Calendar, Outlook, and Google on
//     Android open it), or a Google Calendar link.
// The calendar's event times are placeholders, so concerts are all-day events
// and the note says to check the venue for times.

import { Capacitor } from "@capacitor/core";

const plain = (value) => String(value || "").trim();

// What goes in the calendar for one concert.
export function concertEvent(c) {
  const location = [plain(c.venue), plain(c.city) || plain(c.region)].filter(Boolean).join(", ");
  const notes = [
    c.ticketUrl && `Tickets: ${c.ticketUrl}`,
    c.pageUrl && c.pageUrl !== c.ticketUrl && `Details: ${c.pageUrl}`,
    "Check the venue for door and show times. Saved from the WXPN app.",
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
function nextDay(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// iCalendar text escaping, and lines folded at 75 octets (RFC 5545).
const escapeText = (text) =>
  plain(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
function fold(line) {
  const bytes = new TextEncoder();
  const out = [];
  let current = "";
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes.encode(current + ch).length > limit) {
      out.push(current);
      current = ch;
    } else current += ch;
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
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
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
    dates: `${compact(e.date)}/${compact(nextDay(e.date))}`,
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
      isAllDay: true,
      startDate: new Date(y, m - 1, d).valueOf(),
      endDate: new Date(y, m - 1, d + 1).valueOf(),
    });
    return true;
  } catch {
    return false;
  }
}
