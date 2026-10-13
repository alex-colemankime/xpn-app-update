import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Icon, focusFirstItem, shareText } from "../ui.jsx";
import { concertAge, requestAge, subscribeAges } from "../concerts.js";
import { addToCalendar, calendarIsNative, downloadIcs, googleCalendarUrl } from "../calendar.js";
import { showToast } from "../toast.js";
import {
  HeartBloom,
  heartItem,
  MenuHead,
  MenuItem,
  MenuSave,
  SaveButton,
  shareFrom,
} from "./MusicRows.jsx";
import { holdable, openHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { noDoubleClickSelect, useDoubleTap } from "../hooks/useDoubleTap.js";
import { CALENDAR_URL } from "../links.js";

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

// The phone's own calendar sheet.
async function addNatively(concert) {
  if (!(await addToCalendar(concert)))
    showToast("Couldn’t open your calendar. Allow calendar access for WXPN in Settings.");
}

// Any concert can go in the listener's calendar: the system sheet in the
// phone apps; in a browser, a choice of calendar file or Google Calendar.
function AddToCalendar({ concert }) {
  const menuId = `cal-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const drag = useSheetDrag();
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
      <button className="concert-action" onClick={() => addNatively(concert)}>
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
        ref={drag}
        onToggle={focusFirstItem}
        className="popover-menu"
        popover="auto"
        role="dialog"
        aria-label={`Add ${concert.artist} to your calendar`}
        style={{ positionAnchor: `--${menuId}` }}
      >
        <MenuHead title="Add to calendar" line={concert.artist} />
        <CalendarFileItems concert={concert} close={close} />
      </div>
    </>
  );
}

// The ways into a calendar in a browser: a file for Apple Calendar or
// Outlook, or Google Calendar's own page.
export function CalendarFileItems({ concert, close }) {
  return (
    <>
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
    </>
  );
}

// What sharing a concert sends: who, when and where, and its page on
// xpn.org (its tickets, or the calendar, when it has none).
const shareArgs = (c, date) => [
  c.artist,
  [`${c.artist}, ${FULL_DATE.format(date)}`, c.venue].filter(Boolean).join(" · "),
  c.pageUrl || c.ticketUrl || CALENDAR_URL,
];

// A concert in a list. Nothing in it leaves the app but Tickets (and the
// calendar choices): a tap on the concert itself does nothing, a double tap
// saves it, as a double tap on Listen's artwork saves the song, and press
// and hold opens its menu. The heart and Share sit at its end.
export function ConcertRow({ concert: c }) {
  const age = useAge(c);
  // Midday avoids the date shifting across a timezone boundary when shown.
  const date = new Date(`${c.date}T12:00:00`);
  const [bloom, setBloom] = useState(0);
  const onPointerUp = useDoubleTap(() => {
    heartItem("concerts", c);
    setBloom((n) => n + 1);
  });
  // Where: the venue and its town (the region when the calendar names no
  // town). The dot stays with the word before it, so a line never starts
  // with one.
  const where = [c.venue, c.city || c.region].filter(Boolean).join("\u00a0· ");
  // Press and hold: save, tickets, the calendar, share.
  const hold = holdable(() =>
    openHoldMenu({
      label: `${c.artist}, ${FULL_DATE.format(date)}`,
      render: (close) => (
        <>
          <MenuHead
            title={c.artist}
            line={[FULL_DATE.format(date), c.venue].filter(Boolean).join(" · ")}
          />
          <MenuSave type="concerts" item={c} name={`${c.artist} concert`} close={close} />
          {c.ticketUrl && (
            <a href={c.ticketUrl} target="_blank" rel="noreferrer" onClick={close}>
              Tickets
            </a>
          )}
          {calendarIsNative() ? (
            <MenuItem
              icon="calendarAdd"
              onClick={() => {
                close();
                addNatively(c);
              }}
            >
              Add to calendar
            </MenuItem>
          ) : (
            <CalendarFileItems concert={c} close={close} />
          )}
          <MenuItem icon="shareAlt" onClick={shareFrom(close, ...shareArgs(c, date))}>
            Share concert
          </MenuItem>
        </>
      ),
    }),
  );
  return (
    <div
      ref={hold}
      className="concert-row"
      onPointerUp={onPointerUp}
      onMouseDown={noDoubleClickSelect}
    >
      <div className="concert-date" aria-hidden="true">
        <span>{MONTH.format(date)}</span>
        <strong>{date.getDate()}</strong>
        <small>{WEEKDAY.format(date)}</small>
      </div>
      <div className="concert-body">
        <div className="concert-info">
          <span className="sr-only">{FULL_DATE.format(date)}:</span>
          {/* The station's own shows: a starred line over the artist. */}
          {(c.xpnWelcomes || c.freeAtNoon) && (
            <span className="concert-flags">
              {c.xpnWelcomes && (
                <span className="concert-welcomes">
                  <Icon name="star" size={12} />
                  WXPN Welcomes
                </span>
              )}
              {c.freeAtNoon && <span>Free at Noon</span>}
            </span>
          )}
          {/* "Artist / Artist": a line never starts with the slash. */}
          <h2>{c.artist.replace(/ \/ /g, "\u00a0/ ")}</h2>
          {(where || age) && (
            <p className="concert-meta">
              {where}
              {age && <span className="concert-age">{age}</span>}
            </p>
          )}
        </div>
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
      <div className="concert-side">
        <SaveButton type="concerts" item={c} name={`${c.artist} concert`} />
        <button
          className="icon-button concert-share"
          aria-label={`Share ${c.artist} concert`}
          onClick={async () => showToast(await shareText(...shareArgs(c, date)))}
        >
          <Icon name="shareAlt" size={19} />
        </button>
      </div>
      <HeartBloom type="concerts" item={c} bloom={bloom} onEnd={() => setBloom(0)} size={64} />
    </div>
  );
}
