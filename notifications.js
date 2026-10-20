// The phone's own notifications (iOS and Android apps only), used for show
// reminders, the radio alarm and the station's notifications. Each feature
// owns a "kind" of notification and hands over its complete plan; this
// module makes the phone match all of them together.
//   - iOS keeps only the soonest 64 pending notifications and quietly drops
//     the rest, so the plans share one budget: the alarm's first (it must
//     ring), then everything else soonest first. What doesn't fit now is
//     scheduled as the week rolls forward.
//   - Replacing is done by kind, from what the phone actually has pending,
//     so nothing scheduled earlier can be orphaned. What has already come
//     due is never scheduled again, so nothing is delivered twice.
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

// A notification on the phone and due this soon is left as it is: cancelled
// and scheduled again, it might not make its time. One not yet on the phone
// is scheduled however soon it's due, as long as its time hasn't passed.
const TOO_SOON_MS = 5000;
// A held notification this long past its time has fired; it's let go.
const FIRED_MS = 60000;

// When a notification is set for, as kept with it on the phone (its
// extra.slot): a time, or for a weekly one (`on`: { weekday, hour,
// minute }, Capacitor's), its day and time. A weekly one already on the
// phone for the same slot is left there: the phone repeats it by itself.
export const slotOf = (n) =>
  n.on ? `on:${n.on.weekday}:${n.on.hour}:${n.on.minute}` : `at:${n.at}`;

// The scheduler itself, with the phone's notification API passed in, so it
// can be tested with a stand-in. `api` is LocalNotifications' shape. A
// plan's notifications are { id, at, title, body, extra }, plus `on` for
// one that repeats weekly (`at` is then its next time, for ordering).
export function createScheduler({
  api,
  native = () => true,
  permission = async () => "granted",
  onTrouble = () => {},
  now = () => Date.now(),
}) {
  const plans = {};
  // Notifications about to fire, by kind (id → time): out of the plans, but
  // left on the phone through every pass, whichever kind's sync started it,
  // until they've fired. Only a new plan of their own kind (the alarm turned
  // off) can take one away.
  const held = {};
  let queue = Promise.resolve();

  async function reconcile() {
    if (!native()) return "granted";
    // One moment for the whole pass, and the phone's pending notifications
    // as they stand at its start.
    const moment = now();
    const soonest = moment + TOO_SOON_MS;
    const { notifications: pending = [] } = await api.getPending();
    // (Not Object.hasOwn, which iOS gained only in 15.4.)
    const ours = (n) => Object.prototype.hasOwnProperty.call(plans, n.extra?.kind ?? "");
    const onPhone = new Map(pending.filter(ours).map((n) => [n.id, n.extra?.slot]));
    for (const kind of Object.keys(plans)) {
      held[kind] ||= new Map();
      // One about to fire that's on the phone for that time stays there as
      // it is (held): cancelled now, it could not be scheduled again in time
      // (an alarm would never ring because some other plan changed a moment
      // before). One whose time has passed is gone from the plan for good:
      // delivered already, or missed while the app was closed; scheduled
      // again, the phone would deliver it now, a second time. A weekly one
      // is never done: the phone repeats it.
      for (const n of plans[kind]) {
        if (!n.on && n.at <= soonest && onPhone.get(n.id) === slotOf(n)) held[kind].set(n.id, n.at);
      }
      plans[kind] = plans[kind].filter((n) => n.on || (n.at > moment && !held[kind].has(n.id)));
      // Fired a while ago: delivered, so nothing to keep.
      for (const [id, at] of held[kind]) if (at < moment - FIRED_MS) held[kind].delete(id);
    }
    // Ours left on the phone as they are: the held ones, and weekly ones
    // already set for the same slot.
    const planned = new Map(Object.values(plans).flatMap((plan) => plan.map((n) => [n.id, n])));
    const kept = (n) =>
      ours(n) &&
      (Boolean(held[n.extra.kind]?.has(n.id)) ||
        (planned.get(n.id)?.on && slotOf(planned.get(n.id)) === n.extra?.slot));
    const keptIds = new Set(pending.filter(kept).map((n) => n.id));
    // Notifications of a kind whose plan hasn't arrived yet this session stay
    // as they are, and count against the budget, as do the kept ones.
    const room = NOTIFICATION_BUDGET - pending.filter((n) => !ours(n) || kept(n)).length;
    const stale = pending.filter((n) => ours(n) && !kept(n));
    if (stale.length) {
      await api.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
    }
    const allowed = await permission();
    const toSchedule = Object.fromEntries(
      Object.entries(plans).map(([kind, plan]) => [kind, plan.filter((n) => !keptIds.has(n.id))]),
    );
    const wanted = allocateNotifications(toSchedule, room);
    if (allowed !== "granted" || !wanted.length) {
      onTrouble(false);
      return allowed;
    }
    await api.schedule({
      notifications: wanted.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: n.on
          ? { on: n.on, allowWhileIdle: true }
          : { at: new Date(n.at), allowWhileIdle: true },
        extra: { ...n.extra, kind: n.kind, slot: slotOf(n) },
      })),
    });
    // Anything that came due while scheduling may already have been
    // delivered; only the rest must still be pending.
    const later = now() + TOO_SOON_MS;
    const expected = wanted.filter((n) => n.on || n.at > later).length;
    const after = await api.getPending();
    onTrouble((after.notifications || []).filter(ours).length < expected);
    return allowed;
  }

  // Make the phone's pending notifications of `kind` match `plan`
  // ([{ id, at, title, body, extra }]), within the shared budget.
  function sync(kind, plan) {
    plans[kind] = plan;
    // This kind's own new plan decides about its imminent ones: kept if it
    // still has them (re-held in the pass), cancelled if not.
    held[kind] = new Map();
    const run = () =>
      reconcile().catch((error) => {
        onTrouble(true);
        throw error;
      });
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  return { sync };
}

const scheduler = createScheduler({
  api: LocalNotifications,
  native: notificationsAreNative,
  permission: notificationPermission,
  onTrouble: (trouble) => troubleStore.set(trouble),
});

// Make the phone's pending notifications of `kind` match `plan`
// ([{ id, at, title, body, extra }]), within the shared budget. Resolves to
// the permission state, so a caller can tell the listener when
// notifications have been switched off.
export const syncNotifications = (kind, plan) => scheduler.sync(kind, plan);

// Notification events, routed by kind. The phone holds a tap that opened
// the app until something listens, then hands it to the first listener only,
// so the app keeps a single listener per event and routes from there. A tap
// whose kind has no handler yet (its feature still starting) waits for one.
// `addListener` is LocalNotifications' shape, passed in so it can be tested.
const TAPPED = "localNotificationActionPerformed";
const RECEIVED = "localNotificationReceived";

export function createNotificationRouter(addListener) {
  const handlers = new Map(); // kind → Set of { handler, whileOpen }
  const waiting = new Map(); // kind → taps not yet handled
  let listening = false;

  function deliver(event, payload) {
    const extra = (payload?.notification || payload)?.extra;
    const kind = extra?.kind;
    if (!kind) return;
    const tapped = event === TAPPED;
    const ready = [...(handlers.get(kind) || [])].filter((h) => tapped || h.whileOpen);
    if (ready.length) ready.forEach((h) => h.handler(extra));
    else if (tapped) waiting.set(kind, [...(waiting.get(kind) || []), extra]);
  }

  // Call `handler(extra)` when the listener taps a notification of `kind`,
  // or, with `whileOpen`, also when one arrives while the app is in front.
  return function on(kind, handler, { whileOpen = false } = {}) {
    if (!listening) {
      listening = true;
      for (const event of [TAPPED, RECEIVED]) {
        Promise.resolve(addListener(event, (payload) => deliver(event, payload))).catch(() => {});
      }
    }
    const entry = { handler, whileOpen };
    if (!handlers.has(kind)) handlers.set(kind, new Set());
    handlers.get(kind).add(entry);
    const held = waiting.get(kind);
    if (held) {
      waiting.delete(kind);
      held.forEach((extra) => handler(extra));
    }
    return () => handlers.get(kind)?.delete(entry);
  };
}

const route = createNotificationRouter((event, fn) => LocalNotifications.addListener(event, fn));

export function onNotification(kind, handler, options) {
  if (!notificationsAreNative()) return () => {};
  return route(kind, handler, options);
}
