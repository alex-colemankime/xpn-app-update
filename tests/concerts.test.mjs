import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageLabel,
  calendarPageUrl,
  easternToday,
  fetchConcertResult,
  isoDate,
  normalizeEvent,
  plainText,
  safeUrl,
  upcomingConcerts,
} from "../concerts.js";

test("concert dates keep the Eastern calendar day for evening events", () => {
  // The original bug: an 8pm ET show landed on the next day via toISOString.
  assert.equal(isoDate("2026-06-12 20:00:00"), "2026-06-12");
  assert.equal(isoDate("2026-06-12T20:00:00-04:00"), "2026-06-12");
  assert.equal(isoDate("2026-06-13T02:00:00Z"), "2026-06-12"); // 10pm ET
  assert.equal(isoDate("2026-06-12"), "2026-06-12");
  assert.equal(isoDate("not a date"), "");
  assert.equal(isoDate(undefined), "");
});

test("feed text is stripped of markup and fully entity-decoded", () => {
  assert.equal(plainText("Hall &#038; Oates"), "Hall & Oates");
  assert.equal(plainText("Guns N&#8217; Roses"), "Guns N’ Roses");
  assert.equal(plainText("<em>Sold</em> &ndash; out &hellip;"), "Sold – out …");
  assert.equal(plainText("&#x1F3B8; night"), "🎸 night");
  assert.equal(
    plainText("&lt;script&gt;"),
    "<script>",
    "decoded text is never re-parsed as markup",
  );
  assert.equal(plainText("  A \n  B "), "A B");
  assert.equal(plainText("&bogus; &#0;"), "&bogus; &#0;");
});

test("only web links survive as ticket URLs", () => {
  assert.equal(safeUrl("https://tickets.test/x"), "https://tickets.test/x");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,hi"), "");
  assert.equal(safeUrl("/relative"), "");
  assert.equal(safeUrl(undefined), "");
});

test("a feed becomes upcoming concerts, soonest first", () => {
  const events = [
    { id: 3, title: { rendered: "Later" }, start_date: "2026-10-20 20:00:00" },
    { id: 1, title: "Tonight", start_date: "2026-09-28 20:00:00", url: "javascript:x" },
    { id: 2, title: "Last week", start_date: "2026-09-20 20:00:00" },
    { id: 4, title: "", start_date: "2026-10-01" },
    { id: 5, title: "No date" },
  ];
  const list = upcomingConcerts(events, "2026-09-28");
  assert.deepEqual(
    list.map((c) => c.artist),
    ["Tonight", "Later"],
  );
  assert.equal(list[0].ticketUrl, "");
  assert.equal(easternToday(new Date("2026-09-29T02:00:00Z")), "2026-09-28", "10pm ET");
});

// The shape xpn.org's calendar (The Events Calendar) returns.
const tecEvent = (over = {}) => ({
  id: 510352,
  title: "Bright Eyes / Lullaby For The Working Class",
  start_date: "2026-10-07 00:00:00",
  start_date_details: { year: "2026", month: "10", day: "07", hour: "00", minutes: "00" },
  all_day: true,
  url: "https://xpn.org/event/bright-eyes-lullaby-for-the-working-class/",
  website: "https://utphilly.com/events/detail/?event_id=1484028",
  venue: { venue: "Union Transfer", city: "Philadelphia" },
  categories: [
    { id: 24, name: "Philadelphia Area" },
    { id: 21, name: "WXPN Welcomes" },
    { id: 25, name: "Events Regions" },
  ],
  hide_from_listings: false,
  ...over,
});

test("calendar events read as concerts: regions, WXPN Welcomes, Free at Noon, links", () => {
  const c = normalizeEvent(tecEvent());
  assert.equal(c.id, "510352");
  assert.equal(c.date, "2026-10-07");
  assert.equal(c.artist, "Bright Eyes / Lullaby For The Working Class");
  assert.equal(c.venue, "Union Transfer");
  assert.deepEqual(
    c.regions,
    ["Philadelphia Area"],
    "WXPN Welcomes and the internal parent are not regions",
  );
  assert.equal(c.xpnWelcomes, true);
  assert.equal(c.freeAtNoon, false);
  assert.match(c.ticketUrl, /^https:\/\/utphilly\.com/);
  assert.match(c.pageUrl, /^https:\/\/xpn\.org\/event\//);
  const fan = normalizeEvent(
    tecEvent({
      id: 511367,
      title: "WXPN Free At Noon: WESLEY STACE",
      venue: { venue: "The Music Hall at World Stage (formerly World Cafe Live)" },
      categories: [
        { id: 33960, name: "Free At Noon" },
        { id: 24, name: "Philadelphia Area" },
      ],
    }),
  );
  assert.equal(fan.freeAtNoon, true);
  assert.equal(fan.xpnWelcomes, false);
  assert.equal(
    normalizeEvent(tecEvent({ title: "Ortlieb&#8217;s Night &#038; Day" })).artist,
    "Ortlieb’s Night & Day",
  );
});

test("hidden and past calendar events are left out", () => {
  const list = upcomingConcerts(
    [
      tecEvent(),
      tecEvent({ id: 2, hide_from_listings: true }),
      tecEvent({ id: 3, start_date_details: { year: "2026", month: "9", day: "1" } }),
    ],
    "2026-10-05",
  );
  assert.deepEqual(
    list.map((c) => c.id),
    ["510352"],
  );
});

test("ages read the way the website writes them", () => {
  assert.equal(ageLabel("AA"), "All ages");
  assert.equal(ageLabel("21+"), "21+");
  assert.equal(ageLabel(""), "");
  assert.equal(ageLabel(undefined), "");
});

test("the calendar is asked for a year of events, page by page", () => {
  const url = new URL(
    calendarPageUrl("https://xpn.org/wp-json/tribe/events/v1/events", 2, "2026-10-05"),
  );
  assert.equal(url.searchParams.get("start_date"), "2026-10-05");
  assert.equal(url.searchParams.get("end_date"), "2027-10-05 23:59:59");
  assert.equal(url.searchParams.get("per_page"), "50");
  assert.equal(url.searchParams.get("page"), "2");
});

test("every page of the calendar is loaded; failures are errors or marked partial, never made-up events", async () => {
  const real = globalThis.fetch;
  try {
    const pages = {
      1: [tecEvent({ id: 1, start_date_details: { year: "2099", month: "1", day: "2" } })],
      2: [tecEvent({ id: 2, start_date_details: { year: "2099", month: "1", day: "1" } })],
    };
    globalThis.fetch = async (url) => {
      const page = new URL(url).searchParams.get("page");
      return { ok: true, status: 200, json: async () => ({ events: pages[page], total_pages: 2 }) };
    };
    const result = await fetchConcertResult(
      undefined,
      "https://xpn.org/wp-json/tribe/events/v1/events",
    );
    assert.equal(result.source, "live");
    assert.equal(result.partial, false);
    assert.deepEqual(
      result.concerts.map((c) => c.id),
      ["2", "1"],
      "merged and sorted by date",
    );

    // A later page failing is reported, not passed off as the whole calendar.
    globalThis.fetch = async (url) => {
      const page = new URL(url).searchParams.get("page");
      if (page === "2") return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ events: pages[page], total_pages: 2 }) };
    };
    const partial = await fetchConcertResult(undefined, "https://x.test/events");
    assert.equal(partial.source, "live");
    assert.equal(partial.partial, true, "marked incomplete, so the screen offers to try again");
    assert.deepEqual(
      partial.concerts.map((c) => c.id),
      ["1"],
    );

    globalThis.fetch = async () => ({ ok: true, status: 404, json: async () => ({}) });
    assert.deepEqual(await fetchConcertResult(undefined, "https://x.test/events"), {
      concerts: [],
      source: "live",
      partial: false,
    });

    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    assert.deepEqual(await fetchConcertResult(undefined, "https://x.test/events"), {
      concerts: [],
      source: "error",
      partial: false,
    });
    assert.deepEqual(await fetchConcertResult(undefined, ""), {
      concerts: [],
      source: "unconfigured",
      partial: false,
    });
  } finally {
    globalThis.fetch = real;
  }
});
