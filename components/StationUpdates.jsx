import { Art, Icon, heightVar } from "../ui.jsx";
import { SHOWS } from "../catalog.js";
import { STATION_ART } from "../assets.js";
import { localClock } from "../time.js";
import { dismissUpdate } from "../hooks/useStationUpdates.js";

const liveArt = (live) => live.image || SHOWS[live.show]?.img || STATION_ART;
const trackHeight = heightVar("--banner-h");
const liveWhen = (live) =>
  live.state === "live" ? "Live now" : `Today at ${localClock(live.starts)}`;

// The line across the top of every screen. A live video takes it over while
// it is on; otherwise it carries the station's banner (a member drive).
// On Listen, the live card already says it, so the banner keeps to the
// station's message there.
export function StationBanner({ banner, live, liveDismissed, onWatch, onListenScreen = false }) {
  const showLive = live?.state === "live" && !liveDismissed && !onListenScreen;
  if (!showLive && !banner) return null;
  const item = showLive ? live : banner;
  return (
    <div
      className="station-banner"
      ref={trackHeight}
      data-kind={showLive ? "live" : "banner"}
      role="region"
      aria-label="From WXPN"
    >
      {showLive && (
        <span className="station-banner-live" aria-hidden="true">
          <i />
          Live
        </span>
      )}
      <p>{showLive ? live.title : banner.text}</p>
      {showLive ? (
        <button className="station-banner-action" onClick={() => onWatch(live)}>
          Watch
        </button>
      ) : (
        banner.action && (
          <a
            className="station-banner-action"
            href={banner.action.url}
            target="_blank"
            rel="noreferrer"
          >
            {banner.action.label}
          </a>
        )
      )}
      {item.dismissible && (
        <button
          className="icon-button station-banner-close"
          aria-label="Dismiss"
          onClick={() => dismissUpdate(item.id)}
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}

// On the Listen screen: the video to watch, from a little before it starts.
export function LiveCard({ live, onWatch }) {
  if (!live) return null;
  return (
    <section className="live-card" data-state={live.state} aria-label="Live video">
      <Art src={liveArt(live)} alt="" />
      <div>
        <span className="eyebrow">
          {live.state === "live" && <i className="live-dot" aria-hidden="true" />}
          {liveWhen(live)}
        </span>
        <h2>{live.title}</h2>
        {live.text && <p>{live.text}</p>}
      </div>
      <button
        className={live.state === "live" ? "primary-button" : "secondary-button"}
        onClick={() => onWatch(live)}
      >
        <Icon name="play" size={17} />
        Watch
      </button>
    </section>
  );
}
