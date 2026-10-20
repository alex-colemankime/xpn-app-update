import { CONCERTS_ENDPOINT } from "./config.js";
import { withTimeout } from "./net.js";
import { plainText, webUrl } from "./text.js";
import { apMonths, easternParts, shiftDate } from "./time.js";

// Feeds report local Eastern datetimes ("2026-06-12 20:00:00"). Parsing
// those into a Date and taking toISOString() pushes evening events onto the
// next day, so the calendar date is read textually when present and
// otherwise taken in the station's zone.
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;
export function isoDate(value) {
  const text = String(value ?? "").trim();
  const literal = text.match(/^\d{4}-\d{2}-\d{2}/);
  // No zone marker means the feed sent Eastern wall-clock time: keep the day
  // it wrote. A zoned instant is converted into the station's day instead.
  if (literal && !ZONED.test(text)) return literal[0];
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? "" : easternParts(parsed).date;
}

// Today in the station's zone, as YYYY-MM-DD.
export const easternToday = (now = new Date()) => easternParts(now).date;

// The station's calendar is The Events Calendar on xpn.org. Its categories
// carry the regions plus two special ones; one parent category is internal.
const CATEGORY = { welcomes: 21, freeAtNoon: 33960 };
const NOT_A_REGION = [CATEGORY.welcomes, CATEGORY.freeAtNoon];
const HIDDEN_CATEGORIES = [25];

// One event from the calendar (or an older-style feed) in the app's shape:
// { id, date, artist, venue, city, region, regions, xpnWelcomes, freeAtNoon,
//   ticketUrl, pageUrl, image, age, time, endTime }. Most events carry
// placeholder times (all day, midnight, or WordPress's 8am-to-5pm default),
// so a time ("12:00", Eastern) is kept only when it's a real one.
const clockOf = (value) => /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ""));
export function timesOf(event) {
  const start = clockOf(event.start_date);
  if (event.all_day || !start) return { time: null, endTime: null };
  const end = clockOf(event.end_date);
  const time = `${start[2]}:${start[3]}`;
  const endTime = end && end[1] === start[1] ? `${end[2]}:${end[3]}` : null;
  if (time === "00:00" || (time === "08:00" && endTime === "17:00")) {
    return { time: null, endTime: null };
  }
  return { time, endTime: endTime > time ? endTime : null };
}

// A title as the app shows it. Some Free at Noon listings are written
// "WXPN Free At Noon: SAM AND LOUISE SULLIVAN": the show's name goes (the
// row's flag says it), and a name of several words all in capitals is set in
// title case. A one-word name in capitals ("MGMT") is left as it is.
const SMALL_WORDS = new Set(["a", "an", "and", "at", "for", "of", "the", "with"]);
export function concertTitle(title) {
  const text = plainText(title).replace(/^(?:WXPN\s+)?Free\s+at\s+Noon\s*[:\-–—]\s*/i, "");
  if (!/\s/.test(text) || /[a-z]/.test(text) || !/[A-Z]{2}/.test(text)) return text;
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word)
        ? word
        : word.replace(/(^|[-'’(/])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    )
    .join("");
}

export function normalizeEvent(event) {
  const title = typeof event.title === "object" ? event.title?.rendered : event.title;
  const sd = event.start_date_details;
  const rawDate = sd
    ? `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}`
    : event.start_date || event.date || event.event_date || event.acf?.date;
  const categories = (Array.isArray(event.categories) ? event.categories : []).filter(
    (c) => c && !HIDDEN_CATEGORIES.includes(c.id),
  );
  const ids = categories.map((c) => c.id);
  const regions = categories
    .filter((c) => !NOT_A_REGION.includes(c.id))
    .map((c) => plainText(c.name))
    .filter(Boolean);
  const venue = event.venue && typeof event.venue === "object" ? event.venue : null;
  return {
    id: String(event.id ?? `${title}-${rawDate}`),
    date: isoDate(rawDate),
    artist: concertTitle(title),
    venue: plainText(venue ? venue.venue : event.venue || event.acf?.venue),
    city: plainText(venue?.city),
    region: regions[0] || plainText(event.region || event.acf?.region),
    regions,
    age: ageLabel(event.age || event.acf?.age),
    xpnWelcomes:
      ids.includes(CATEGORY.welcomes) || Boolean(event.xpn_welcomes ?? event.acf?.xpn_welcomes),
    freeAtNoon: ids.includes(CATEGORY.freeAtNoon),
    // Tickets: the event's own link (venue or ticket seller); its xpn.org page
    // is kept separately.
    ticketUrl: webUrl(event.website || event.ticket_url || event.acf?.ticket_url, { http: true }),
    pageUrl: webUrl(event.url, { http: true }),
    image: webUrl(event.image?.url, { http: true }),
    hidden: Boolean(event.hide_from_listings),
    ...timesOf(event),
  };
}

// A bill as the calendar writes it, "Headliner / Support / Support", as
// its headliner and the acts supporting it. Only a slash between spaces
// splits it, and never one inside parentheses ("Electrospective (feat.
// Adam Deitch / Oteil Burbridge)" is one act). Empty parts are dropped.
export function splitBill(title) {
  const parts = [];
  let depth = 0;
  let from = 0;
  const text = String(title || "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "/" && !depth && /\s/.test(text[i - 1] || "") && /\s/.test(text[i + 1] || "")) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  const [headliner = "", ...support] = parts.map((p) => p.trim()).filter(Boolean);
  return { headliner, support };
}

// A list as it is shown: by day, and within a day the station's own shows
// first (Free at Noon, at noon, then WXPN Welcomes), then the rest in the
// calendar's order. Done on the whole list before it is paged, so a station
// show never waits behind "Load more".
const billing = (c) => (c.freeAtNoon ? 0 : c.xpnWelcomes ? 1 : 2);
export const inShowOrder = (concerts) =>
  [...concerts].sort((a, b) => a.date.localeCompare(b.date) || billing(a) - billing(b));

// The region nearly every concert is in: a row leaves it unsaid, and names
// any other (Lehigh Valley, Central PA) or the town when the calendar has one.
export const HOME_REGION = "Philadelphia Area";
export const concertPlace = (c) => c.city || (c.region !== HOME_REGION ? c.region : "") || "";

// The calendar's age field: "AA", "18+", "21+".
export function ageLabel(value) {
  const text = plainText(value);
  if (!text) return "";
  return /^(aa|all ages?)$/i.test(text) ? "All ages" : text;
}

// A feed's events, minus anything unusable, hidden or already past, soonest
// first.
export function upcomingConcerts(events, today = easternToday()) {
  return events
    .filter((event) => event && typeof event === "object")
    .map(normalizeEvent)
    .filter((c) => c.date && c.artist && c.date >= today && !c.hidden)
    .sort((a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist));
}

const FEED_TIMEOUT_MS = 12000;
const PER_PAGE = 50;
// Every page the calendar reports is read, a few at a time. Past this many
// (1,500 events, years of WXPN listings) the rest is left off, and the
// result says how far it reaches.
const MAX_PAGES = 30;
const PAGE_CONCURRENCY = 4;
const MONTHS_AHEAD = 12;

// One page of the calendar, bounded by a timeout. A cancelled load (retry,
// or the screen closing) stops every later page too, even one that has not
// started yet.
async function getJson(url, signal) {
  const response = await fetch(url, { signal: withTimeout(signal, FEED_TIMEOUT_MS) });
  // The Events Calendar answers 404 when nothing matches.
  if (response.status === 404) return { events: [], total_pages: 0 };
  if (!response.ok) throw new Error(`Concert feed: HTTP ${response.status}`);
  return response.json();
}

const eventsOf = (data) => (Array.isArray(data) ? data : data?.events || data?.items || []);

// The last day the app asks the calendar for: a year from today. Dates past
// it can't be picked (the Filter's calendar), since nothing there is loaded.
export function calendarEnd(today = easternToday()) {
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + MONTHS_AHEAD);
  return end.toISOString().slice(0, 10);
}

// The calendar's request for a page of the next year of events.
export function calendarPageUrl(endpoint, page, today = easternToday()) {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    start_date: today,
    end_date: `${calendarEnd(today)} 23:59:59`,
    page: String(page),
  });
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params}`;
}

// Resolves to { concerts, source, partial, through } where source is:
//   "live"          listings from the calendar
//   "unconfigured"  no calendar (VITE_XPN_CONCERTS_ENDPOINT=off)
//   "error"         the calendar failed; never replaced with made-up events
// `partial` is true when some later pages failed, so the screen can say the
// list is incomplete and offer to try again; `through` is the last date
// listed when the calendar ran past MAX_PAGES (otherwise "").
export async function fetchConcertResult(signal, endpoint = CONCERTS_ENDPOINT) {
  if (!endpoint) return { concerts: [], source: "unconfigured", partial: false, through: "" };
  try {
    const first = await getJson(calendarPageUrl(endpoint, 1), signal);
    const reported = Math.max(1, Number(first?.total_pages) || 1);
    const pages = Math.min(MAX_PAGES, reported);
    let failed = 0;
    const later = Array.from({ length: pages - 1 }, (_, i) => i + 2);
    const results = [];
    // A few pages at a time, so a long calendar doesn't flood the site.
    for (let i = 0; i < later.length; i += PAGE_CONCURRENCY) {
      const batch = later.slice(i, i + PAGE_CONCURRENCY);
      results.push(
        ...(await Promise.all(
          batch.map((page) =>
            getJson(calendarPageUrl(endpoint, page), signal).then(eventsOf, () => {
              failed++;
              return [];
            }),
          ),
        )),
      );
    }
    const concerts = upcomingConcerts(eventsOf(first).concat(...results));
    return {
      concerts,
      source: "live",
      partial: failed > 0,
      through: reported > pages ? concerts[concerts.length - 1]?.date || "" : "",
    };
  } catch {
    return { concerts: [], source: "error", partial: false, through: "" };
  }
}

// Age limits live in a separate field on the calendar, one request per event,
// so they are fetched only for concerts on screen, a few at a time, and kept.
const ages = new Map();
const ageListeners = new Set();
const ageQueue = [];
let ageBusy = 0;
const AGE_CONCURRENCY = 4;

function ageUrl(id) {
  try {
    const { origin } = new URL(CONCERTS_ENDPOINT);
    return `${origin}/wp-json/acf/v3/tribe_events/${encodeURIComponent(id)}/_xpn_age_restriction`;
  } catch {
    return null;
  }
}

// One concert's age limit, or "" when it can't be read.
async function readAge(url) {
  try {
    const response = await fetch(url, { signal: withTimeout() });
    return response.ok ? ageLabel((await response.json())?._xpn_age_restriction) : "";
  } catch {
    return "";
  }
}

function pumpAges() {
  while (ageBusy < AGE_CONCURRENCY && ageQueue.length) {
    const id = ageQueue.shift();
    const url = ageUrl(id);
    if (!url) continue;
    ageBusy++;
    readAge(url).then((age) => {
      ages.set(id, age);
      ageBusy--;
      ageListeners.forEach((listener) => listener());
      pumpAges();
    });
  }
}

// Ask for a concert's age limit (once; a row calls this when it is shown).
export function requestAge(concert) {
  if (concert.age || !/^\d+$/.test(concert.id) || ages.has(concert.id)) return;
  ages.set(concert.id, "");
  ageQueue.push(concert.id);
  pumpAges();
}

// A concert's age limit as known so far ("" until it arrives).
export const concertAge = (concert) => concert.age || ages.get(concert.id) || "";

export function subscribeAges(listener) {
  ageListeners.add(listener);
  return () => ageListeners.delete(listener);
}

// Concert lists as the Concerts filters narrow them. Every filter must match,
// so "WXPN Welcomes" with "Philadelphia Area" is the Welcomes shows in the
// Philadelphia Area (xpn.org's calendar can show one or the other); regions
// chosen together mean any of them.
//   words    search words, each found in artist, venue or city
//   when     "all", "today", "weekend" (Friday to Sunday), "week" or "range"
//   range    for "range": { from, to } (YYYY-MM-DD; either may be "")
//   regions  region names; tags  "welcomes", "fan" (Free at Noon), "saved"
function inRange(date, when, today, range) {
  if (when === "range") {
    return (!range?.from || date >= range.from) && (!range?.to || date <= range.to);
  }
  if (when === "today") return date === today;
  if (when === "week") return date >= today && date <= shiftDate(today, 6);
  if (when === "weekend") {
    // Friday to Sunday; on the weekend itself, the rest of it.
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const from = dow === 0 || dow === 6 || dow === 5 ? today : shiftDate(today, 5 - dow);
    const to = shiftDate(today, dow === 0 ? 0 : 7 - dow);
    return date >= from && date <= to;
  }
  return true;
}

// A range picked on one calendar (RangeCalendar.jsx): the range after a tap
// on `day`. A first tap picks that one day; a later day then makes it a
// range to there. Tapping a picked day (the one day, or either end) lets the
// dates go, back to every date; any other day starts again from it.
export function pickDay({ from, to }, day) {
  if (day === from || day === to) return { from: "", to: "" };
  if (from && from === to && day > from) return { from, to: day };
  return { from: day, to: day };
}

// "Oct. 14–20", "Oct. 30 – Nov. 2", "From Oct. 14": a chosen range, short,
// its months AP style like every date in the app.
const RANGE_DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const rangeDay = (iso) => apMonths(RANGE_DAY.format(new Date(`${iso}T12:00:00`)));
export function rangeLabel({ from, to }) {
  if (from && to) {
    if (from === to) return rangeDay(from);
    const [a, b] = [rangeDay(from), rangeDay(to)];
    return from.slice(0, 7) === to.slice(0, 7) ? `${a}–${b.split(" ")[1]}` : `${a} – ${b}`;
  }
  if (from) return `From ${rangeDay(from)}`;
  return to ? `Through ${rangeDay(to)}` : "";
}

export function filterConcerts(
  concerts,
  {
    words = [],
    when = "all",
    range = null,
    today = easternToday(),
    regions = [],
    tags = [],
    savedIds = new Set(),
  } = {},
) {
  return concerts.filter(
    (c) =>
      words.every((w) => `${c.artist} ${c.venue} ${c.city}`.toLowerCase().includes(w)) &&
      inRange(c.date, when, today, range) &&
      (!regions.length || c.regions.some((r) => regions.includes(r))) &&
      (!tags.includes("welcomes") || c.xpnWelcomes) &&
      (!tags.includes("fan") || c.freeAtNoon) &&
      (!tags.includes("saved") || savedIds.has(c.id)),
  );
}
