import { test } from "node:test";
import assert from "node:assert/strict";
import { concertEvent, googleCalendarUrl, icsFor } from "../calendar.js";

const BRIGHT_EYES = {
  id: 510352,
  date: "2026-10-07",
  artist: "Bright Eyes / Lullaby For The Working Class",
  venue: "Union Transfer",
  city: "Philadelphia",
  region: "Philadelphia Area",
  ticketUrl: "https://tickets.example/510352",
  pageUrl: "https://xpn.org/event/510352/",
};

test("a concert becomes an all-day event with venue, tickets and a note on times", () => {
  const e = concertEvent(BRIGHT_EYES);
  assert.equal(e.title, "Bright Eyes / Lullaby For The Working Class");
  assert.equal(e.location, "Union Transfer, Philadelphia");
  assert.match(e.description, /Tickets: https:\/\/tickets\.example\/510352/);
  assert.match(e.description, /Check the venue for door and show times/);
  assert.equal(
    concertEvent({ ...BRIGHT_EYES, city: "" }).location,
    "Union Transfer, Philadelphia Area",
  );
});

test("the .ics file is valid iCalendar: all-day dates, escaping, folded lines", () => {
  const odd = { ...BRIGHT_EYES, id: 7, date: "2026-12-31", artist: "Chris' Jazz Cafe; late, show" };
  const ics = icsFor(
    [BRIGHT_EYES, odd, { id: 9, date: "soon", artist: "Bad" }],
    new Date("2026-10-05T18:00:00Z"),
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2, "an undated entry is left out");
  assert.match(ics, /DTSTART;VALUE=DATE:20261007\r\nDTEND;VALUE=DATE:20261008/);
  assert.match(
    ics,
    /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/,
    "across the new year",
  );
  assert.ok(
    ics.includes(String.raw`SUMMARY:Chris' Jazz Cafe\; late\, show`),
    "commas and semicolons escaped",
  );
  assert.match(ics, /UID:wxpn-concert-510352@xpn\.org/);
  assert.match(ics, /DTSTAMP:20261005T180000Z/);
  for (const line of ics.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(
    unfolded,
    /DESCRIPTION:Tickets: https:\/\/tickets\.example\/510352\\nDetails: https:\/\/xpn\.org\/event\/510352\/\\n/,
  );
});

test("Google Calendar link carries the same event", () => {
  const url = new URL(googleCalendarUrl(BRIGHT_EYES));
  assert.equal(url.hostname, "calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261007/20261008");
  assert.equal(url.searchParams.get("location"), "Union Transfer, Philadelphia");
});
