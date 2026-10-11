import { useEffect, useId, useSyncExternalStore } from "react";
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
  // The visible words, then the artist for screen readers, so voice control
  // users can say what they see.
  const words = (
    <>
      <Icon name="calendarAdd" size={15} />
      Add to calendar<span className="sr-only">: {concert.artist}</span>
    </>
  );
  if (calendarIsNative()) {
    return (
      <button
        className="concert-action"
        onClick={async () => {
          if (!(await addToCalendar(concert)))
            showToast("Couldn’t open your calendar. Allow calendar access for WXPN in Settings.");
        }}
      >
        {words}
      </button>
    );
  }
  const close = () => document.getElementById(menuId)?.hidePopover();
  return (
    <>
      <button
        className="concert-action"
        popoverTarget={menuId}
        style={{ anchorName: `--${menuId}` }}
      >
        {words}
      </button>
      <div
        id={menuId}
        onToggle={focusFirstItem}
        className="popover-menu"
        popover="auto"
        role="dialog"
        aria-label={`Add ${concert.artist} to your calendar`}
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

export function ConcertRow({ concert: c }) {
  const age = useAge(c);
  // Midday avoids the date shifting across a timezone boundary when shown.
  const date = new Date(`${c.date}T12:00:00`);
  const Info = c.pageUrl ? "a" : "div";
  // Where: the venue and its town (the region when the calendar names no
  // town). The dot stays with the word before it, so a line never starts
  // with one.
  const where = [c.venue, c.city || c.region].filter(Boolean).join("\u00a0· ");
  return (
    <div className="concert-row" data-welcomes={c.xpnWelcomes || undefined}>
      {/* The station's own shows carry a banner across the top. */}
      {c.xpnWelcomes && (
        <p className="concert-banner" aria-hidden="true">
          <Icon name="star" size={13} />
          WXPN Welcomes
        </p>
      )}
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
          <span className="sr-only">
            {c.xpnWelcomes && "WXPN Welcomes. "}
            {FULL_DATE.format(date)}:
          </span>
          {c.freeAtNoon && <span className="concert-tag">Free at Noon</span>}
          {/* "Artist / Artist": a line never starts with the slash. */}
          <h2>{c.artist.replace(/ \/ /g, "\u00a0/ ")}</h2>
          {(where || age) && (
            <p className="concert-meta">
              {where}
              {age && <span className="concert-age">{age}</span>}
            </p>
          )}
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
}
