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
//         "ends": "2026-10-17T00:00:00-04:00"
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
//         "ends": "2026-10-09T13:00:00-04:00"
//       }
//     ]
//   }
//
// Times are ISO 8601 with an offset. Anything malformed is ignored rather
// than shown half-broken. Everything here is pure, so it can be tested.

export const LIVE_ANNOUNCE_MINUTES = 120; // a live video is announced this long before it starts

const text = (value, max = 280) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const web = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const time = (value) => {
  if (value == null || value === "") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
};

// One update in the app's shape, or null if it is unusable.
export function normalizeUpdate(raw) {
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
    const url = web(raw.action?.url);
    return {
      id,
      kind,
      text: message,
      action: label && url ? { label, url } : null,
      starts,
      ends,
      dismissible: raw.dismissible !== false,
    };
  }
  const title = text(raw.title, 120);
  const watch = web(raw.watch);
  if (!title || !watch || starts === null) return null; // a live video needs a start time
  return {
    id,
    kind,
    title,
    text: text(raw.text, 160),
    watch,
    image: web(raw.image),
    show: text(raw.show, 40),
    starts,
    ends: ends ?? starts + 60 * 60000,
    dismissible: raw.dismissible !== false,
  };
}

export function normalizeUpdates(json) {
  const list = Array.isArray(json?.updates) ? json.updates : [];
  return list.map(normalizeUpdate).filter(Boolean);
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

// A numeric entity's character; an out-of-range one (&#99999999;) is dropped
// rather than throwing.
const codePoint = (n) =>
  Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
const decodeEntities = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(
      /&(amp|quot|apos|lt|gt|nbsp);/g,
      (_, e) => ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[e],
    );

export function livestreamUpdate(page, airing) {
  const entry = Array.isArray(page) ? page[0] : page;
  const html = entry?.content?.rendered;
  if (typeof html !== "string" || !airing) return null;
  const edited = Date.parse(`${entry.modified_gmt || ""}Z`);
  if (Number.isFinite(edited) && edited <= airing.ends - WEEK_MS) return null;
  const video = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/.exec(html)?.[1];
  if (!video || video === "live_stream") return null;
  // "Free At Noon livestream: Mikaela Davis" -> the artist.
  const frameTitle = decodeEntities(/<iframe[^>]*\btitle="([^"]*)"/i.exec(html)?.[1]);
  const artist = text(/livestream:\s*(.+)$/i.exec(frameTitle)?.[1], 80);
  const pageTitle = text(
    decodeEntities(entry.title?.rendered).replace(/^watch live:\s*/i, ""),
    120,
  );
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
