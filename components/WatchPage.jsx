import { useEffect, useId, useRef, useState } from "react";
import { Art, Icon } from "../ui.jsx";
import { SaveButton } from "./MusicRows.jsx";
import { Toast, modalClosed, modalOpened } from "./Toast.jsx";
import { SHOWS } from "../catalog.js";
import { STATION_ART } from "../assets.js";
import { clockTime, lengthLabel, localWhen, mediumDay } from "../time.js";
import { fetchVideo, findVideo, playerUrl, savedVideoItem, useVideos } from "../videos.js";
import { youTubeEmbed } from "../updates.js";

// Watching a video, the way video apps do it: the picture full width at the
// top (pinned there on phones while the rest scrolls), then the title, who
// it's from, the description, and what to watch next. Wider, the next
// videos sit beside it. It covers the app until closed; Back closes it.
//
// A station video comes by Brightcove id (`videoId`); a live video (Free at
// Noon) comes as the station update itself (`live`).

const UP_NEXT = 12;

// Who a video is from: the show it is tagged with, else the station.
const showOf = (tags = []) => tags.map((t) => SHOWS[t]).find((s) => s?.name);

function Channel({ show }) {
  if (!show) {
    return (
      <div className="watch-channel">
        <Art src={STATION_ART} alt="" />
        <span>
          <strong>WXPN</strong>
          <small>Sessions and stories from the station</small>
        </span>
      </div>
    );
  }
  return (
    <div className="watch-channel">
      <Art src={show.img} alt="" />
      <span>
        <strong>{show.name}</strong>
        <small>{show.times?.[0] || show.host}</small>
      </span>
      <SaveButton type="shows" item={show} className="secondary-button watch-follow">
        {(saved) => (saved ? "Following" : "Follow")}
      </SaveButton>
    </div>
  );
}

// The description, three lines until opened, like a video app's.
function About({ meta, text, link }) {
  const [open, setOpen] = useState(false);
  if (!text && !link) return <p className="watch-meta">{meta}</p>;
  return (
    <div className="watch-about" data-open={open || undefined}>
      <p className="watch-meta">{meta}</p>
      {text && <p className="watch-description">{text}</p>}
      {link}
      {text && text.length > 140 && (
        <button className="text-button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}

function NextCard({ video, onPick }) {
  return (
    <button className="next-card" onClick={() => onPick(video)}>
      <span className="video-thumb">
        <Art src={video.poster} alt="" loading="lazy" />
        {video.duration && <span className="video-length">{clockTime(video.duration)}</span>}
      </span>
      <span className="next-text">
        <strong>{video.name.replace(/\s*\|\s*/g, " · ")}</strong>
        <small>
          {[mediumDay(video.published), lengthLabel(video.duration)].filter(Boolean).join(" · ")}
        </small>
      </span>
    </button>
  );
}

export function WatchPage({ videoId, live, onPick, onClose }) {
  const ref = useRef(null);
  const titleId = useId();
  const { sections } = useVideos();
  const found = videoId ? findVideo(sections, videoId) : { video: null, section: null };

  // Opened from a link to a video no list holds: ask Brightcove for it.
  const [fetched, setFetched] = useState(null);
  useEffect(() => {
    if (!videoId || found.video || fetched?.id === videoId) return;
    const controller = new AbortController();
    fetchVideo(videoId, controller.signal).then(
      (video) => setFetched({ id: videoId, video }),
      () => controller.signal.aborted || setFetched({ id: videoId, failed: true }),
    );
    return () => controller.abort();
  }, [videoId, found.video, fetched?.id]);
  const video = found.video || (fetched?.id === videoId ? fetched.video : null);
  const failed = Boolean(videoId && fetched?.id === videoId && fetched.failed);

  // A full-screen dialog: focus stays inside, Escape and Back close it.
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    el.showModal();
    modalOpened();
    el.querySelector(".watch-close")?.focus();
    return () => {
      modalClosed();
      el.close();
      previous?.focus?.();
    };
  }, []);
  // A new video starts at the top.
  useEffect(() => {
    ref.current?.scrollTo?.({ top: 0 });
  }, [videoId]);

  const section = found.section || sections[0];
  const next = (section?.videos || []).filter((v) => v.id !== videoId).slice(0, UP_NEXT);
  const src = video ? playerUrl(video.id) : live ? youTubeEmbed(live.watch) : null;
  const title = video ? video.name.replace(/\s*\|\s*/g, " · ") : live?.title || "";
  const meta = video
    ? [mediumDay(video.published), lengthLabel(video.duration)].filter(Boolean).join(" · ")
    : live
      ? live.state === "live"
        ? "Live now"
        : localWhen(live.starts)
      : "";
  const show = video ? showOf(video.tags) : SHOWS[live?.show];

  return (
    <dialog
      ref={ref}
      className="watch-page"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="watch-layout">
        <div className="watch-main">
          <div className="watch-player">
            <div className="watch-bar">
              <button
                className="icon-button watch-close"
                onClick={onClose}
                aria-label="Close video"
              >
                <span className="watch-close-phone">
                  <Icon name="chevD" size={26} />
                </span>
                <span className="watch-close-wide">
                  <Icon name="back" size={20} />
                </span>
              </button>
              {section && video && <span>{section.label}</span>}
            </div>
            <div className="watch-frame">
              {src ? (
                <iframe
                  key={src}
                  src={src}
                  title={title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                />
              ) : (
                <p className="watch-status" role="status">
                  {failed ? "This video can’t be played right now." : "Loading…"}
                </p>
              )}
            </div>
          </div>
          <div className="watch-info">
            <h2 id={titleId} className="watch-title">
              {title}
            </h2>
            <div className="watch-row">
              <Channel show={show} />
              {video && (
                <div className="watch-actions">
                  <SaveButton
                    type="videos"
                    item={savedVideoItem(video)}
                    className="secondary-button watch-save"
                  >
                    {(saved) => (saved ? "Saved" : "Save")}
                  </SaveButton>
                </div>
              )}
            </div>
            <About
              meta={meta}
              text={video ? video.description : live?.text}
              link={
                live?.watch && (
                  <a className="text-button" href={live.watch} target="_blank" rel="noreferrer">
                    Open in YouTube
                    <Icon name="arrowUp" size={16} />
                  </a>
                )
              }
            />
          </div>
        </div>
        {next.length > 0 && (
          <section className="watch-next" aria-labelledby={`${titleId}-next`}>
            <h3 id={`${titleId}-next`}>{video ? "Up next" : "More videos"}</h3>
            {next.map((v) => (
              <NextCard key={v.id} video={v} onPick={onPick} />
            ))}
          </section>
        )}
      </div>
      <Toast inModal />
    </dialog>
  );
}
