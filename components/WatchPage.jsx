import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Art, Icon } from "../ui.jsx";
import { SaveButton } from "./MusicRows.jsx";
import { Toast, modalClosed, modalOpened } from "./Toast.jsx";
import { SHOWS } from "../catalog.js";
import { STATION_ART } from "../assets.js";
import { clockTime, lengthLabel, localWhen, mediumDay } from "../time.js";
import {
  fetchVideo,
  findVideo,
  framedPlayerUrl,
  playerUrl,
  savedVideoItem,
  useVideos,
} from "../videos.js";
import { youTubeEmbed } from "../updates.js";

// Watching a video, the way video apps do it: the picture full width at the
// top (pinned there on phones while the rest scrolls), then the title, who
// it's from, the description, and what to watch next. Wider, the next
// videos sit beside it. It covers the app until closed; Back closes it.
//
// A station video comes by Brightcove id (`videoId`); a live video (Free at
// Noon) comes as the station update itself (`live`).
//
// A station video plays in the app's own frame for Brightcove's player
// (public/video-player.html), which hides the title the player would draw
// over the picture. That frame is sandboxed away from the app; if the player
// can't start in it, the frame says so and Brightcove's own page takes over.
const FRAMED = "allow-scripts allow-presentation allow-popups";
const EMBEDDED = "allow-scripts allow-same-origin allow-presentation allow-popups";
// When the player itself can't run in the app's frame (its script won't
// load or start), the rest of the session goes straight to Brightcove's
// page rather than waiting on the frame for every video. A video that fails
// on its own falls back alone.
const FRAME_BROKEN = ["script", "player", "timeout"];
let frameFailed = false;

const UP_NEXT = 12;
// Under the video (phones, tablets), Up next starts with this many.
const UP_NEXT_FIRST = 3;

// "The Wiggles on World Cafe | Studio Session & Interview": the title, and
// what kind of video it is, shown on a line of its own.
const titleParts = (name = "") => {
  const [main, ...rest] = name.split(/\s*\|\s*/);
  return [main, rest.join(" · ")];
};
// The same on one line, the dot kept with the word before it.
const oneLineTitle = (name) => titleParts(name).filter(Boolean).join("\u00a0· ");

// Who a video is from: the show it is tagged with, else the station.
const showOf = (tags = []) => tags.map((t) => SHOWS[t]).find((s) => s?.name);

function Channel({ show }) {
  if (!show) {
    return (
      <div className="watch-channel">
        <Art src={STATION_ART} alt="" />
        <span>
          <strong>WXPN</strong>
          <small>88.5 FM Philadelphia</small>
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
        <strong>{oneLineTitle(video.name)}</strong>
        <small>
          {[mediumDay(video.published), lengthLabel(video.duration)].filter(Boolean).join(" · ")}
        </small>
      </span>
    </button>
  );
}

// What to watch next. Beside the video (wide screens) the list is there in
// full; under it, the first few lead and "Show more videos" opens the rest, so the
// description and the next video stay near the top.
function UpNext({ heading, videos, onPick }) {
  const id = useId();
  const list = useRef(null);
  const [all, setAll] = useState(false);
  // The button goes once used; focus moves on to the first video it showed.
  const seeMore = () => {
    flushSync(() => setAll(true));
    list.current?.querySelectorAll(".next-card")[UP_NEXT_FIRST]?.focus();
  };
  return (
    <section ref={list} className="watch-next" aria-labelledby={id} data-all={all || undefined}>
      <h3 id={id}>{heading}</h3>
      {videos.map((v) => (
        <NextCard key={v.id} video={v} onPick={onPick} />
      ))}
      {videos.length > UP_NEXT_FIRST && !all && (
        <button className="text-button next-more" onClick={seeMore}>
          Show more videos
          <span className="expand-chevron">
            <Icon name="chevD" size={17} />
          </span>
        </button>
      )}
    </section>
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

  // The frame can ask for Brightcove's own player page instead.
  const frame = useRef(null);
  // The video falling back on its own, or "all" once the frame is broken.
  const [unframed, setUnframed] = useState(frameFailed ? "all" : null);
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source && e.source === frame.current?.contentWindow) {
        if (e.data?.type !== "wxpn:video-fallback") return;
        if (FRAME_BROKEN.includes(e.data.why)) frameFailed = true;
        setUnframed(frameFailed ? "all" : videoId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [videoId]);

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
  const framed = Boolean(video) && unframed !== "all" && unframed !== video.id;
  const src = video
    ? framed
      ? framedPlayerUrl(video.id)
      : playerUrl(video.id)
    : live
      ? youTubeEmbed(live.watch)
      : null;
  const [title, kind] = video ? titleParts(video.name) : [live?.title || "", ""];
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
                  ref={frame}
                  src={src}
                  title={kind ? `${title} · ${kind}` : title}
                  allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox={framed ? FRAMED : EMBEDDED}
                />
              ) : (
                <p className="watch-status" role="status">
                  {failed ? "This video can’t be played right now." : "Loading…"}
                </p>
              )}
            </div>
          </div>
          <div className="watch-info">
            {/* The heart beside the title saves the video, as it saves a
                song beside its title on Listen. */}
            <div className="watch-head">
              <h2 id={titleId} className="watch-title">
                {title}
                {kind && (
                  <span className="watch-kind">
                    <span className="sr-only"> · </span>
                    {kind}
                  </span>
                )}
              </h2>
              {video && (
                <SaveButton
                  type="videos"
                  item={savedVideoItem(video)}
                  name={title}
                  className="icon-button watch-save"
                />
              )}
            </div>
            <Channel show={show} />
            <About
              meta={meta}
              text={video ? video.description : live?.text}
              link={
                live?.watch && (
                  <a className="text-button" href={live.watch} target="_blank" rel="noreferrer">
                    Open in YouTube
                  </a>
                )
              }
            />
          </div>
        </div>
        {next.length > 0 && (
          <UpNext
            key={videoId || "live"}
            heading={video ? "Up next" : "More videos"}
            videos={next}
            onPick={onPick}
          />
        )}
      </div>
      <Toast inModal />
    </dialog>
  );
}
