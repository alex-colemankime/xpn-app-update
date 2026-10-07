// The phone's own notifications (iOS and Android apps only), used for show
// reminders, the radio alarm and the station's notifications. Each feature
// owns a "kind" of notification and hands over its complete plan; this
// module makes the phone match all of them together.
//   - iOS keeps only the soonest 64 pending notifications and quietly drops
//     the rest, so the plans share one budget: the alarm's first (it must
//     ring), then everything else soonest first. What doesn't fit now is
//     scheduled as the week rolls forward.
//   - Replacing is done by kind, from what the phone actually has pending,
//     so nothing scheduled earlier can be orphaned.
//   - Syncs run one at a time, so quick changes (follow, then unfollow) can
//     never interleave and leave stale notifications behind.
//   - Afterwards the phone's pending list is read back; a failure, or fewer
//     than were scheduled, is recorded (useNotificationTrouble) for Settings
//     to say, rather than lost.
//   - Permission is only ever requested from a listener's tap
//     (requestNotifications); background syncs never raise the prompt.

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { createStore } from "./storage.js";

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

// The phone's limit (iOS), less a few for anything outside these plans.
export const NOTIFICATION_BUDGET = 60;
// Kinds kept ahead of everything else, in order.
const FIRST = ["radio-alarm"];

// Which notifications go on the phone, from each kind's plan, within
// `room`: the FIRST kinds whole, then the rest soonest first. Pure, so it can
// be tested.
export function allocateNotifications(plans, room = NOTIFICATION_BUDGET) {
  const tagged = (kind) => (plans[kind] || []).map((n) => ({ ...n, kind }));
  const first = FIRST.flatMap(tagged).slice(0, Math.max(0, room));
  const rest = Object.keys(plans)
    .filter((kind) => !FIRST.includes(kind))
    .flatMap(tagged)
    .sort((a, b) => a.at - b.at);
  return [...first, ...rest.slice(0, Math.max(0, room - first.length))];
}

// Whether the last sync went wrong: it failed, or the phone kept fewer than
// it was given.
const troubleStore = createStore(false);
export const useNotificationTrouble = () =>
  useSyncExternalStore(troubleStore.subscribe, troubleStore.getSnapshot);

const plans = {};
let queue = Promise.resolve();

async function reconcile() {
  if (!notificationsAreNative()) return "granted";
  const { notifications: pending = [] } = await LocalNotifications.getPending();
  const ours = (n) => Object.prototype.hasOwnProperty.call(plans, n.extra?.kind ?? "");
  // Notifications of a kind whose plan hasn't arrived yet this session stay
  // as they are, and count against the budget.
  const room = NOTIFICATION_BUDGET - pending.filter((n) => !ours(n)).length;
  const stale = pending.filter(ours);
  if (stale.length) {
    await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
  }
  const permission = await notificationPermission();
  const wanted = allocateNotifications(plans, room);
  if (permission !== "granted" || !wanted.length) {
    troubleStore.set(false);
    return permission;
  }
  await LocalNotifications.schedule({
    notifications: wanted.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      extra: { ...n.extra, kind: n.kind },
    })),
  });
  const after = await LocalNotifications.getPending();
  troubleStore.set((after.notifications || []).filter(ours).length < wanted.length);
  return permission;
}

// Make the phone's pending notifications of `kind` match `plan`
// ([{ id, at, title, body, extra }]), within the shared budget. Resolves to
// the permission state, so a caller can tell the listener when
// notifications have been switched off.
export function syncNotifications(kind, plan) {
  plans[kind] = plan;
  const run = () =>
    reconcile().catch((error) => {
      troubleStore.set(true);
      throw error;
    });
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
