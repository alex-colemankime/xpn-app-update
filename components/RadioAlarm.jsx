import { useRef } from "react";
import { ChoiceSetting, Icon, Switch } from "../ui.jsx";
import { DAY_LABELS, SNOOZE_OPTIONS } from "../alarm.js";
import { notificationsAreNative } from "../notifications.js";
import { VOLUME_SETTABLE } from "../player.js";
import { STATION_OPTIONS } from "../streams.js";

const SNOOZE_CHOICES = SNOOZE_OPTIONS.map((n) => ({ value: n, label: `${n} min` }));

// "07:00" as hours and minutes; anything unreadable is midnight.
const hoursAndMinutes = (time) => {
  const [h, m] = String(time || "0:0")
    .split(":")
    .map(Number);
  return [h || 0, m || 0];
};

// A clock face whose hands show a "HH:MM" time.
function ClockFace({ time }) {
  const [h, m] = hoursAndMinutes(time);
  const minute = m * 6;
  const hour = (h % 12) * 30 + m / 2;
  return (
    <svg className="clock-face" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" />
      {[0, 90, 180, 270].map((a) => (
        <line
          key={a}
          className="clock-tick"
          x1="20"
          y1="5.5"
          x2="20"
          y2="8"
          transform={`rotate(${a} 20 20)`}
        />
      ))}
      <line
        className="clock-hour"
        x1="20"
        y1="20"
        x2="20"
        y2="11.5"
        style={{ rotate: `${hour}deg` }}
      />
      <line
        className="clock-minute"
        x1="20"
        y1="20"
        x2="20"
        y2="7.5"
        style={{ rotate: `${minute}deg` }}
      />
      <circle className="clock-pin" cx="20" cy="20" r="1.6" />
    </svg>
  );
}

// "07:00" as the listener's clock writes it: ["7:00", "AM"] (or ["07:00", ""]
// where clocks run to 24 hours).
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
function clockParts(time) {
  const [h, m] = hoursAndMinutes(time);
  const parts = TIME_FORMAT.formatToParts(new Date(2000, 0, 1, h, m));
  const period = parts.find((p) => p.type === "dayPeriod")?.value || "";
  const clock = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  return [clock, period];
}

// The alarm time, large, with a clock face set to it; tapping the face opens
// the system time picker. The time is shown as the clock writes it ("7:00",
// with a smaller "AM"); the native field takes over while it is being edited.
function AlarmTime({ time, onChange }) {
  const input = useRef(null);
  const [clock, period] = clockParts(time);
  const openPicker = () => {
    try {
      input.current.showPicker();
    } catch {
      input.current.focus();
    }
  };
  return (
    <div className="alarm-time">
      <label className="eyebrow" htmlFor="alarm-time">
        Alarm time · your local time
      </label>
      <div className="alarm-time-row">
        <span className="alarm-time-field">
          <input
            id="alarm-time"
            ref={input}
            type="time"
            value={time}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            required
          />
          <span className="alarm-time-display" aria-hidden="true">
            {clock}
            {period && <small>{period}</small>}
          </span>
        </span>
        <button
          type="button"
          className="clock-button"
          onClick={openPicker}
          tabIndex={-1}
          aria-hidden="true"
        >
          <ClockFace time={time} />
        </button>
      </div>
    </div>
  );
}

// The radio alarm's settings: on or off, when, which days, which station.
export function RadioAlarmPanel({ alarm, updateAlarm, onEnabled, onTest }) {
  const toggleDay = (id) =>
    updateAlarm({
      repeatDays: alarm.repeatDays.includes(id)
        ? alarm.repeatDays.filter((x) => x !== id)
        : [...alarm.repeatDays, id].sort(),
    });
  return (
    <section className="settings-panel">
      <div className="section-heading">
        <h2>
          <Icon name="clock" />
          Radio alarm
        </h2>
        <Switch on={alarm.enabled} onChange={onEnabled} label="Enable radio alarm" />
      </div>
      <AlarmTime time={alarm.time} onChange={(time) => updateAlarm({ time })} />
      <div className="repeat-days" role="group" aria-label="Repeat alarm on">
        {DAY_LABELS.map((d) => (
          <button
            key={d.id}
            aria-label={d.label}
            aria-pressed={alarm.repeatDays.includes(d.id)}
            className={alarm.repeatDays.includes(d.id) ? "active" : ""}
            onClick={() => toggleDay(d.id)}
          >
            {d.label.slice(0, 3)}
          </button>
        ))}
      </div>
      {!alarm.repeatDays.length && (
        <p className="data-note">Select at least one day for the alarm to ring.</p>
      )}
      <ChoiceSetting
        label="Wake up to"
        value={alarm.streamId}
        onChange={(streamId) => updateAlarm({ streamId })}
        options={STATION_OPTIONS}
      />
      <ChoiceSetting
        label="Snooze for"
        value={alarm.snoozeMinutes}
        onChange={(snoozeMinutes) => updateAlarm({ snoozeMinutes })}
        options={SNOOZE_CHOICES}
      />
      {VOLUME_SETTABLE && (
        <label className="setting-row">
          <span>
            Alarm volume <small>{alarm.volume}%</small>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={alarm.volume}
            onChange={(e) => updateAlarm({ volume: +e.target.value })}
          />
        </label>
      )}
      <button className="secondary-button" onClick={onTest}>
        <Icon name="play" size={17} />
        Test alarm sound
      </button>
      <p className="data-note">
        {notificationsAreNative()
          ? "The alarm arrives as a notification, even with the app closed. Tap it to start the station."
          : "Keep WXPN open and your screen on for the alarm to play. The iPhone and Android apps can wake you with the app closed."}
      </p>
    </section>
  );
}
