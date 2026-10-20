import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon, Modal, focusFirstItem, shareText } from "../ui.jsx";
import {
  concertAge,
  concertPlace,
  easternToday,
  requestAge,
  splitBill,
  subscribeAges,
} from "../concerts.js";
import { addToCalendar, calendarIsNative, downloadIcs, googleCalendarUrl } from "../calendar.js";
import { showToast } from "../toast.js";
import { MenuHead, MenuItem, MenuSave, SaveButton, shareFrom } from "./MusicRows.jsx";
import { holdable, openHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { CALENDAR_URL } from "../links.js";
import { clockLabel, shiftDate } from "../time.js";
import { closeConcert, openConcert, useConcertOpen } from "../hooks/useRoute.js";

// Age limits arrive one by one; each row listens for its own, so one arriving
// re-renders one row, not the list.
function useAge(concert) {
  useEffect(() => requestAge(concert), [concert]);
  return useSyncExternalStore(subscribeAges, () => concertAge(concert));
}

// Built once: formatting dates is the costly part of drawing a list.
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
// Midday, so the date never shifts across a timezone boundary when shown.
const dateOf = (c) => new Date(`${c.date}T12:00:00`);

// A day's heading, in two parts: the day as a word ("Tonight", "Tomorrow",
// then the weekday, "Wednesday") and its date ("Oct 21", with the year only
// when it isn't this one). Eastern dates, as the calendar's are.
function dayHeading(date, today = easternToday()) {
  const day = new Date(`${date}T12:00:00`);
  const word =
    date === today ? "Tonight" : date === shiftDate(today, 1) ? "Tomorrow" : WEEKDAY.format(day);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return { word, date: (sameYear ? MONTH_DAY : MONTH_DAY_YEAR).format(day) };
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
function CalendarFileItems({ concert, close }) {
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

// Where, and who may come: the venue, its town (or a region other than the
// Philadelphia area) and the age limit, as one plain muted line. The dot
// stays with the word before it, so a line never starts with one.
const whereOf = (c, age) => [c.venue, concertPlace(c), age].filter(Boolean).join("\u00a0\u00b7 ");

// The acts supporting the headliner, as a line under it: "with Ioanna Gika,
// Wayne Faler".
function Support({ acts }) {
  if (!acts.length) return null;
  return (
    <span className="concert-support">
      <span className="concert-with">with </span>
      {acts.join(", ")}
    </span>
  );
}

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
function ConcertSheet({ concert: c, bill, age, onClose }) {
  const [photo, setPhoto] = useState(Boolean(c.image));
  const where = whereOf(c, age);
  return createPortal(
    <Modal title={bill.headliner || c.artist} onClose={onClose} className="concert-sheet" routed>
      <div className="detail-body concert-sheet-body">
        {photo && (
          <img className="concert-photo" src={c.image} alt="" onError={() => setPhoto(false)} />
        )}
        <Flags concert={c} />
        <Support acts={bill.support} />
        <p className="concert-sheet-when">
          {FULL_DATE.format(dateOf(c))}
          {c.time && ` at ${clockLabel(c.time)}`}
        </p>
        {!c.time && <p className="concert-meta">Times are on the venue's listing.</p>}
        {where && <p className="concert-meta">{where}</p>}
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
            Share<span className="sr-only"> {c.artist}</span>
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

// A concert in a list: the station's own shows credited over the
// headliner, the acts supporting it, then where and who may come. The row
// opens its sheet; press and hold opens its menu; the heart, at its end,
// saves it.
export function ConcertRow({ concert: c }) {
  const age = useAge(c);
  // Open by address (#/concerts/concert/<id>), so Back closes it and a link
  // opens it.
  const open = useConcertOpen(c.id);
  const bill = splitBill(c.artist);
  const where = whereOf(c, age);
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
        onClick={() => openConcert(c.id)}
      >
        <Flags concert={c} />
        <strong>{bill.headliner || c.artist}</strong>
        <Support acts={bill.support} />
        {where && <span className="concert-meta">{where}</span>}
        <span className="sr-only">, {when}</span>
      </button>
      <SaveButton type="concerts" item={c} name={`${c.artist} concert`} />
      {open && <ConcertSheet concert={c} bill={bill} age={age} onClose={closeConcert} />}
    </div>
  );
}

// Concerts under a heading for each day: the day as a word in ink and its
// date muted, larger than anything in the rows, and set off from the day
// before by space and the list's only rule. It stays at the top while its
// day's concerts scroll under it; on wide screens it sits in a column of
// its own beside them.
// `aside`: a quiet note at the end of the first day's heading (on Concerts,
// how many are listed), set apart from the day as "All times Eastern" is on
// the schedule.
export function ConcertList({ concerts, aside = null }) {
  const today = easternToday();
  // Favorites and Concerts both draw a list, and both stay in the page:
  // each list's headings get ids of their own.
  const list = useId();
  const days = [];
  for (const c of concerts) {
    let day = days[days.length - 1];
    if (day?.date !== c.date) days.push((day = { date: c.date, concerts: [] }));
    day.concerts.push(c);
  }
  return days.map((day, i) => {
    const head = dayHeading(day.date, today);
    return (
      <section key={day.date} className="concert-day" aria-labelledby={`${list}-${day.date}`}>
        <div className="concert-day-head">
          <div className="day-bar">
            <h2 id={`${list}-${day.date}`}>
              <span className="day-word">{head.word}</span>{" "}
              <span className="day-date">{head.date}</span>
            </h2>
            {i === 0 && aside && <div className="day-aside">{aside}</div>}
          </div>
        </div>
        <div className="concert-day-rows">
          {day.concerts.map((c) => (
            <ConcertRow key={c.id} concert={c} />
          ))}
        </div>
      </section>
    );
  });
}
