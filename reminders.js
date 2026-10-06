// Show reminders: which notifications to schedule for the shows a listener
// follows. Pure, so the plan can be tested; hooks/useShowReminders.js hands
// it to the phone's notification system (or shows it in the app on the web).

import { upcomingStarts } from "./schedule.js";
import { easternParts, easternToEpoch } from "./time.js";

// iOS keeps at most 64 pending local notifications per app; leave headroom.
export const MAX_REMINDERS = 48;
export const LEAD_OPTIONS = [0, 5, 15];

// A stable positive 31-bit id per show airing, so rescheduling replaces a
// reminder instead of duplicating it (Android requires 32-bit int ids).
export function reminderId(showId, startsAt) {
  let h = 2166136261;
  for (const ch of `${showId}@${startsAt}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  // Clear of the small fixed ids the radio alarm uses (alarm.js).
  return (h >>> 1) | 0x10000;
}

export function reminderText(show, leadMinutes) {
  return {
    title: leadMinutes ? `${show.name} starts in ${leadMinutes} minutes` : `${show.name} is on now`,
    body: `${show.host ? `${show.host} on ` : "On "}WXPN 88.5. Tap to listen.`,
  };
}

// The reminders to schedule, soonest first: one per airing of each followed
// show over the next week, `leadMinutes` before it starts.
export function reminderPlan({ shows, showIds, now = new Date(), leadMinutes = 5, days = 7 }) {
  const parts = easternParts(now);
  const plan = [];
  for (const { show, date, start } of upcomingStarts(shows, showIds, parts, days)) {
    const startsAt = easternToEpoch(date, start);
    if (startsAt === null) continue;
    const at = startsAt - leadMinutes * 60000;
    if (at <= now.getTime()) continue;
    plan.push({
      id: reminderId(show.id, startsAt),
      showId: show.id,
      at,
      startsAt,
      ...reminderText(show, leadMinutes),
    });
  }
  return plan.slice(0, MAX_REMINDERS);
}
