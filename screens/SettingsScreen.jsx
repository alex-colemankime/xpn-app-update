import { Capacitor } from "@capacitor/core";
import { Icon, Segmented, Switch } from "../ui.jsx";
import { setVolume, VOLUME_SETTABLE } from "../player.js";
import { CAST_KIND } from "../cast.js";
import { usePlayer, useVolume, chooseAudioOutput } from "../hooks/usePlayer.js";
import { NewsletterPanel } from "../components/Newsletter.jsx";
import { ShowReminders, StationAlerts } from "../components/NotificationSettings.jsx";
import { PlaylistSyncPanel } from "../components/PlaylistSync.jsx";
import { RadioAlarmPanel } from "../components/RadioAlarm.jsx";
import { useNotificationTrouble } from "../notifications.js";
import { SocialLinks } from "../components/SocialLinks.jsx";
import {
  CALENDAR_URL,
  DONATE_URL,
  HELP_URL,
  PRIVACY_URL,
  STATION_EMAIL,
  trackDonate,
} from "../links.js";
import { reportingAvailable, reportingStore, setReporting } from "../analytics.js";
import { useLocalStore } from "../storage.js";
import { useFeatures } from "../features.js";

// The app's version, from package.json (see vite.config.js).
const VERSION = __APP_VERSION__;

const LINKS = [
  { label: "Donate to WXPN", url: DONATE_URL, onClick: () => trackDonate("settings") },
  // Only while the Concerts tab is off (the build has none, or the station
  // switched it off), so the calendar is still a tap away.
  { label: "Concert calendar", url: CALENDAR_URL, whenOff: "concerts" },
  { label: "Contact the station", url: `mailto:${STATION_EMAIL}` },
  { label: "App help", url: HELP_URL },
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
        <Icon name="shield" />
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
  testingAlarm,
  appearance,
  onAppearance,
  onNavigate,
}) {
  const features = useFeatures();
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
      {/* Two columns on a wide screen, one on a phone: what the app does
          for the listener first, then how it plays and looks, and the
          station. */}
      <div className="settings-grid">
        <div>
          <RadioAlarmPanel
            alarm={alarm}
            updateAlarm={updateAlarm}
            onEnabled={onAlarmEnabled}
            onTest={onTestAlarm}
            testing={testingAlarm}
          />
          <ShowReminders onNavigate={onNavigate} />
          <StationAlerts />
          <PlaylistSyncPanel />
        </div>
        <div>
          {/* Volume (not on iPhone, where the buttons set it) and the audio
              output, where there is either. */}
          {(VOLUME_SETTABLE || castAvailable) && (
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
                  <Icon name={CAST_KIND || "cast"} />
                </button>
              )}
            </section>
          )}
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
            {LINKS.filter((link) => !link.whenOff || !features[link.whenOff]).map((link) => {
              const web = link.url.startsWith("http");
              return (
                <a
                  className="setting-row"
                  key={link.label}
                  href={link.url}
                  // mail links open the mail app; only web links need a new tab
                  target={web ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={link.onClick}
                >
                  {link.label}
                  <Icon name={web ? "chev" : "mail"} size={17} />
                </a>
              );
            })}
          </section>
        </div>
      </div>
      <p className="settings-footer">
        <strong>WXPN 88.5 FM Philadelphia</strong>
        Listener-supported public radio
        {VERSION && <small>Version {VERSION}</small>}
      </p>
    </>
  );
}
