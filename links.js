import { Capacitor } from "@capacitor/core";

// Every xpn.org address the app links to, in one place.
export const DONATE_URL = "https://xpn.org/donate/";
export const PLAYLIST_URL = "https://xpn.org/wxpn-playlists/";
export const PROGRAM_GUIDE_URL = "https://xpn.org/program_guide/";
export const CALENDAR_URL = "https://xpn.org/concert-and-events/";
export const SUBMIT_CONCERT_URL = "https://xpn.org/concert-event-submit/";
export const LISTEN_URL = "https://xpn.org/listen/";
export const PRIVACY_URL = "https://xpn.org/privacy-policy/";
export const STATION_EMAIL = "wxpndesk@xpn.org";
// The weekly e-news (top stories and music news, concert and event alerts,
// special announcements): the station's short signup form, and the Top
// Stories form that adds a free playlist.
export const ENEWS_URL = "https://xpn.org/enews/";
export const TOP_STORIES_URL = "https://xpn.org/signup-xpn-top-stories/";

// Opens a web page beside the app: in the phone apps, in the system browser
// view over the app (so giving happens on xpn.org, never inside the app, as
// App Review 3.2.2 asks); in a browser, in a new tab.
export function openPage(url) {
  if (!url) return;
  const newTab = () => window.open(url, "_blank", "noopener");
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/browser").then(({ Browser }) => Browser.open({ url })).catch(newTab);
  } else {
    newTab();
  }
}
