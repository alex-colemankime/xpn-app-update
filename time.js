// Time helpers. The station publishes schedules and playlists in Eastern
// time, so anything compared against them is computed in America/New_York
// regardless of where the listener is.

const easternFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// A formatted date as { year, month, hour, ... }.
const partsOf = (format, date) =>
  Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));

export function easternParts(date = new Date()) {
  const parts = partsOf(easternFormat, date);
  return {
    day: parts.weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

// The real moment (epoch ms) of something the station reported at an
// Eastern wall-clock date and time, as of `now`. When the clocks fall back,
// 1:00–1:59am happens twice; of the moments a time can name, it's the latest
// not after now (give or take a clock a couple of minutes ahead), so a song
// at 1:58am EDT is three minutes old at 1:01am EST, and older than a song
// at 1:01am EST. Null when the date or time can't be read, or doesn't exist
// (the hour skipped in spring).
const CLOCK_AHEAD_MS = 2 * 60000;
// The moments an Eastern date and time can name, earliest first: one, two
// in the hour repeated in the fall (EDT, then EST), none for a time that
// can't be read or doesn't exist.
function momentsOf(date, time) {
  const [y, mo, d] = String(date || "")
    .split("-")
    .map(Number);
  const [h, mi] = String(time || "")
    .split(":")
    .map(Number);
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return [];
  return [4, 5]
    .map((offset) => Date.UTC(y, mo - 1, d, h + offset, mi))
    .filter((t) => {
      const back = easternParts(new Date(t));
      return back.date === date && back.time === time;
    });
}
const latestNotAfter = (fits, now) => {
  const past = fits.filter((t) => t <= now + CLOCK_AHEAD_MS);
  return past.length ? Math.max(...past) : Math.min(...fits);
};
export function reportedAt(date, time, now = Date.now()) {
  const fits = momentsOf(date, time);
  return fits.length ? latestNotAfter(fits, now) : null;
}

// The real moments of a station file's reports ({ date, time }, in the
// file's own order, either way round), using the file's order to place the
// hour repeated in the fall: the station logs as it plays, so in the order
// things happened, a repeated-hour time that comes after a later one
// (1:58am, then 1:02am) is the second 1:00–1:59am, EST, and so is every
// repeated-hour time after it; before that, a time the file shows following
// an earlier report is the first, EDT. So a song logged at 1:04am EDT is an
// hour old at 1:05am EST, never one minute. Only a repeated-hour time with
// nothing before it in the file falls back to the latest moment not after
// `now`. Null for any that can't be read. Pure, so it can be tested.
export function reportedMoments(reports, now = Date.now()) {
  const stamp = (r) => `${r?.date || ""} ${r?.time || ""}`;
  const fits = reports.map((r) => momentsOf(r?.date, r?.time));
  // The file's direction: newest first when its first report reads later
  // than its last.
  const order = reports.map((_, i) => i);
  if (reports.length > 1 && stamp(reports[0]) > stamp(reports[reports.length - 1])) order.reverse();
  const at = new Array(reports.length).fill(null);
  let fallen = false;
  let prev = null; // the report before, in the order things happened
  for (const i of order) {
    const f = fits[i];
    if (f.length === 1) at[i] = f[0];
    else if (f.length === 2) {
      const r = reports[i];
      if (!fallen && prev && fits[prev].length === 2 && reports[prev].date === r.date) {
        // Back to an earlier time within the repeated hour: the clocks fell.
        if (reports[prev].time > r.time) fallen = true;
      }
      at[i] = fallen ? f[1] : prev !== null ? f[0] : latestNotAfter(f, now);
      if (!fallen && at[i] === f[1]) fallen = true;
    }
    if (f.length) prev = i;
  }
  return at;
}

// "16:00" -> "4pm", "07:30" -> "7:30am", "12:00" -> "noon", "00:00" -> "midnight".
export function clockLabel(time) {
  const [h, m] = time.split(":").map(Number);
  if (m === 0 && h % 12 === 0) return h === 12 ? "noon" : "midnight";
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
}

// A calendar day, "2026-10-07", that exists ("2027-02-29" does not): the
// day itself, or "" when it isn't one.
export function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : "";
}

// The Eastern calendar date `days` after `date` (both YYYY-MM-DD). Noon UTC
// keeps the arithmetic clear of any daylight-saving edge.
export function shiftDate(date, days) {
  const stamp = new Date(`${date}T12:00:00Z`);
  stamp.setUTCDate(stamp.getUTCDate() + days);
  return stamp.toISOString().slice(0, 10);
}

// The real moment (epoch ms) of an Eastern wall-clock date and time.
// Eastern is UTC-4 in summer and UTC-5 in winter: try both and keep the one
// that reads back as the same wall-clock time. In the hour repeated when
// clocks fall back, the first occurrence wins; a time inside the hour
// skipped in spring does not exist, so it returns null.
export function easternToEpoch(date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  for (const offset of [4, 5]) {
    const t = Date.UTC(y, mo - 1, d, h + offset, mi);
    const back = easternParts(new Date(t));
    if (back.date === date && back.time === time) return t;
  }
  return null;
}

// Times shown to the listener are in their own zone, so a reminder, an
// "until 4pm" and a sleep timer all agree with the clock on their phone.
// For listeners in Eastern time this is the same as the station's clock.
// A 24-hour clock in `timeZone`, or in the listener's own zone when none is
// given. Each zone's formatter is made once.
const clockFormats = new Map();
const clockFormat = (zone) => {
  const timeZone = zone || undefined;
  if (!clockFormats.has(timeZone)) {
    clockFormats.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return clockFormats.get(timeZone);
};
const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const localWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long" });

// An instant as a clock label in the listener's zone: "4pm", "7:30am",
// "midnight", "noon".
export function localClock(epoch, timeZone) {
  const { hour, minute } = partsOf(clockFormat(timeZone), new Date(epoch));
  return clockLabel(`${hour}:${minute}`);
}

// "Today at 2pm", "Tomorrow at 6am", "Friday at 10am", in the listener's zone.
export function localWhen(epoch, now = Date.now()) {
  const day = localDateFormat.format(new Date(epoch));
  const today = localDateFormat.format(new Date(now));
  // The next calendar day, not 24 hours on, which lands on the wrong day
  // when the clocks change overnight.
  const n = new Date(now);
  const tomorrow = localDateFormat.format(
    new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 12),
  );
  const when =
    day === today ? "Today" : day === tomorrow ? "Tomorrow" : localWeekday.format(new Date(epoch));
  return `${when} at ${localClock(epoch)}`;
}

// Whether the listener's clock reads Eastern time (then no zone needs naming).
export const deviceIsEastern = (now = new Date()) =>
  clockFormat().format(now) === clockFormat("America/New_York").format(now);

// ---- Lengths and dates, as the app shows them --------------------------------

// "2247", "37:27" or "1:02:03" as seconds; null when missing or odd.
export function parseDuration(text) {
  const parts = String(text ?? "")
    .trim()
    .split(":");
  if (!parts[0] || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  return seconds > 0 ? seconds : null;
}

// "37 min", "1 hr 4 min", for a length in seconds.
export function lengthLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// "3h 52m", "57m", "2h": a length as a podcast app writes it, short.
export function compactLength(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// "Saturday, Oct. 10": the months a date names, shortened in AP style
// (March through July are written out).
const AP_MONTHS = {
  January: "Jan.",
  February: "Feb.",
  August: "Aug.",
  September: "Sept.",
  October: "Oct.",
  November: "Nov.",
  December: "Dec.",
};
export const apMonths = (text) =>
  String(text ?? "").replace(
    /\b(January|February|August|September|October|November|December)(?= \d)/g,
    (month) => AP_MONTHS[month],
  );

// "4:05", "1:02:03", for a playback position in seconds.
export function clockTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// "Oct. 1", "May 4", or "Sept. 30, 2025" for another year: when an episode
// or video aired, its month shortened AP style like every date in the app.
const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const DAY_AND_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const dateOf = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
export function shortDay(iso, now = new Date()) {
  const d = dateOf(iso);
  if (!d) return "";
  return apMonths((d.getFullYear() === now.getFullYear() ? DAY : DAY_AND_YEAR).format(d));
}
// "Oct. 1, 2026", always with the year.
export function mediumDay(iso) {
  const d = dateOf(iso);
  return d ? apMonths(DAY_AND_YEAR.format(d)) : "";
}
