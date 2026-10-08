import { useEffect, useEffectEvent, useState } from "react";
import { alarmDue, alarmPlan, dateKey, dueAlarmDate, useAlarmSettings } from "../alarm.js";
import {
  exactAlarmsAllowed,
  notificationsAreNative,
  onNotification,
  openExactAlarmSetting,
  requestNotifications,
  syncNotifications,
} from "../notifications.js";
import {
  getPlayerSnapshot,
  isConnecting,
  pauseStream,
  playStream,
  selectStream,
  setTemporaryVolume,
  subscribePlayer,
} from "../player.js";
import { STREAMS } from "../streams.js";
import { showToast } from "../toast.js";
import { useEveryShow } from "./useEveryShow.js";
import { track } from "../analytics.js";

// Starts the wake-up station at the alarm volume. The station is selected
// first: switching while paused reports "paused", which would otherwise
// restore the everyday volume straight away.
function ring(settings) {
  selectStream(settings.streamId);
  setTemporaryVolume(settings.volume);
  playStream();
}

// The radio alarm.
//   - In the iOS and Android apps it is a notification scheduled on the
//     phone, so it arrives with the app closed and the phone locked; tapping
//     it starts the station. With the app open, it plays straight away.
//   - In a browser it plays only while the page is open and the device awake.
export function useRadioAlarm() {
  const [alarm, updateAlarm] = useAlarmSettings();
  const [ringing, setRinging] = useState(false);

  // Effect Events: the timers and listeners below always see the latest
  // settings, without being torn down each time lastTriggeredDate is written.
  const start = useEffectEvent((at) => {
    if (ringing) return;
    const now = at || new Date();
    ring(alarm);
    setRinging(true);
    updateAlarm({ lastTriggeredDate: dueAlarmDate(alarm, now) ?? dateKey(now), snoozeUntil: 0 });
  });
  // Stopped some other way (the play button, the lock screen, headphones):
  // the alarm is over, so the banner goes and the next alarm can ring.
  // ring() reports its station switch before ringing is set, so this never
  // cancels an alarm as it starts.
  const onPlayerChange = useEffectEvent(() => {
    const { playing, status } = getPlayerSnapshot();
    if (ringing && !playing && !isConnecting(status)) setRinging(false);
  });
  const checkDue = useEffectEvent(() => {
    const now = new Date();
    if (alarmDue(alarm, now)) start(now);
  });

  useEffect(() => subscribePlayer(() => onPlayerChange()), []);

  // Browser: check every 15 seconds while the alarm is on. No immediate
  // check: switching the alarm on should not ring it.
  useEffect(() => {
    if (notificationsAreNative() || !alarm.enabled) return;
    const timer = setInterval(() => checkDue(), 15000);
    return () => clearInterval(timer);
  }, [alarm.enabled]);

  // Native: keep a week of alarms scheduled on the phone, rolled forward
  // whenever the app comes back to the foreground.
  const { enabled, time, streamId, snoozeUntil, lastTriggeredDate } = alarm;
  const days = alarm.repeatDays.join();
  useEveryShow(() => {
    if (!notificationsAreNative()) return;
    const repeatDays = days ? days.split(",").map(Number) : [];
    const plan = alarmPlan({ enabled, time, snoozeUntil, lastTriggeredDate, repeatDays }).map(
      (a) => ({
        ...a,
        title: "Radio alarm",
        body: `Good morning. Tap to wake up to ${STREAMS[streamId].label}.`,
      }),
    );
    syncNotifications("radio-alarm", plan)
      .then((permission) => {
        if (enabled && permission === "denied") {
          updateAlarm({ enabled: false });
          showToast(
            "Notifications are off for WXPN, so the alarm can’t ring. You can allow them in your phone’s Settings.",
          );
        }
      })
      .catch(() => {});
  }, [enabled, time, streamId, days, snoozeUntil, lastTriggeredDate, updateAlarm]);

  // Native: the alarm notification, tapped or arriving while the app is open.
  useEffect(() => onNotification("radio-alarm", () => start(), { whileOpen: true }), []);

  const stop = (snoozeMinutes) => {
    pauseStream();
    setRinging(false);
    updateAlarm({ snoozeUntil: snoozeMinutes ? Date.now() + snoozeMinutes * 60000 : 0 });
  };

  // Turning the alarm on in the phone apps asks for notification permission.
  const setEnabled = async (on) => {
    if (on && !(await requestNotifications())) {
      showToast("Allow notifications for WXPN in your phone’s Settings so the alarm can ring.");
      return;
    }
    updateAlarm({ enabled: on, snoozeUntil: 0 });
    if (on) track("turn_on", { feature: "alarm" });
    if (on && !(await exactAlarmsAllowed())) {
      showToast("To ring on time, WXPN needs Alarms & reminders turned on.", {
        label: "Turn on",
        onClick: openExactAlarmSetting,
      });
    }
  };

  return {
    alarm,
    updateAlarm,
    setEnabled,
    ringing,
    snooze: () => stop(alarm.snoozeMinutes),
    dismiss: () => stop(0),
    test: () => ring(alarm),
  };
}
