import { useState } from "react";
import { Icon } from "../ui.jsx";
import { shiftDate } from "../time.js";
import { pickDay } from "../concerts.js";

// One month at a time, to pick a range of days in: the first tap is the
// start, the second the end (a day before the start begins again from it),
// a third starts a new range. Days before `min` can't be picked. Dates are
// "YYYY-MM-DD", as the concert calendar has them.
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_NAME = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const at = (iso) => new Date(`${iso}T12:00:00Z`);
const monthOf = (iso) => `${iso.slice(0, 7)}-01`;
const addMonths = (first, n) => {
  const d = at(first);
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
};

export function RangeCalendar({ from, to, min, onChange }) {
  const [month, setMonth] = useState(() => monthOf(from || min));
  const lead = at(month).getUTCDay();
  const days = [];
  for (let d = month; d.slice(0, 7) === month.slice(0, 7); d = shiftDate(d, 1)) days.push(d);
  const atStart = month <= monthOf(min);
  const end = to || from;
  return (
    <div className="range-calendar">
      <div className="range-month">
        <button
          className="icon-button"
          aria-label="Previous month"
          disabled={atStart}
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <Icon name="back" size={16} />
        </button>
        <strong aria-live="polite">{MONTH.format(at(month))}</strong>
        <button
          className="icon-button range-next"
          aria-label="Next month"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <Icon name="back" size={16} />
        </button>
      </div>
      <div className="range-grid" role="group" aria-label="Days">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="range-weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {days.map((day, i) => {
          const inRange = from && day >= from && day <= end;
          const edge = day === from || day === end;
          return (
            <button
              key={day}
              className="range-day"
              style={i === 0 ? { gridColumnStart: lead + 1 } : undefined}
              disabled={day < min}
              data-in={inRange || undefined}
              data-edge={edge || undefined}
              data-start={(from && day === from && to && to !== from) || undefined}
              data-end={(to && day === to && to !== from) || undefined}
              aria-pressed={Boolean(inRange)}
              aria-label={DAY_NAME.format(at(day))}
              onClick={() => onChange(pickDay({ from, to }, day))}
            >
              <span>{Number(day.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
