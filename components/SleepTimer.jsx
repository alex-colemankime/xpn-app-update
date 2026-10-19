import { cancelSleepTimer, sleepUntil, startSleepTimer } from "../player.js";
import { onAirAt } from "../catalog.js";
import { localClock } from "../time.js";
import { Icon, focusFirstItem } from "../ui.jsx";
import { usePlayer, useSleepTimer } from "../hooks/usePlayer.js";
import { useNow } from "../hooks/useNow.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";

// Each choice as the menu says it.
const SLEEP_CHOICES = [
  { minutes: 15, label: "In 15 minutes" },
  { minutes: 30, label: "In 30 minutes" },
  { minutes: 45, label: "In 45 minutes" },
  { minutes: 60, label: "In an hour" },
];

// Stop playback after a while, fading out; lives in a popover so it needs no
// screen of its own. Only offered while there is audio to stop.
export function SleepTimer({ onAirNow }) {
  const endsAt = useSleepTimer();
  const now = useNow();
  const { playing, connecting } = usePlayer();
  const drag = useSheetDrag();
  if (!endsAt && !playing && !connecting) return null;
  const left = endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60000)) : 0;
  const close = () => document.getElementById("sleep-menu")?.hidePopover?.();
  const choose = (minutes) => {
    startSleepTimer(minutes);
    close();
  };
  // Worked out at the tap, from the clock and the show's real end time, so
  // a menu opened a moment ago can't stop a minute into the next show.
  const untilShowEnds = () => {
    const live = onAirAt();
    close();
    if (!live) return;
    sleepUntil(live.endsAt);
  };
  return (
    <>
      <button
        className={`text-button sleep-button ${endsAt ? "active" : ""}`}
        popoverTarget="sleep-menu"
      >
        <Icon name="moon" size={16} />
        {endsAt ? (
          <>
            Off in {left} min<span className="sr-only">, sleep timer. Change</span>
          </>
        ) : (
          "Sleep timer"
        )}
      </button>
      <div
        id="sleep-menu"
        ref={drag}
        onToggle={focusFirstItem}
        className="popover-menu sleep-menu"
        popover="auto"
        role="dialog"
        aria-labelledby="sleep-title"
      >
        {/* A menu like a song's: a heading that says what it does, then
            the choices as plain rows, the end of the show on the air last,
            with its time. */}
        <div className="popover-menu-head">
          <span>
            <strong id="sleep-title">Turn the radio off</strong>
            {endsAt && <small>Now in {left} min. Pick a new time, or cancel.</small>}
          </span>
        </div>
        {SLEEP_CHOICES.map((c) => (
          <button key={c.minutes} onClick={() => choose(c.minutes)}>
            {c.label}
          </button>
        ))}
        {onAirNow && (
          <button className="sleep-show" onClick={untilShowEnds}>
            When {onAirNow.show.name} ends
            <small>{localClock(onAirNow.endsAt)}</small>
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
