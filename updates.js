// Station updates: messages the station publishes to the app without a new
// release, from one small JSON file it hosts (VITE_XPN_UPDATES_URL).
//
//   {
//     "updates": [
//       {
//         "id": "fall-drive-2026",          unique; dismissals remember it
//         "kind": "banner",                 a line across the top of every screen
//         "text": "The Fall Member Drive is on. Keep WXPN independent.",
//         "action": { "label": "Donate", "url": "https://xpn.org/donate/" },
//         "starts": "2026-10-05T06:00:00-04:00",
//         "ends": "2026-10-17T00:00:00-04:00",
//         "notify": [                       optional: member drive notifications,
//           {                               for listeners who turned them on
//             "at": "2026-10-16T08:00:00-04:00",
//             "title": "Last day of the Fall Member Drive",
//             "text": "There’s still time to give. Tap to donate."
//           }
//         ]
//       },
//       {
//         "id": "fan-2026-10-09",
//         "kind": "live",                   a video to watch, such as Free at Noon
//         "title": "Free at Noon: Wesley Stace",
//         "text": "Live from The Music Hall at World Stage",
//         "watch": "https://www.youtube.com/watch?v=…",
//         "image": "https://xpn.org/…/slide.jpg",   optional; or
//         "show": "freeatnoon",                     a show id, for its artwork
//         "starts": "2026-10-09T12:00:00-04:00",
//         "ends": "2026-10-09T13:00:00-04:00",
//         "notify": false                   optional: no "starting soon" notification
//       }
//     ]
//   }
//
// Times are ISO 8601 with an offset. Anything malformed is ignored rather
// than shown half-broken. Everything here is pure, so it can be tested.

import { decodeEntities, oneLine, plainText, webUrl } from "./text.js";

export const LIVE_ANNOUNCE_MINUTES = 120; // a live video is announced this long before it starts
export const LIVE_ALERT_MINUTES = 10; // and notified this long before, to those who asked
const MAX_NOTICES = 6; // per banner

const text = (value, max = 280) => (typeof value === "string" ? oneLine(value, max) : "");

const time = (value) => {
  if (value == null || value === "") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
};

// One update in the app's shape, or null if it is unusable.
function normalizeUpdate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.id, 80);
  const kind = raw.kind === "live" ? "live" : raw.kind === "banner" ? "banner" : null;
  const starts = time(raw.starts);
  const ends = time(raw.ends);
  if (!id || !kind || starts === undefined || ends === undefined) return null;
  if (kind === "banner") {
    const message = text(raw.text);
    if (!message) return null;
    const label = text(raw.action?.label, 24);
    const url = webUrl(raw.action?.url);
    return {
      id,
      kind,
      text: message,
      action: label && url ? { label, url } : null,
      starts,
      ends,
      dismissible: raw.dismissible !== false,
      notify: (Array.isArray(raw.notify) ? raw.notify : [])
        .map((n) => ({ at: time(n?.at), title: text(n?.title, 80), text: text(n?.text, 160) }))
        .filter((n) => Number.isFinite(n.at) && n.title)
        .slice(0, MAX_NOTICES),
    };
  }
  const title = text(raw.title, 120);
  const watch = webUrl(raw.watch);
  if (!title || !watch || starts === null) return null; // a live video needs a start time
  return {
    id,
    kind,
    title,
    text: text(raw.text, 160),
    watch,
    image: webUrl(raw.image),
    show: text(raw.show, 40),
    starts,
    ends: ends ?? starts + 60 * 60000,
    dismissible: raw.dismissible !== false,
    notify: raw.notify !== false,
  };
}

export function normalizeUpdates(json) {
  if (!Array.isArray(json?.updates) && advancedAdsList(json)) return advancedAdsUpdates(json);
  const list = Array.isArray(json?.updates) ? json.updates : [];
  return list.map(normalizeUpdate).filter(Boolean);
}

// ---- Advanced Ads ----------------------------------------------------------
// The same updates can come from WordPress instead of a file: an Advanced Ads
// group (Advanced Ads Pro's REST API, /wp-json/advanced-ads/v1/groups/<id>
// or /ads), set as VITE_XPN_UPDATES_URL. Each ad in the group is one update,
// and Advanced Ads' own schedule (start and expiry dates) decides which ads
// the API returns. An ad's content is either
//   - the update as JSON, as tools/updates-composer.html writes it ("Copy
//     for Advanced Ads"), for a live video or drive notifications; or
//   - a plain message, for a banner: its text, and its first link as the
//     button ("The Fall Member Drive is on. <a href="…/donate/">Donate</a>").
// The ad's id names the update when the JSON has none, so dismissing it
// sticks until the station posts a new ad.

const adList = (json) =>
  Array.isArray(json) ? json : Array.isArray(json?.ads) ? json.ads : json?.content ? [json] : null;
const advancedAdsList = (json) => {
  const list = adList(json);
  return list && list.some((ad) => ad && typeof ad === "object" && "content" in ad) ? list : null;
};
const rendered = (value) => (typeof value === "string" ? value : (value?.rendered ?? ""));
// WordPress displays straight quotes as curly ones; JSON needs them back.
const straightQuotes = (value) => value.replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'");

function adUpdate(ad) {
  if (!ad || typeof ad !== "object") return [];
  const html = rendered(ad.content);
  const body = straightQuotes(plainText(html));
  const fallbackId = ad.id != null ? `ad-${oneLine(ad.id, 40)}` : "";
  if (body.startsWith("{")) {
    try {
      const json = JSON.parse(body);
      const list = Array.isArray(json.updates) ? json.updates : [json];
      return list.map((u, i) => ({
        id: list.length > 1 ? `${fallbackId}-${i}` : fallbackId,
        ...u,
      }));
    } catch {
      return []; // half-written JSON: nothing rather than a garbled banner
    }
  }
  const link = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(html);
  const label = link ? plainText(link[2]) : "";
  const message = link ? plainText(html.replace(link[0], " ")) : body;
  return [
    {
      id: fallbackId,
      kind: "banner",
      text: message,
      action: link && label ? { label, url: decodeEntities(link[1]) } : undefined,
    },
  ];
}

export function advancedAdsUpdates(json) {
  return (advancedAdsList(json) || []).flatMap(adUpdate).map(normalizeUpdate).filter(Boolean);
}

// What to show at a moment: { banner, live } (either may be null).
//   - A banner runs between its start and end (either may be open).
//   - A live video is "soon" from LIVE_ANNOUNCE_MINUTES before it starts,
//     then "live" until it ends.
// The first matching entry in the file wins.
export function activeUpdates(updates, now = Date.now()) {
  const banner =
    updates.find(
      (u) =>
        u.kind === "banner" &&
        (u.starts == null || u.starts <= now) &&
        (u.ends == null || now < u.ends),
    ) || null;
  const video = updates.find(
    (u) => u.kind === "live" && u.starts - LIVE_ANNOUNCE_MINUTES * 60000 <= now && now < u.ends,
  );
  const live = video ? { ...video, state: now >= video.starts ? "live" : "soon" } : null;
  return { banner, live };
}

// Notifications a listener has asked for in Settings ({ live, drives }),
// planned from the updates file and scheduled on the phone, so they arrive
// with the app closed and need no push service:
//   - a live video, LIVE_ALERT_MINUTES before it starts, unless the file
//     says "notify": false or the show is one the listener already gets a
//     reminder for (`remindedShows`);
//   - a member drive banner, at each time in its "notify" list.
// Only what is still ahead and within `days`, soonest first. A phone learns
// of a new notice when the app next opens, so the station posts them ahead.
const MAX_ALERTS = 12;
export function alertPlan(
  updates,
  { live = false, drives = false } = {},
  { now = Date.now(), days = 14, remindedShows = [] } = {},
) {
  const horizon = now + days * 86400000;
  const ahead = (at) => at > now && at <= horizon;
  const plan = [];
  for (const u of updates) {
    if (u.kind === "live" && live && u.notify && !remindedShows.includes(u.show)) {
      const at = u.starts - LIVE_ALERT_MINUTES * 60000;
      if (ahead(at))
        plan.push({
          key: `live:${u.id}`,
          at,
          title: u.title,
          body: `The live video starts in ${LIVE_ALERT_MINUTES} minutes. Tap to watch.`,
          extra: { action: "watch", live: u },
        });
    }
    if (u.kind === "banner" && drives) {
      for (const n of u.notify || []) {
        if (!ahead(n.at) || (u.ends != null && n.at >= u.ends)) continue;
        plan.push({
          key: `drive:${u.id}@${n.at}`,
          at: n.at,
          title: n.title,
          body: n.text || (u.action ? `Tap to ${u.action.label.toLowerCase()}.` : ""),
          extra: { action: "open", url: u.action?.url || "" },
        });
      }
    }
  }
  return plan.sort((a, b) => a.at - b.at).slice(0, MAX_ALERTS);
}

// YouTube links play inside the app; other links open in the browser.
export function youTubeEmbed(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m)\./, "");
  let id = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
    else if (/^\/(live|embed|shorts)\//.test(parsed.pathname)) id = parsed.pathname.split("/")[2];
    if (parsed.pathname === "/embed/live_stream" && parsed.searchParams.get("channel")) {
      const channel = encodeURIComponent(parsed.searchParams.get("channel"));
      return `https://www.youtube-nocookie.com/embed/live_stream?channel=${channel}&autoplay=1&playsinline=1`;
    }
  }
  if (!id || !/^[\w-]{6,20}$/.test(id) || id === "live_stream") return null;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
}

// The station's livestream page on xpn.org (WordPress), which staff already
// update for each Free at Noon with that week's YouTube video. During a Free
// at Noon airing, and from LIVE_ANNOUNCE_MINUTES before, the app offers that
// video without anyone writing an update. `airing` is the slot as epochs:
// { starts, ends }. A page not edited since last week's show ended is taken
// to be last week's, and offers nothing.
const WEEK_MS = 7 * 24 * 3600000;

export function livestreamUpdate(page, airing) {
  const entry = Array.isArray(page) ? page[0] : page;
  const html = entry?.content?.rendered;
  if (typeof html !== "string" || !airing) return null;
  const edited = Date.parse(`${entry.modified_gmt || ""}Z`);
  if (Number.isFinite(edited) && edited <= airing.ends - WEEK_MS) return null;
  const video = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/.exec(html)?.[1];
  if (!video || video === "live_stream") return null;
  // "Free At Noon livestream: Mikaela Davis" -> the artist.
  const frameTitle = plainText(/<iframe[^>]*\btitle="([^"]*)"/i.exec(html)?.[1]);
  const artist = text(/livestream:\s*(.+)$/i.exec(frameTitle)?.[1], 80);
  const pageTitle = text(plainText(entry.title?.rendered).replace(/^watch live:\s*/i, ""), 120);
  return normalizeUpdate({
    id: `livestream-${video}`,
    kind: "live",
    title: artist ? `Free at Noon: ${artist}` : pageTitle || "Free at Noon",
    text: "Live video from WXPN",
    watch: `https://www.youtube.com/watch?v=${video}`,
    show: "freeatnoon",
    starts: new Date(airing.starts).toISOString(),
    ends: new Date(airing.ends).toISOString(),
  });
}
