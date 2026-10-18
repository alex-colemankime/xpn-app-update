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
import { setAlerts, useAlertSettings } from "../hooks/useStationAlerts.js";

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
          onChange={(on) => (on ? enableReminders({ quiet: true }) : disableReminders())}
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

const KIND_LABEL = { live: "live video", drives: "member drive" };
const kindsLabel = (kinds) => kinds.map((k) => KIND_LABEL[k]).join(" and ");

// Everything the station sends, under one switch, with what it covers
// beside it: the consent the App Store asks for (4.5.4). Off until turned
// on here.
export function StationAlerts() {
  const { on, kinds } = useAlertSettings();
  return (
    <section className="settings-panel">
      <div className="section-heading">
        <h2 id="alerts-label">
          <Icon name="navLive" />
          Notifications from WXPN
        </h2>
        <Switch on={on} onChange={setAlerts} labelledBy="alerts-label" describedBy="alerts-note" />
      </div>
      <p className="data-note" id="alerts-note">
        Live video {LIVE_ALERT_MINUTES} minutes before it starts, member drives and other news from
        the station.
      </p>
      {/* A choice kept from the version with a switch per kind. */}
      {on && kinds && (
        <p className="data-note alerts-kept">
          You get only {kindsLabel(kinds)} notifications, as you chose before.{" "}
          <button className="text-button" onClick={() => setAlerts(true)}>
            Get all of them
          </button>
        </p>
      )}
    </section>
  );
}
