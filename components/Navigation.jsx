import { Icon, Wordmark } from "../ui.jsx";
import { DONATE_URL, trackDonate } from "../links.js";
import { useFeatures } from "../features.js";

// The app's screens, in navigation order. Videos and Concerts only have tabs
// when the build sets them up (config.js) and the station hasn't switched
// them off: features.js accounts for both.
const NAV = [
  { id: "listen", label: "Listen live", short: "Listen", icon: "navLive" },
  { id: "shows", label: "Shows", short: "Shows", icon: "headphones" },
  { id: "videos", label: "Videos", short: "Videos", icon: "video" },
  { id: "concerts", label: "Concerts", short: "Concerts", icon: "navConcerts" },
  // Last: what the listener keeps, from all of the above.
  { id: "favorites", label: "Favorites", short: "Favorites", icon: "heart" },
];
export const TITLES = {
  ...Object.fromEntries(NAV.map((n) => [n.id, n.label])),
  settings: "Settings",
};

// The screens with a tab right now.
function useNav() {
  const features = useFeatures();
  return NAV.filter((n) => features[n.id] !== false);
}

// Props for a control that opens a screen: marked current while it is shown.
const opens = (id, screen, navigate) => ({
  "aria-current": screen === id ? "page" : undefined,
  onClick: () => navigate(id),
});

// A screen's glyph, and its filled twin (the same name and "F", icons.jsx)
// while it is the screen shown.
const glyph = (n, screen) => (screen === n.id ? `${n.icon}F` : n.icon);

// Tablets and laptops: the wordmark, the screens, Settings and Donate.
export function Sidebar({ screen, navigate }) {
  const nav = useNav();
  return (
    <aside className="app-sidebar">
      <button className="brand" onClick={() => navigate("listen")}>
        <span className="sr-only">WXPN home</span>
        <Wordmark dot />
      </button>
      <nav aria-label="Main navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            className={`nav-button ${screen === n.id ? "active" : ""}`}
            {...opens(n.id, screen, navigate)}
          >
            <Icon name={glyph(n, screen)} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="settings-button" {...opens("settings", screen, navigate)}>
          <Icon name="settings" />
          Settings
        </button>
        <a
          className="sidebar-donate"
          href={DONATE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Donate to WXPN (opens in a new tab)"
          onClick={() => trackDonate("sidebar")}
        >
          Donate
        </a>
      </div>
    </aside>
  );
}

// Phones: the wordmark, Donate and Settings across the top. The Settings
// key opens Settings, and closes it again.
export function TopBar({ screen, navigate, toggleSettings }) {
  return (
    <header className="topbar">
      <button className="mobile-brand" onClick={() => navigate("listen")} aria-label="WXPN home">
        <Wordmark dot />
      </button>
      <div className="topbar-actions">
        {/* Giving happens on xpn.org, in the browser (App Review 3.2.2). */}
        <a
          className="topbar-donate"
          href={DONATE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Donate to WXPN (opens in a new tab)"
          onClick={() => trackDonate("header")}
        >
          <span>Donate</span>
        </a>
        <button
          className="mobile-settings icon-button"
          aria-label={screen === "settings" ? "Close settings" : "Settings"}
          aria-current={screen === "settings" ? "page" : undefined}
          onClick={toggleSettings}
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}

// Phones: the screens as tabs along the bottom.
export function TabBar({ screen, navigate }) {
  const nav = useNav();
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {nav.map((n) => (
        <button
          key={n.id}
          className={screen === n.id ? "active" : ""}
          {...opens(n.id, screen, navigate)}
        >
          <Icon name={glyph(n, screen)} size={21} />
          <span>{n.short}</span>
        </button>
      ))}
    </nav>
  );
}
