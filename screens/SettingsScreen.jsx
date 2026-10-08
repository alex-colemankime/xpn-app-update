import { Capacitor } from "@capacitor/core";
import { Icon, Segmented, Switch } from "../ui.jsx";
import { setVolume, VOLUME_SETTABLE } from "../player.js";
import { usePlayer, useVolume, chooseAudioOutput } from "../hooks/usePlayer.js";
import { NewsletterPanel } from "../components/Newsletter.jsx";
import { ShowReminders, StationAlerts } from "../components/NotificationSettings.jsx";
import { PlaylistSyncPanel } from "../components/PlaylistSync.jsx";
import { RadioAlarmPanel } from "../components/RadioAlarm.jsx";
import { useNotificationTrouble } from "../notifications.js";
import { CONCERTS_ENABLED } from "../config.js";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { CALENDAR_URL, DONATE_URL, PRIVACY_URL, STATION_EMAIL } from "../links.js";
import { reportingAvailable, reportingStore, setReporting } from "../analytics.js";
import { useLocalStore } from "../storage.js";

// The app's version, from package.json (see vite.config.js).
const VERSION = __APP_VERSION__;

const LINKS = [
  { label: "Donate to WXPN", url: DONATE_URL },
  ...(CONCERTS_ENABLED ? [] : [{ label: "Concert calendar", url: CALENDAR_URL }]),
  { label: "Contact the station", url: `mailto:${STATION_EMAIL}` },
  {
    label: "Technical support",
    url: `mailto:${STATION_EMAIL}?subject=${encodeURIComponent(
      `WXPN app ${VERSION} (${Capacitor.getPlatform()}) support`,
    )}`,
  },
  { label: "Privacy policy", url: PRIVACY_URL },
];

const THEMES = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Usage reporting (analytics.js), on unless the listener turns it off.
function UsageReporting() {
  const { on } = useLocalStore(reportingStore);
  return (
    <section className="settings-panel">
      <h2>
        <Icon name="settings" />
        Privacy
      </h2>
      <div className="alert-row">
        <span>
          <strong id="usage-label">Share app usage</strong>
          <small id="usage-note">
            Which screens and features are used, and errors, so WXPN can improve the app. Never who
            you are.
          </small>
        </span>
        <Switch on={on} onChange={setReporting} labelledBy="usage-label" describedBy="usage-note" />
      </div>
    </section>
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
  const trouble = useNotificationTrouble();
  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      {trouble && (
        <p className="data-note" role="status">
          This phone didn’t take every notification WXPN set up (the alarm, reminders or station
          notifications). WXPN tries again each time you open it.
        </p>
      )}
      <div className="settings-grid">
        <RadioAlarmPanel
          alarm={alarm}
          updateAlarm={updateAlarm}
          onEnabled={onAlarmEnabled}
          onTest={onTestAlarm}
        />
        <div>
          <ShowReminders onNavigate={onNavigate} />
          <StationAlerts />
          <PlaylistSyncPanel />
          <section className="settings-panel">
            <h2>
              <Icon name="headphones" />
              Listening
            </h2>
            {VOLUME_SETTABLE && (
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
              options={THEMES}
            />
          </section>
          {reportingAvailable() && <UsageReporting />}
          <NewsletterPanel />
          <section className="settings-panel">
            <h2>
              <Icon name="heart" />
              Stay connected
            </h2>
            <SocialLinks />
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
                  {link.note ? (
                    <span>
                      {link.label} <small>{link.note}</small>
                    </span>
                  ) : (
                    link.label
                  )}
                  <Icon name={web ? "chev" : "mail"} size={17} />
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
