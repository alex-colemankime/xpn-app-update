import { track } from "./analytics.js";
import { Capacitor } from "@capacitor/core";

// Every xpn.org address the app links to, in one place.
export const DONATE_URL = "https://xpn.org/donate/";
// A link to the donate page, give or take a trailing slash or a query.
export function isDonatePage(url) {
  const page = (value) => {
    try {
      const u = new URL(value);
      return `${u.origin}${u.pathname.replace(/\/$/, "")}`;
    } catch {
      return value;
    }
  };
  return page(url) === page(DONATE_URL);
}
// A tap on a way to give, and where it was (analytics.js, "donate_click"):
// "header", "sidebar", "settings", "banner" or "notification".
export const trackDonate = (place) => track("donate_click", { place });
export const PLAYLIST_URL = "https://xpn.org/wxpn-playlists/";
// A song on Spotify and Apple Music: their search for it (the playlist
// feed has no ids of theirs). Both are universal links, so they're plain
// links that leave the app (target="_blank"): Capacitor hands those to the
// system (iOS opens them with UIApplication.open, Android with a VIEW
// intent), and the system opens the service's app where it is installed,
// or else the browser. openPage's browser view would keep them on the web.
export const spotifySearch = (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`;
export const appleMusicSearch = (q) =>
  `https://music.apple.com/us/search?term=${encodeURIComponent(q)}`;
export const CALENDAR_URL = "https://xpn.org/concert-and-events/";
export const SUBMIT_CONCERT_URL = "https://xpn.org/concert-event-submit/";
export const LISTEN_URL = "https://xpn.org/listen/";
export const PRIVACY_URL = "https://xpn.org/privacy-policy/";
export const STATION_EMAIL = "wxpndesk@xpn.org";
// The app's help page (draft copy in the "WXPN App Support page" doc). It's
// also the Support URL in both store listings, so it must stay put.
export const HELP_URL = "https://xpn.org/app/";
// The weekly e-news (top stories and music news, concert and event alerts,
// special announcements): the station's short signup form, and the Top
// Stories form that adds a free playlist.
export const ENEWS_URL = "https://xpn.org/enews/";
export const TOP_STORIES_URL = "https://xpn.org/signup-xpn-top-stories/";
// The station's social accounts and World Cafe's, as xpn.org links them
// (its footer, and the World Cafe program page).
export const SOCIAL = [
  {
    owner: "WXPN",
    accounts: [
      { name: "Instagram", handle: "@wxpnfm", url: "https://www.instagram.com/wxpnfm/" },
      { name: "Facebook", handle: "885wxpn", url: "https://www.facebook.com/885wxpn/" },
      {
        name: "YouTube",
        handle: "xponentialmusic",
        url: "https://www.youtube.com/user/xponentialmusic",
      },
    ],
  },
  {
    owner: "World Cafe",
    accounts: [
      { name: "Instagram", handle: "@worldcafe", url: "https://www.instagram.com/worldcafe/" },
      { name: "Facebook", handle: "WorldCafe", url: "https://www.facebook.com/WorldCafe" },
      { name: "YouTube", handle: "worldcafe", url: "https://www.youtube.com/c/worldcafe" },
    ],
  },
];

// Opens a web page beside the app: in the phone apps, in the system browser
// view over the app (so giving happens on xpn.org, never inside the app, as
// App Review 3.2.2 asks); in a browser, in a new tab. `onClose` runs once
// the listener is back in the app: the browser view closed, or (in a
// browser) this tab in front again, or at once if no tab could open.
export function openPage(url, { onClose } = {}) {
  if (!url) return;
  // Only a notification's tap opens a donate link this way; every other way
  // to give is a link of its own, which says where it was.
  if (isDonatePage(url)) trackDonate("notification");
  let closed = false;
  const back = () => {
    if (closed) return;
    closed = true;
    onClose?.();
  };
  const newTab = () => {
    window.open(url, "_blank", "noopener");
    if (!onClose) return;
    // A blocked tab leaves this one in front.
    setTimeout(() => {
      if (document.hasFocus()) back();
      else window.addEventListener("focus", back, { once: true });
    }, 1000);
  };
  if (!Capacitor.isNativePlatform()) {
    newTab();
    return;
  }
  openInBrowserView(url, onClose && back).catch(newTab);
}

// The phone apps' in-app browser view. Rejects when it couldn't open.
async function openInBrowserView(url, onClose) {
  const { Browser } = await import("@capacitor/browser");
  let listener = null;
  try {
    if (onClose) {
      listener = await Browser.addListener("browserFinished", () => {
        listener.remove();
        onClose();
      });
    }
    await Browser.open({ url });
  } catch (error) {
    // The browser view never opened: its close listener would otherwise
    // fire for some later page.
    await listener?.remove();
    throw error;
  }
}
