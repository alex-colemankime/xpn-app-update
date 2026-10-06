import { useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { ChoiceSetting, Icon, Segmented, nameList } from "../ui.jsx";
import { DAY_LABELS, SNOOZE_OPTIONS } from "../alarm.js";
import { setVolume } from "../player.js";
import { STREAMS } from "../streams.js";
import { usePlayer, useVolume, chooseAudioOutput } from "../hooks/usePlayer.js";
import {
  disableReminders,
  enableReminders,
  setReminderLead,
  useReminderSettings,
} from "../hooks/useShowReminders.js";
import { notificationsAreNative } from "../notifications.js";
import { setAlert, useAlertSettings } from "../hooks/useStationAlerts.js";
import { PlaylistSyncPanel } from "../components/PlaylistSync.jsx";
import { NewsletterPanel } from "../components/Newsletter.jsx";
import { CONCERTS_ENABLED } from "../config.js";
import { CALENDAR_URL, DONATE_URL, PRIVACY_URL, STATION_EMAIL } from "../links.js";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import { LEAD_OPTIONS } from "../reminders.js";

function ShowReminders({ onNavigate }) {
  const settings = useReminderSettings();
  // Only shows with a place in the FM schedule can be reminded about.
  const followed = useFavoriteItems("shows").filter((s) => SHOWS[s.id]?.schedule?.length);
  return (
    <section className="settings-panel">
      <div className="section-heading">
        <h2>
          <Icon name="bell" />
          Show reminders
        </h2>
        <button
          className={`switch ${settings.enabled ? "checked" : ""}`}
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Remind me before shows I follow"
          onClick={() => (settings.enabled ? disableReminders() : enableReminders())}
        >
          <span />
        </button>
      </div>
      {followed.length ? (
        <p className="data-note">For {nameList(followed.map((s) => s.name))}.</p>
      ) : (
        <>
          <p className="data-note">Follow a show to get a reminder before it starts.</p>
          <button className="secondary-button" onClick={() => onNavigate("shows")}>
            Find shows to follow
            <Icon name="arrowRight" size={17} />
          </button>
        </>
      )}
      <ChoiceSetting
        label="Remind me"
        value={settings.lead}
        disabled={!settings.enabled}
        onChange={setReminderLead}
        options={LEAD_OPTIONS.map((m) => ({
          value: m,
          label: m ? `${m} min before` : "At the start",
        }))}
      />
      <p className="data-note">
        {notificationsAreNative()
          ? "Reminders arrive even when the app is closed."
          : "In a browser, reminders appear while WXPN is open. The iPhone and Android apps remind you any time."}
      </p>
    </section>
  );
}

// One kind of notification from the station, with what it is and when it
// comes beside its switch: the consent the App Store asks for (4.5.4).
function AlertSwitch({ topic, on, title, children }) {
  const id = `alert-${topic}`;
  return (
    <div className="alert-row">
      <span>
        <strong id={`${id}-label`}>{title}</strong>
        <small id={`${id}-note`}>{children}</small>
      </span>
      <button
        className={`switch ${on ? "checked" : ""}`}
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-note`}
        onClick={() => setAlert(topic, !on)}
      >
        <span />
      </button>
    </div>
  );
}

// Live video and member drive notifications: off until turned on here.
function StationAlerts() {
  const alerts = useAlertSettings();
  return (
    <section className="settings-panel">
      <h2>
        <Icon name="navLive" />
        From WXPN
      </h2>
      <p className="data-note">
        Notifications only if you turn them on. Turn them off here any time.
      </p>
      <AlertSwitch topic="live" on={alerts.live} title="Live video">
        Free at Noon and other live sessions, 10 minutes before they start.
      </AlertSwitch>
      <AlertSwitch topic="drives" on={alerts.drives} title="Member drives">
        A few times a year, while a member drive is on.
      </AlertSwitch>
      {!notificationsAreNative() && (
        <p className="data-note">The iPhone and Android apps send these as notifications.</p>
      )}
    </section>
  );
}

// The app's version, from package.json (see vite.config.js).
const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
const PLATFORM = Capacitor.getPlatform(); // "ios", "android" or "web"

const LINKS = [
  { label: "Donate to WXPN", url: DONATE_URL },
  ...(CONCERTS_ENABLED ? [] : [{ label: "Concert calendar", url: CALENDAR_URL }]),
  { label: "Contact the station", url: `mailto:${STATION_EMAIL}` },
  {
    label: "Technical support",
    url: `mailto:${STATION_EMAIL}?subject=${encodeURIComponent(
      `WXPN app ${VERSION} (${PLATFORM}) support`,
    )}`,
  },
  { label: "Privacy policy", url: PRIVACY_URL },
];

// A clock face whose hands show a "HH:MM" time.
function ClockFace({ time }) {
  const [h, m] = String(time || "0:0")
    .split(":")
    .map(Number);
  const minute = (m || 0) * 6;
  const hour = ((h || 0) % 12) * 30 + (m || 0) / 2;
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
  const [h, m] = String(time || "0:0")
    .split(":")
    .map(Number);
  const parts = TIME_FORMAT.formatToParts(new Date(2000, 0, 1, h || 0, m || 0));
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

export function SettingsScreen({
  alarm,
  updateAlarm,
  onAlarmEnabled,
  onTestAlarm,
  appearance,
  onAppearance,
  onNavigate,
}) {
  const volume = useVolume();
  const { castAvailable } = usePlayer();
  const toggleDay = (id) =>
    updateAlarm({
      repeatDays: alarm.repeatDays.includes(id)
        ? alarm.repeatDays.filter((x) => x !== id)
        : [...alarm.repeatDays, id].sort(),
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-panel">
          <div className="section-heading">
            <h2>
              <Icon name="clock" />
              Radio alarm
            </h2>
            <button
              className={`switch ${alarm.enabled ? "checked" : ""}`}
              role="switch"
              aria-checked={alarm.enabled}
              aria-label="Enable radio alarm"
              onClick={() => onAlarmEnabled(!alarm.enabled)}
            >
              <span />
            </button>
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
            options={Object.values(STREAMS).map((s) => ({ value: s.id, label: s.label }))}
          />
          <ChoiceSetting
            label="Snooze for"
            value={alarm.snoozeMinutes}
            onChange={(snoozeMinutes) => updateAlarm({ snoozeMinutes })}
            options={SNOOZE_OPTIONS.map((n) => ({ value: n, label: `${n} min` }))}
          />
          {PLATFORM !== "ios" && (
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
          <button className="secondary-button" onClick={onTestAlarm}>
            <Icon name="play" size={17} />
            Test alarm sound
          </button>
          <p className="data-note">
            {notificationsAreNative()
              ? "The alarm arrives as a notification, even with the app closed. Tap it to start the station."
              : "Keep WXPN open and your screen on for the alarm to play. The iPhone and Android apps can wake you with the app closed."}
          </p>
        </section>
        <div>
          <ShowReminders onNavigate={onNavigate} />
          <StationAlerts />
          <PlaylistSyncPanel />
          <section className="settings-panel">
            <h2>
              <Icon name="headphones" />
              Listening
            </h2>
            {/* iOS controls volume only with the device's buttons. */}
            {PLATFORM !== "ios" && (
              <label className="setting-row">
                <span>
                  Volume <small>{volume}%</small>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                />
              </label>
            )}
            {castAvailable && (
              <button className="setting-row full-width" onClick={chooseAudioOutput}>
                <span>Choose audio output</span>
                <Icon name="cast" />
              </button>
            )}
            <p className="data-note">
              Playback continues as you browse. Pausing disconnects the stream to save data.
            </p>
          </section>
          <section className="settings-panel appearance-settings">
            <h2>
              <Icon name="moon" />
              Appearance
            </h2>
            <Segmented
              label="Color theme"
              variant="pill"
              value={appearance}
              onChange={onAppearance}
              options={[
                { value: "system", label: "Automatic" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </section>
          <NewsletterPanel />
          <section className="settings-panel">
            <h2>
              <Icon name="heart" />
              Stay connected
            </h2>
            {LINKS.map((link) => {
              const web = link.url.startsWith("http");
              return (
                <a
                  className="setting-row"
                  key={link.label}
                  href={link.url}
                  // mail links open the mail app; only web links need a new tab
                  target={web ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  {link.label}
                  <Icon name={web ? "arrowUp" : "mail"} size={17} />
                </a>
              );
            })}
            <p className="data-note">
              WXPN · 88.5 FM Philadelphia
              <br />
              Listener-supported public radio.
              {VERSION && (
                <>
                  <br />
                  App version {VERSION}
                </>
              )}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
