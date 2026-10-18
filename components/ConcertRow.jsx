import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon, Modal, focusFirstItem, shareText } from "../ui.jsx";
import { concertAge, easternToday, requestAge, subscribeAges } from "../concerts.js";
import { addToCalendar, calendarIsNative, downloadIcs, googleCalendarUrl } from "../calendar.js";
import { showToast } from "../toast.js";
import { MenuHead, MenuItem, MenuSave, SaveButton, shareFrom } from "./MusicRows.jsx";
import { holdable, openHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { CALENDAR_URL } from "../links.js";
import { shiftDate } from "../time.js";

// Age limits arrive one by one; each row listens for its own, so one arriving
// re-renders one row, not the list.
function useAge(concert) {
  useEffect(() => requestAge(concert), [concert]);
  return useSyncExternalStore(subscribeAges, () => concertAge(concert));
}

// Built once: formatting dates is the costly part of drawing a list.
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
// Midday, so the date never shifts across a timezone boundary when shown.
const dateOf = (c) => new Date(`${c.date}T12:00:00`);

// A day's heading: "Tonight", "Tomorrow", then "Wed, Oct 7" (Eastern dates,
// as the calendar's are).
export function dayHeading(date, today = easternToday()) {
  if (date === today) return "Tonight";
  if (date === shiftDate(today, 1)) return "Tomorrow";
  return DAY.format(new Date(`${date}T12:00:00`));
}

// The phone's own calendar sheet.
async function addNatively(concert) {
  if (!(await addToCalendar(concert)))
    showToast("Couldn’t open your calendar. Allow calendar access for WXPN in Settings.");
}

// Add to calendar: the system sheet in the phone apps; in a browser, a
// choice of calendar file or Google Calendar, in a menu from the button.
function AddToCalendar({ concert, className }) {
  const menuId = `cal-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const drag = useSheetDrag();
  const words = (
    <>
      <Icon name="calendarAdd" size={18} />
      Add to calendar
    </>
  );
  if (calendarIsNative()) {
    return (
      <button className={className} onClick={() => addNatively(concert)}>
        {words}
      </button>
    );
  }
  const close = () => document.getElementById(menuId)?.hidePopover();
  return (
    <>
      <button className={className} popoverTarget={menuId} style={{ anchorName: `--${menuId}` }}>
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
const shareArgs = (c) => [
  c.artist,
  [`${c.artist}, ${FULL_DATE.format(dateOf(c))}`, c.venue].filter(Boolean).join(" · "),
  c.pageUrl || c.ticketUrl || CALENDAR_URL,
];

// Where: the venue and its town (the region when the calendar names no
// town). The dot stays with the word before it, so a line never starts
// with one.
const whereOf = (c) => [c.venue, c.city || c.region].filter(Boolean).join(" · ");

// WXPN Welcomes and Free at Noon, the station's own shows.
function Flags({ concert: c }) {
  if (!c.xpnWelcomes && !c.freeAtNoon) return null;
  return (
    <span className="concert-flags">
      {c.xpnWelcomes && (
        <span className="concert-welcomes">
          <Icon name="star" size={12} />
          WXPN Welcomes
        </span>
      )}
      {c.freeAtNoon && <span>Free at Noon</span>}
    </span>
  );
}

// A concert's sheet: its photo, who, when and where, then Tickets, the
// calendar, Share and Save. Escape, Back, a tap outside and a pull down
// close it, as they close a show's.
function ConcertSheet({ concert: c, age, onClose }) {
  const [photo, setPhoto] = useState(Boolean(c.image));
  return createPortal(
    <Modal title={c.artist} onClose={onClose} className="concert-sheet">
      <div className="detail-body concert-sheet-body">
        {photo && (
          <img className="concert-photo" src={c.image} alt="" onError={() => setPhoto(false)} />
        )}
        <Flags concert={c} />
        <p className="concert-sheet-when">{FULL_DATE.format(dateOf(c))}</p>
        {(whereOf(c) || age) && (
          <p className="concert-meta">
            {whereOf(c)}
            {age && <span className="concert-age">{age}</span>}
          </p>
        )}
        <div className="concert-sheet-actions">
          {c.ticketUrl && (
            <a className="primary-button" href={c.ticketUrl} target="_blank" rel="noreferrer">
              Tickets
            </a>
          )}
          <AddToCalendar concert={c} className="secondary-button" />
          <button
            className="secondary-button"
            onClick={async () => showToast(await shareText(...shareArgs(c)))}
          >
            <Icon name="shareAlt" size={18} />
            Share
          </button>
          <SaveButton
            type="concerts"
            item={c}
            name={`${c.artist} concert`}
            className="secondary-button"
          >
            {(saved) => (saved ? "Saved" : "Save")}
          </SaveButton>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}

// A concert in a list: who (and the station's own shows over it), where and
// the age limit. The row opens its sheet; press and hold opens its menu; the
// heart, at its end, saves it.
export function ConcertRow({ concert: c }) {
  const age = useAge(c);
  const [open, setOpen] = useState(false);
  const where = whereOf(c);
  const when = FULL_DATE.format(dateOf(c));
  const hold = holdable(() =>
    openHoldMenu({
      label: `${c.artist}, ${when}`,
      render: (close) => (
        <>
          <MenuHead title={c.artist} line={[when, c.venue].filter(Boolean).join(" · ")} />
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
          <MenuItem icon="shareAlt" onClick={shareFrom(close, ...shareArgs(c))}>
            Share concert
          </MenuItem>
        </>
      ),
    }),
  );
  return (
    <div className="concert-row">
      <button
        ref={hold}
        className="concert-open"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Flags concert={c} />
        {/* "Artist / Artist": a line never starts with the slash. */}
        <strong>{c.artist.replace(/ \/ /g, " / ")}</strong>
        {(where || age) && (
          <span className="concert-meta">
            {where}
            {age && <span className="concert-age">{age}</span>}
          </span>
        )}
        <span className="sr-only">, {when}</span>
      </button>
      <SaveButton type="concerts" item={c} name={`${c.artist} concert`} />
      {open && <ConcertSheet concert={c} age={age} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Concerts under a heading for each day, which stays at the top while its
// day's concerts scroll under it.
export function ConcertList({ concerts }) {
  const today = easternToday();
  const days = [];
  for (const c of concerts) {
    let day = days[days.length - 1];
    if (day?.date !== c.date) days.push((day = { date: c.date, concerts: [] }));
    day.concerts.push(c);
  }
  return days.map((day) => (
    <section key={day.date} className="concert-day" aria-labelledby={`day-${day.date}`}>
      <h2 id={`day-${day.date}`} className="concert-day-head">
        <span>{dayHeading(day.date, today)}</span>
      </h2>
      {day.concerts.map((c) => (
        <ConcertRow key={c.id} concert={c} />
      ))}
    </section>
  ));
}
