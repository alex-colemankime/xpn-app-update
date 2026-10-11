import { ChoiceSetting, Icon, Switch, nameList } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { useFavoriteItems } from "../favorites.js";
import { notificationsAreNative } from "../notifications.js";
import { LEAD_OPTIONS } from "../reminders.js";
import { LIVE_ALERT_MINUTES } from "../updates.js";
import {
  disableReminders,
  enableReminders,
  setReminderLead,
  useReminderSettings,
} from "../hooks/useShowReminders.js";
import { setAlert, useAlertSettings } from "../hooks/useStationAlerts.js";

const LEAD_CHOICES = LEAD_OPTIONS.map((m) => ({
  value: m,
  label: m ? `${m} min before` : "At the start",
}));

// Reminders before the shows a listener follows.
export function ShowReminders({ onNavigate }) {
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
        <Switch
          on={settings.enabled}
          onChange={(on) => (on ? enableReminders() : disableReminders())}
          label="Remind me before shows I follow"
        />
      </div>
      {followed.length ? (
        <p className="data-note">For {nameList(followed.map((s) => s.name))}.</p>
      ) : (
        <>
          <p className="data-note">Follow a show to get a reminder before it starts.</p>
          <button className="secondary-button" onClick={() => onNavigate("shows")}>
            Find shows to follow
          </button>
        </>
      )}
      {/* When to remind matters only while reminders are on. */}
      {settings.enabled && (
        <>
          <ChoiceSetting
            label="Remind me"
            value={settings.lead}
            onChange={setReminderLead}
            options={LEAD_CHOICES}
          />
          <p className="data-note">
            {notificationsAreNative()
              ? "Reminders arrive even with the app closed."
              : "In a browser, reminders appear while WXPN is open."}
          </p>
        </>
      )}
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
      <Switch
        on={on}
        onChange={(next) => setAlert(topic, next)}
        labelledBy={`${id}-label`}
        describedBy={`${id}-note`}
      />
    </div>
  );
}

// Live video and member drive notifications: off until turned on here.
export function StationAlerts() {
  const alerts = useAlertSettings();
  return (
    <section className="settings-panel">
      <h2>
        <Icon name="navLive" />
        From WXPN
      </h2>
      <AlertSwitch topic="live" on={alerts.live} title="Live video">
        A notification {LIVE_ALERT_MINUTES} minutes before Free at Noon and other live sessions.
      </AlertSwitch>
      <AlertSwitch topic="drives" on={alerts.drives} title="Member drives">
        A notification when a member drive begins, a few times a year.
      </AlertSwitch>
    </section>
  );
}
