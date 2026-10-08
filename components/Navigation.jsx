import { Icon, Wordmark } from "../ui.jsx";
import { DONATE_URL } from "../links.js";
import { CONCERTS_ENABLED, VIDEOS_ENABLED } from "../config.js";

// The app's screens, in navigation order. Videos and Concerts only have tabs
// when there is something to show (see config.js).
const NAV = [
  { id: "listen", label: "Listen live", short: "Listen", icon: "navLive" },
  { id: "favorites", label: "Favorites", short: "Favorites", icon: "heart" },
  { id: "shows", label: "Shows", short: "Shows", icon: "headphones" },
  ...(VIDEOS_ENABLED ? [{ id: "videos", label: "Videos", short: "Videos", icon: "video" }] : []),
  ...(CONCERTS_ENABLED
    ? [{ id: "concerts", label: "Concerts", short: "Concerts", icon: "navConcerts" }]
    : []),
];
export const TITLES = {
  ...Object.fromEntries(NAV.map((n) => [n.id, n.label])),
  settings: "Settings",
};

// Props for a control that opens a screen: marked current while it is shown.
const opens = (id, screen, navigate) => ({
  "aria-current": screen === id ? "page" : undefined,
  onClick: () => navigate(id),
});

// Tablets and laptops: the wordmark, the screens, Settings and Donate.
export function Sidebar({ screen, navigate }) {
  return (
    <aside className="app-sidebar">
      <button className="brand" onClick={() => navigate("listen")}>
        <span className="sr-only">WXPN home</span>
        <Wordmark dot />
      </button>
      <nav aria-label="Main navigation">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-button ${screen === n.id ? "active" : ""}`}
            {...opens(n.id, screen, navigate)}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {screen === n.id && <i />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="settings-button" {...opens("settings", screen, navigate)}>
          <Icon name="settings" size={18} />
          Settings
        </button>
        <a
          className="sidebar-donate"
          href={DONATE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Donate to WXPN (opens in a new tab)"
        >
          Donate
        </a>
      </div>
    </aside>
  );
}

// Phones: the wordmark, Donate and Settings across the top.
export function TopBar({ screen, navigate }) {
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
        >
          <span>Donate</span>
        </a>
        <button
          className="mobile-settings icon-button"
          aria-label="Settings"
          {...opens("settings", screen, navigate)}
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}

// Phones: the screens as tabs along the bottom.
export function TabBar({ screen, navigate }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {NAV.map((n) => (
        <button
          key={n.id}
          className={screen === n.id ? "active" : ""}
          {...opens(n.id, screen, navigate)}
        >
          <Icon name={n.icon} size={21} />
          <span>{n.short}</span>
        </button>
      ))}
    </nav>
  );
}
