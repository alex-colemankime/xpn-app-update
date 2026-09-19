import { Icon, Segmented } from "../ui.jsx";
import { DAY_LABELS } from "../alarm.js";
import { STREAMS } from "../player.js";

export function SettingsScreen({
  alarm,
  updateAlarm,
  onPreviewAlarm,
  volume,
  onVolume,
  canCast,
  onCast,
  appearance,
  onAppearance,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="appearance-settings">
        <h2>Appearance</h2>
        <Segmented label="Color theme" value={appearance} onChange={onAppearance}
          options={[{ value: "system", label: "Use device setting" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </section>
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
              onClick={() => updateAlarm({ enabled: !alarm.enabled })}
            >
              <span />
            </button>
          </div>
          <label className="alarm-time">
            <span className="eyebrow">ALARM TIME · YOUR LOCAL TIME</span>
            <input
              aria-label="Alarm time"
              type="time"
              value={alarm.time}
              onChange={(e) => updateAlarm({ time: e.target.value })}
              required
            />
          </label>
          <div className="repeat-days" role="group" aria-label="Repeat alarm on">
            {DAY_LABELS.map((d) => (
              <button
                key={d.id}
                aria-label={d.label}
                aria-pressed={alarm.repeatDays.includes(d.id)}
                className={alarm.repeatDays.includes(d.id) ? "active" : ""}
                onClick={() =>
                  updateAlarm({
                    repeatDays: alarm.repeatDays.includes(d.id)
                      ? alarm.repeatDays.filter((x) => x !== d.id)
                      : [...alarm.repeatDays, d.id].sort(),
                  })
                }
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>
          {!alarm.repeatDays.length && (
            <p className="data-note">Select at least one day for the alarm to ring.</p>
          )}
          <label className="setting-row">
            <span>Wake-up station</span>
            <select
              value={alarm.streamId}
              onChange={(e) => updateAlarm({ streamId: e.target.value })}
            >
              {Object.values(STREAMS).map((s) => (
                <option value={s.id} key={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <span>Snooze for</span>
            <select
              value={alarm.snoozeMinutes}
              onChange={(e) => updateAlarm({ snoozeMinutes: +e.target.value })}
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
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
          <button className="secondary-button" onClick={onPreviewAlarm}>
            <Icon name="play" size={17} />
            Test alarm sound
          </button>
          <p className="data-note">
            Keep this app open and your device awake. Browser alarms cannot wake a closed app or a
            locked device; playback also depends on browser audio permissions.
          </p>
        </section>
        <div>
          <section className="settings-panel">
            <h2>
              <Icon name="headphones" />
              Listening
            </h2>
            <label className="setting-row">
              <span>
                Volume <small>{volume}%</small>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolume(+e.target.value)}
              />
            </label>
            <p className="data-note">On iPhone and iPad, use your device’s volume buttons.</p>
            {canCast && (
              <button className="setting-row full-width" onClick={onCast}>
                <span>Choose audio output</span>
                <Icon name="cast" />
              </button>
            )}
            <p className="data-note">
              Playback continues as you browse. Pausing disconnects the stream to save data.
            </p>
          </section>
          <section className="settings-panel">
            <h2>Stay connected</h2>
            {[
              { label: "Support WXPN", url: "https://xpn.org/donate/" },
              { label: "Contact the station", url: "mailto:wxpndesk@xpn.org" },
              {
                label: "Technical support",
                url: "mailto:wxpndesk@xpn.org?subject=WXPN%20App%20Support",
              },
              { label: "Privacy policy", url: "https://xpn.org/privacy-policy/" },
            ].map((link) => (
              <a
                className="setting-row"
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
                <Icon name="arrowUp" size={17} />
              </a>
            ))}
            <p className="data-note">
              WXPN · 88.5 FM Philadelphia
              <br />
              Listener-supported public radio.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
