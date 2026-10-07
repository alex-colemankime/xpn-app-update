// The phone's own notifications (iOS and Android apps only), used for show
// reminders and the radio alarm. Each feature owns a "kind" of notification
// and hands over its complete plan; this module makes the phone match it.
//   - Replacing is done by kind, from what the phone actually has pending,
//     so nothing scheduled earlier can be orphaned.
//   - Syncs run one at a time, so quick changes (follow, then unfollow) can
//     never interleave and leave stale notifications behind.
//   - Permission is only ever requested from a listener's tap
//     (requestNotifications); background syncs never raise the prompt.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const notificationsAreNative = () => Capacitor.isNativePlatform();

// "granted", "denied" or "prompt". The web reports "granted": nothing is
// scheduled there, and in-app messages need no permission.
async function notificationPermission() {
  if (!notificationsAreNative()) return "granted";
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
  } catch {
    return "denied";
  }
}

// Ask, from a tap. True when notifications can be delivered.
export async function requestNotifications() {
  if (!notificationsAreNative()) return true;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

// Android 14+ denies exact alarms to apps that aren't alarm clocks, so a
// wake-up alarm could arrive minutes late. True when exact timing is allowed
// (always, off Android); false sends the caller to ask for it.
export async function exactAlarmsAllowed() {
  if (Capacitor.getPlatform() !== "android") return true;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === "granted";
  } catch {
    return true; // older Android: exact alarms need no grant
  }
}

// Opens the system's "Alarms & reminders" setting for WXPN.
export const openExactAlarmSetting = () =>
  LocalNotifications.changeExactNotificationSetting().catch(() => {});

let queue = Promise.resolve();

// Make the phone's pending notifications of `kind` exactly `plan`
// ([{ id, at, title, body, extra }]). Resolves to the permission state, so a
// caller can tell the listener when notifications have been switched off.
export function syncNotifications(kind, plan) {
  const run = async () => {
    if (!notificationsAreNative()) return "granted";
    const { notifications = [] } = await LocalNotifications.getPending();
    const stale = notifications.filter((n) => n.extra?.kind === kind);
    if (stale.length) {
      await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
    }
    const permission = await notificationPermission();
    if (permission !== "granted" || !plan.length) return permission;
    await LocalNotifications.schedule({
      notifications: plan.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: { ...n.extra, kind },
      })),
    });
    return permission;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

// Call `handler(extra)` when the listener taps a notification of `kind`, or,
// with `whileOpen`, also when one arrives while the app is in front.
export function onNotification(kind, handler, { whileOpen = false } = {}) {
  if (!notificationsAreNative()) return () => {};
  const events = ["localNotificationActionPerformed"];
  if (whileOpen) events.push("localNotificationReceived");
  const handles = events.map((event) =>
    LocalNotifications.addListener(event, (payload) => {
      const notification = payload.notification || payload;
      if (notification.extra?.kind === kind) handler(notification.extra);
    }),
  );
  return () => handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
}
