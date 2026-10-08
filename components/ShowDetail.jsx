import { useState } from "react";
import { Icon, Art, Modal } from "../ui.jsx";
import { shortName, showStream, onAirAt, nextAiringOf, untilLabel } from "../catalog.js";
import { deviceIsEastern } from "../time.js";
import { useFavoriteItems } from "../favorites.js";
import { playStream, selectStream } from "../player.js";
import { SaveButton } from "./MusicRows.jsx";
import { useNow } from "../hooks/useNow.js";
import { enableReminders, useReminderSettings } from "../hooks/useShowReminders.js";
import { VIDEO_SECTIONS } from "../config.js";
import { episodesOf, hasLeftArchive, useArchive } from "../archive.js";
import { EpisodeDetail, EpisodeRow } from "./Archive.jsx";
import { chooseVideoSection, useVideos } from "../videos.js";
import { VideoCard } from "./VideoCard.jsx";

// A show's sheet: who hosts it and when, Follow, a band to listen while it is
// on the air, its videos (World Cafe) and its recent broadcasts; or one of
// those broadcasts, opened.

// Right after a follow, while the reason is obvious, the sheet offers
// reminders (only if they are off and the show has a schedule). Inline rather
// than a toast, because the sheet is modal: a toast's button would sit
// behind it.
function ReminderOffer({ show, onDone }) {
  const { enabled } = useReminderSettings();
  if (enabled || !show.schedule?.length) return null;
  return (
    <div className="reminder-offer" role="status">
      <Icon name="bell" size={18} />
      <span>Get a reminder before {shortName(show)} starts?</span>
      <button
        className="secondary-button"
        onClick={async () => {
          if (await enableReminders()) onDone();
        }}
      >
        Remind me
      </button>
    </div>
  );
}

// "Next on air: Tomorrow at 2pm", in the listener's own time. While the show
// is on, the band below says so instead.
function Airing({ show }) {
  const now = new Date(useNow());
  if (onAirAt(now)?.show.id === show.id) return null;
  const next = nextAiringOf(show, now);
  return next ? <p className="airing">Next on air: {next.label}</p> : null;
}

// While the show is on the air: a band like the one on Listen, saying so,
// that plays the station live. It never looks like an episode's Play, since
// it isn't one.
function OnAirBand({ show, onListen }) {
  const now = new Date(useNow());
  const onAirNow = onAirAt(now);
  if (onAirNow?.show.id !== show.id) return null;
  return (
    <button
      className="show-on-air"
      onClick={onListen}
      style={
        show.tint ? { "--tint-light": show.tint.light, "--tint-dark": show.tint.dark } : undefined
      }
    >
      <span className="show-on-air-text">
        <span className="on-air-label">
          <i className="on-air-dot" data-live="" />
          On air now, {untilLabel(onAirNow)}
        </span>
        <strong>Listen live on WXPN</strong>
      </span>
      <span className="show-on-air-key" aria-hidden="true">
        <Icon name="navLive" size={20} />
      </span>
    </button>
  );
}

// A show with a video collection of its own (World Cafe): its newest few,
// and the way into the rest on the Videos tab.
const videoSectionOf = (show) =>
  VIDEO_SECTIONS.find((s) => s.label.toLowerCase() === show.name.toLowerCase());
function ShowVideos({ show, onNavigate, onWatch }) {
  const { sections } = useVideos();
  const section = sections.find((s) => s.playlist === videoSectionOf(show)?.playlist);
  if (!section?.videos.length) return null;
  return (
    <>
      <div className="section-heading">
        <h3>Videos</h3>
        <button
          className="text-button"
          onClick={() => {
            chooseVideoSection(section.label);
            onNavigate("videos");
          }}
        >
          All {show.name} videos
        </button>
      </div>
      <div className="video-grid show-videos">
        {section.videos.slice(0, 4).map((video) => (
          <VideoCard key={video.id} video={video} onWatch={onWatch} />
        ))}
      </div>
    </>
  );
}

export function ShowDetail({
  show,
  episodeId,
  onOpenEpisode,
  onCloseEpisode,
  onClose,
  onListen,
  onNavigate,
  onWatch,
}) {
  // The show's recent broadcasts from the archive. A saved episode still
  // opens after it has left the archive (and says so if played).
  const archive = useArchive();
  const saved = useFavoriteItems("episodes");
  const archived = episodesOf(archive, show.id);
  const [offer, setOffer] = useState(false);
  const episode =
    episodeId &&
    (archived.find((ep) => ep.id === episodeId) || saved.find((ep) => ep.id === episodeId));
  const stream = showStream(show);
  const listen = () => {
    selectStream(stream);
    playStream();
    onListen();
  };
  return (
    <Modal title={show.name} onClose={onClose}>
      <div className="detail-body">
        {episode ? (
          <EpisodeDetail
            show={show}
            episode={episode}
            gone={hasLeftArchive(archive, episode)}
            onBack={onCloseEpisode}
          />
        ) : (
          <>
            <div className="show-detail-hero">
              <Art src={show.img} alt="" />
              <div>
                {show.host && (
                  <>
                    <span className="eyebrow">Hosted by</span>
                    <h3>{show.host}</h3>
                  </>
                )}
                <ul className="show-times">
                  {(show.times || [show.time]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {show.schedule?.length > 0 && !deviceIsEastern() && (
                  <p className="subtle">Eastern time</p>
                )}
                <Airing show={show} />
                <SaveButton
                  type="shows"
                  item={show}
                  className="secondary-button"
                  onToggle={setOffer}
                >
                  {(saved) => (saved ? "Following" : "Follow show")}
                </SaveButton>
              </div>
            </div>
            {offer && <ReminderOffer show={show} onDone={() => setOffer(false)} />}
            <OnAirBand show={show} onListen={listen} />
            <p className="show-description">{show.desc}</p>
            {videoSectionOf(show) && onWatch && (
              <ShowVideos show={show} onNavigate={onNavigate} onWatch={onWatch} />
            )}
            {archived.length > 0 && (
              <>
                <div className="section-heading">
                  <h3>Episodes</h3>
                  <span className="subtle">{archived.length} recent broadcasts</span>
                </div>
                {archived.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    episode={ep}
                    showShow={false}
                    onOpen={(e) => onOpenEpisode(e.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
