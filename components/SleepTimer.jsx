import { cancelSleepTimer, sleepUntil, startSleepTimer } from "../player.js";
import { onAirAt } from "../catalog.js";
import { localClock } from "../time.js";
import { showToast } from "../toast.js";
import { Art, Icon, focusFirstItem } from "../ui.jsx";
import { usePlayer, useSleepTimer } from "../hooks/usePlayer.js";
import { useNow } from "../hooks/useNow.js";

// Each choice as the menu shows it (a large number over its unit) and as it
// is said aloud and in the confirmation.
const SLEEP_CHOICES = [
  { minutes: 15, number: "15", unit: "min", said: "15 minutes" },
  { minutes: 30, number: "30", unit: "min", said: "30 minutes" },
  { minutes: 45, number: "45", unit: "min", said: "45 minutes" },
  { minutes: 60, number: "1", unit: "hour", said: "an hour" },
];

// Stop playback after a while, fading out; lives in a popover so it needs no
// screen of its own. Only offered while there is audio to stop.
export function SleepTimer({ onAirNow }) {
  const endsAt = useSleepTimer();
  const now = useNow();
  const { playing, connecting } = usePlayer();
  if (!endsAt && !playing && !connecting) return null;
  const left = endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60000)) : 0;
  const close = () => document.getElementById("sleep-menu")?.hidePopover?.();
  const choose = (minutes, label) => {
    startSleepTimer(minutes);
    close();
    showToast(`The radio will turn off ${label}.`);
  };
  // Worked out at the tap, from the clock and the show's real end time, so
  // a menu opened a moment ago can't stop a minute into the next show.
  const untilShowEnds = () => {
    const live = onAirAt();
    close();
    if (!live) return;
    sleepUntil(live.endsAt);
    showToast(`The radio will turn off when ${live.show.name} ends.`);
  };
  return (
    <>
      <button
        className={`text-button sleep-button ${endsAt ? "active" : ""}`}
        popoverTarget="sleep-menu"
        aria-label={
          endsAt ? `Sleep timer: the radio turns off in ${left} minutes. Change` : "Sleep timer"
        }
      >
        <Icon name="moon" size={16} />
        {endsAt ? `Off in ${left} min` : "Sleep timer"}
      </button>
      <div
        id="sleep-menu"
        onToggle={focusFirstItem}
        className="popover-menu sleep-menu"
        popover="auto"
        role="dialog"
        aria-labelledby="sleep-title"
      >
        <div className="sleep-head">
          <p id="sleep-title" className="sleep-title">
            <Icon name="moon" size={18} />
            Sleep timer
          </p>
          <p className="sleep-sub">
            {endsAt
              ? `The radio turns off in ${left} min. Pick a new time, or cancel.`
              : "Turn the radio off in"}
          </p>
        </div>
        <div className="sleep-grid">
          {SLEEP_CHOICES.map((c) => (
            <button
              key={c.minutes}
              aria-label={c.said === "an hour" ? "1 hour" : c.said}
              onClick={() => choose(c.minutes, `in ${c.said}`)}
            >
              <strong>{c.number}</strong>
              <small>{c.unit}</small>
            </button>
          ))}
        </div>
        {onAirNow && (
          <button className="sleep-show" onClick={untilShowEnds}>
            <Art src={onAirNow.show.img} alt="" />
            <span>
              <strong>When {onAirNow.show.name} ends</strong>
              <small>at {localClock(onAirNow.endsAt)}</small>
            </span>
          </button>
        )}
        {endsAt && (
          <button
            className="sleep-off"
            onClick={() => {
              cancelSleepTimer();
              close();
            }}
          >
            Cancel timer
          </button>
        )}
      </div>
    </>
  );
}
