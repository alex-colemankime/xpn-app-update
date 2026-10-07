import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageLabel,
  calendarPageUrl,
  easternToday,
  fetchConcertResult,
  filterConcerts,
  isoDate,
  normalizeEvent,
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
      through: "",
    });

    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    assert.deepEqual(await fetchConcertResult(undefined, "https://x.test/events"), {
      concerts: [],
      source: "error",
      partial: false,
      through: "",
    });
    assert.deepEqual(await fetchConcertResult(undefined, ""), {
      concerts: [],
      source: "unconfigured",
      partial: false,
      through: "",
    });
  } finally {
    globalThis.fetch = real;
  }
});

test("filters combine: WXPN Welcomes in the Philadelphia Area, not one or the other", () => {
  const concert = (id, date, regions, extra = {}) => ({
    id,
    date,
    artist: `Artist ${id}`,
    venue: "Venue",
    city: "Philadelphia",
    regions,
    xpnWelcomes: false,
    freeAtNoon: false,
    ...extra,
  });
  const list = [
    concert("welcomes-philly", "2026-10-09", ["Philadelphia Area"], { xpnWelcomes: true }),
    concert("welcomes-delaware", "2026-10-10", ["Delaware"], { xpnWelcomes: true }),
    concert("philly", "2026-10-10", ["Philadelphia Area"]),
    concert("lehigh", "2026-10-20", ["Lehigh Valley"], { city: "Bethlehem" }),
  ];
  const ids = (options) =>
    filterConcerts(list, { today: "2026-10-06", ...options }).map((c) => c.id);
  assert.deepEqual(ids({ regions: ["Philadelphia Area"], tags: ["welcomes"] }), [
    "welcomes-philly",
  ]);
  assert.deepEqual(ids({ tags: ["welcomes"] }), ["welcomes-philly", "welcomes-delaware"]);
  assert.deepEqual(
    ids({ regions: ["Philadelphia Area", "Lehigh Valley"] }),
    ["welcomes-philly", "philly", "lehigh"],
    "regions chosen together mean any of them",
  );
  assert.deepEqual(ids({ when: "weekend" }), ["welcomes-philly", "welcomes-delaware", "philly"]);
  assert.deepEqual(
    ids({ words: ["bethlehem"] }),
    ["lehigh"],
    "search reads artist, venue and city",
  );
  assert.deepEqual(ids({}), ["welcomes-philly", "welcomes-delaware", "philly", "lehigh"]);
});

test("a long calendar is read to its last page; past the limit it says how far it reaches", async () => {
  const real = globalThis.fetch;
  const day = (n) => {
    const d = new Date(Date.UTC(2099, 0, 1 + n));
    return {
      year: String(d.getUTCFullYear()),
      month: String(d.getUTCMonth() + 1),
      day: String(d.getUTCDate()),
    };
  };
  const requested = [];
  let total = 9;
  try {
    globalThis.fetch = async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      requested.push(page);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          events: [tecEvent({ id: page, start_date_details: day(page) })],
          total_pages: total,
        }),
      };
    };
    const nine = await fetchConcertResult(undefined, "https://x.test/events");
    assert.deepEqual(
      [...new Set(requested)].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    assert.equal(nine.concerts.length, 9, "the ninth page is not dropped");
    assert.equal(nine.partial, false);
    assert.equal(nine.through, "", "the whole calendar");

    total = 45;
    requested.length = 0;
    const capped = await fetchConcertResult(undefined, "https://x.test/events");
    assert.equal(capped.concerts.length, 30);
    assert.equal(capped.through, capped.concerts.at(-1).date, "says how far the list reaches");
  } finally {
    globalThis.fetch = real;
  }
});
