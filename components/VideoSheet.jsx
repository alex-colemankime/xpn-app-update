import { Icon, Modal } from "../ui.jsx";
import { youTubeEmbed } from "../updates.js";

// The video, in a sheet. Only YouTube links get here (see App); the stream is
// paused while it plays.
export function VideoSheet({ live, onClose }) {
  const src = youTubeEmbed(live.watch);
  return (
    <Modal title={live.title} onClose={onClose} className="video-dialog">
      <div className="detail-body">
        <div className="video-frame">
          <iframe
            src={src}
            title={live.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
        {live.text && <p className="show-description">{live.text}</p>}
        <a className="text-button" href={live.watch} target="_blank" rel="noreferrer">
          Open in YouTube
          <Icon name="arrowUp" size={16} />
        </a>
      </div>
    </Modal>
  );
}
