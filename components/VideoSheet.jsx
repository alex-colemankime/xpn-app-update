import { Icon, Modal } from "../ui.jsx";
import { youTubeEmbed } from "../updates.js";

// The video, in a sheet, with the radio paused while it plays (see App): a
// station video in its Brightcove Player (`embed`), or a YouTube link.
export function VideoSheet({ live, onClose }) {
  const src = live.embed || youTubeEmbed(live.watch);
  return (
    <Modal title={live.title} onClose={onClose} className="video-dialog">
      <div className="detail-body">
        <div className="video-frame">
          <iframe
            src={src}
            title={live.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
        {live.text && <p className="video-sheet-detail">{live.text}</p>}
        {live.description && <p className="show-description">{live.description}</p>}
        {live.watch && (
          <a className="text-button" href={live.watch} target="_blank" rel="noreferrer">
            Open in YouTube
            <Icon name="arrowUp" size={16} />
          </a>
        )}
      </div>
    </Modal>
  );
}
