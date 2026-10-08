import { untilLabel } from "../catalog.js";
import { Art, Icon } from "../ui.jsx";

// The live video, when it belongs to the show on the air now (Free at Noon
// during Free at Noon): then the on-air band carries it, rather than a second
// card saying the same thing.
export const videoOfShow = (live, onAirNow) =>
  live?.state === "live" && onAirNow && live.show === onAirNow.show.id ? live : null;

// Who is on the air right now, from the FM schedule. Radio is its hosts, so
// this leads the screen: a band in the show's own color, like a station's
// studio sign. Tapping opens the show; during the show's live video, the band
// names the session and offers Watch.
export function OnAir({ onAirNow, playing, onOpenShow, live, onWatch }) {
  if (!onAirNow) return null;
  const { show } = onAirNow;
  const until = untilLabel(onAirNow);
  const video = videoOfShow(live, onAirNow);
  const line = video ? video.text : show.host;
  return (
    <div
      className="on-air"
      data-video={video ? "" : undefined}
      style={
        show.tint ? { "--tint-light": show.tint.light, "--tint-dark": show.tint.dark } : undefined
      }
    >
      <button className="on-air-open" onClick={() => onOpenShow(show.id)}>
        <Art className="on-air-art" src={show.img} alt="" />
        <span className="on-air-text">
          <span className="on-air-label">
            <i className="on-air-dot" data-live={playing || video ? "" : undefined} />
            On air{until ? ` ${until}` : ""}
          </span>
          <span className="on-air-show">{video ? video.title : show.name}</span>
          {line && <span className="on-air-host">{line}</span>}
        </span>
        {!video && <Icon name="chev" size={18} />}
        <span className="sr-only">Show details</span>
      </button>
      {video && (
        <button className="watch-button" onClick={() => onWatch(video)}>
          <Icon name="play" size={14} />
          Watch
          <span className="sr-only"> the live video</span>
        </button>
      )}
    </div>
  );
}
