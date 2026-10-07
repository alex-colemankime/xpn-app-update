import { CONCERTS_ENDPOINT } from "./config.js";
import { withTimeout } from "./net.js";
import { plainText, webUrl } from "./text.js";
import { shiftDate } from "./time.js";

// Feeds report local Eastern datetimes ("2026-06-12 20:00:00"). Parsing
// those into a Date and taking toISOString() pushes evening events onto the
// next day, so the calendar date is read textually when present and
// otherwise formatted in the station's zone.
const easternDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;
export function isoDate(value) {
  const text = String(value ?? "").trim();
  const literal = text.match(/^\d{4}-\d{2}-\d{2}/);
  // No zone marker means the feed sent Eastern wall-clock time: keep the day
  // it wrote. A zoned instant is converted into the station's day instead.
  if (literal && !ZONED.test(text)) return literal[0];
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? "" : easternDate.format(parsed);
}

// Today in the station's zone, as YYYY-MM-DD.
export const easternToday = (now = new Date()) => easternDate.format(now);

// The station's calendar is The Events Calendar on xpn.org. Its categories
// carry the regions plus two special ones; one parent category is internal.
const CATEGORY = { welcomes: 21, freeAtNoon: 33960 };
const NOT_A_REGION = [CATEGORY.welcomes, CATEGORY.freeAtNoon];
const HIDDEN_CATEGORIES = [25];

// One event from the calendar (or an older-style feed) in the app's shape:
// { id, date, artist, venue, city, region, regions, xpnWelcomes, freeAtNoon,
//   ticketUrl, pageUrl, image, age }. Start times are left out: many events
// carry placeholder times.
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
    artist: plainText(title),
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
  };
}

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
// Pages come soonest first, so a calendar longer than this loses only its
// furthest-off shows (400 events is several months of WXPN listings).
const MAX_PAGES = 8;
const MONTHS_AHEAD = 12;

// fetch with a timeout and an outside abort signal. Manual wiring rather
// than AbortSignal.any, which older iOS webviews lack.
async function getJson(url, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  try {
    const response = await fetch(url, { signal: controller.signal });
    // The Events Calendar answers 404 when nothing matches.
    if (response.status === 404) return { events: [], total_pages: 0 };
    if (!response.ok) throw new Error(`Concert feed: HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

const eventsOf = (data) => (Array.isArray(data) ? data : data?.events || data?.items || []);

// The calendar's request for a page of the next year of events.
export function calendarPageUrl(endpoint, page, today = easternToday()) {
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + MONTHS_AHEAD);
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    start_date: today,
    end_date: `${end.toISOString().slice(0, 10)} 23:59:59`,
    page: String(page),
  });
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params}`;
}

// Resolves to { concerts, source, partial } where source is:
//   "live"          listings from the calendar
//   "unconfigured"  no calendar (VITE_XPN_CONCERTS_ENDPOINT=off)
//   "error"         the calendar failed; never replaced with made-up events
// and `partial` is true when some later pages failed, so the screen can say
// the list is incomplete and offer to try again.
export async function fetchConcertResult(signal, endpoint = CONCERTS_ENDPOINT) {
  if (!endpoint) return { concerts: [], source: "unconfigured", partial: false };
  try {
    const first = await getJson(calendarPageUrl(endpoint, 1), signal);
    const pages = Math.min(MAX_PAGES, Number(first?.total_pages) || 1);
    let failed = 0;
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        getJson(calendarPageUrl(endpoint, i + 2), signal).then(eventsOf, () => {
          failed++;
          return [];
        }),
      ),
    );
    return {
      concerts: upcomingConcerts(eventsOf(first).concat(...rest)),
      source: "live",
      partial: failed > 0,
    };
  } catch {
    return { concerts: [], source: "error", partial: false };
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

function pumpAges() {
  while (ageBusy < AGE_CONCURRENCY && ageQueue.length) {
    const id = ageQueue.shift();
    const url = ageUrl(id);
    if (!url) continue;
    ageBusy++;
    fetch(url, { signal: withTimeout(undefined) })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((json) => {
        ages.set(id, ageLabel(json?._xpn_age_restriction));
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
//   when     "all", "today", "weekend" (Friday to Sunday) or "week"
//   regions  region names; tags  "welcomes", "fan" (Free at Noon), "saved"
function inRange(date, when, today) {
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

export function filterConcerts(
  concerts,
  {
    words = [],
    when = "all",
    today = easternToday(),
    regions = [],
    tags = [],
    savedIds = new Set(),
  } = {},
) {
  return concerts.filter(
    (c) =>
      words.every((w) => `${c.artist} ${c.venue} ${c.city}`.toLowerCase().includes(w)) &&
      inRange(c.date, when, today) &&
      (!regions.length || c.regions.some((r) => regions.includes(r))) &&
      (!tags.includes("welcomes") || c.xpnWelcomes) &&
      (!tags.includes("fan") || c.freeAtNoon) &&
      (!tags.includes("saved") || savedIds.has(c.id)),
  );
}
