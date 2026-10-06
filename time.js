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

export function easternParts(date = new Date()) {
  const parts = Object.fromEntries(easternFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    day: parts.weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

// Minutes for a reported Eastern wall-clock date+time, comparable across
// midnight. Both sides of a comparison are Eastern wall clock, so a fixed
// zone is used purely to get a monotonic number.
export function reportedMinutes(date, time) {
  const [y, mo, d] = String(date || "")
    .split("-")
    .map(Number);
  const [h, mi] = String(time || "")
    .split(":")
    .map(Number);
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null;
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

// "16:00" -> "4pm", "07:30" -> "7:30am", "12:00" -> "noon", "00:00" -> "midnight".
export function clockLabel(time) {
  const [h, m] = time.split(":").map(Number);
  if (m === 0 && h % 12 === 0) return h === 12 ? "noon" : "midnight";
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
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
const localTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});
const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const localWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long" });

// An instant as a clock label in the listener's zone: "4pm", "7:30am",
// "midnight", "noon".
export function localClock(epoch, timeZone) {
  const format = timeZone
    ? new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hourCycle: "h23",
      })
    : localTimeFormat;
  const parts = Object.fromEntries(
    format.formatToParts(new Date(epoch)).map((p) => [p.type, p.value]),
  );
  return clockLabel(`${Number(parts.hour) % 24}:${parts.minute}`);
}

// "Today at 2pm", "Tomorrow at 6am", "Friday at 10am", in the listener's zone.
export function localWhen(epoch, now = Date.now()) {
  const day = localDateFormat.format(new Date(epoch));
  const today = localDateFormat.format(new Date(now));
  const tomorrow = localDateFormat.format(new Date(now + 86400000));
  const when =
    day === today ? "Today" : day === tomorrow ? "Tomorrow" : localWeekday.format(new Date(epoch));
  return `${when} at ${localClock(epoch)}`;
}

// Whether the listener's clock reads Eastern time (then no zone needs naming).
export const deviceIsEastern = (now = new Date()) =>
  localTimeFormat.format(now) ===
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
