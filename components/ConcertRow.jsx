import { memo, useEffect, useId, useSyncExternalStore } from "react";
import { Icon, focusFirstItem } from "../ui.jsx";
import { concertAge, requestAge, subscribeAges } from "../concerts.js";
import { addToCalendar, calendarIsNative, downloadIcs, googleCalendarUrl } from "../calendar.js";
import { showToast } from "../toast.js";
import { SaveButton } from "./MusicRows.jsx";

// Age limits arrive one by one; each row listens for its own, so one arriving
// re-renders one row, not the list.
function useAge(concert) {
  useEffect(() => requestAge(concert), [concert]);
  return useSyncExternalStore(subscribeAges, () => concertAge(concert));
}

// Built once: formatting dates is the costly part of drawing a row.
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// Any concert can go in the listener's calendar: the system sheet in the
// phone apps; in a browser, a choice of calendar file or Google Calendar.
function AddToCalendar({ concert }) {
  const menuId = `cal-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const label = `Add ${concert.artist} to your calendar`;
  if (calendarIsNative()) {
    return (
      <button
        className="concert-action"
        aria-label={label}
        onClick={async () => {
          if (!(await addToCalendar(concert)))
            showToast("Couldn’t open your calendar. Allow calendar access for WXPN in Settings.");
        }}
      >
        <Icon name="calendarAdd" size={15} />
        Add to calendar
      </button>
    );
  }
  const close = () => document.getElementById(menuId)?.hidePopover?.();
  return (
    <>
      <button
        className="concert-action"
        popoverTarget={menuId}
        aria-label={label}
        style={{ anchorName: `--${menuId}` }}
      >
        <Icon name="calendarAdd" size={15} />
        Add to calendar
      </button>
      <div
        id={menuId}
        onToggle={focusFirstItem}
        className="popover-menu"
        popover="auto"
        role="dialog"
        aria-label={label}
        style={{ positionAnchor: `--${menuId}` }}
      >
        <div className="popover-menu-head">
          <span>
            <strong>Add to calendar</strong>
            <small>{concert.artist}</small>
          </span>
        </div>
        <button
          onClick={() => {
            close();
            downloadIcs([concert]);
          }}
        >
          Apple Calendar or Outlook
          <Icon name="calendarAdd" size={16} />
        </button>
        <a href={googleCalendarUrl(concert)} target="_blank" rel="noreferrer" onClick={close}>
          Google Calendar
        </a>
      </div>
    </>
  );
}

export const ConcertRow = memo(function ConcertRow({ concert: c }) {
  const age = useAge(c);
  // Midday avoids the date shifting across a timezone boundary when shown.
  const date = new Date(`${c.date}T12:00:00`);
  const Info = c.pageUrl ? "a" : "div";
  return (
    <div className="concert-row">
      <div className="concert-date" aria-hidden="true">
        <span>{MONTH.format(date)}</span>
        <strong>{date.getDate()}</strong>
        <small>{WEEKDAY.format(date)}</small>
      </div>
      <div className="concert-body">
        <Info
          className="concert-info"
          {...(c.pageUrl ? { href: c.pageUrl, target: "_blank", rel: "noreferrer" } : {})}
        >
          <span className="sr-only">{FULL_DATE.format(date)}:</span>
          {(c.xpnWelcomes || c.freeAtNoon) && (
            <span className="concert-tags">
              {c.freeAtNoon && <span>Free at Noon</span>}
              {c.xpnWelcomes && <span>WXPN Welcomes</span>}
            </span>
          )}
          <h2>{c.artist}</h2>
          <p className="concert-meta">{[c.venue, c.region, age].filter(Boolean).join(" · ")}</p>
        </Info>
        <div className="concert-actions">
          {c.ticketUrl && (
            <a
              className="concert-action"
              href={c.ticketUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Tickets for ${c.artist}`}
            >
              Tickets
            </a>
          )}
          <AddToCalendar concert={c} />
        </div>
      </div>
      <SaveButton type="concerts" item={c} name={`${c.artist} concert`} />
    </div>
  );
});
