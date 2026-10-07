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
// App Review 3.2.2 asks); in a browser, in a new tab. `onClose` runs once
// the listener is back in the app: the browser view closed, or (in a
// browser) this tab in front again, or at once if no tab could open.
export function openPage(url, { onClose } = {}) {
  if (!url) return;
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
  import("@capacitor/browser")
    .then(async ({ Browser }) => {
      if (onClose) {
        const listener = await Browser.addListener("browserFinished", () => {
          listener.remove();
          back();
        });
      }
      await Browser.open({ url });
    })
    .catch(newTab);
}
