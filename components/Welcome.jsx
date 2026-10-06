import { useEffect, useRef, useState } from "react";
import { Art, Icon, Modal, nameList } from "../ui.jsx";
import { SHOWS, SHOW_DIRECTORY, shortName } from "../catalog.js";
import { STATION_ART } from "../assets.js";
import { toggleFavorite, useFavoriteItems, useIsFavorite } from "../favorites.js";
import { enableReminders } from "../hooks/useShowReminders.js";
import { notificationsAreNative } from "../notifications.js";
import { tap } from "../haptics.js";
import { PLAYLIST_NAME } from "../music-services.js";
import { connect } from "../playlist-sync.js";
import { offeredServices } from "./PlaylistSync.jsx";

// The featured shows with a place on the FM schedule, so each one can also
// be reminded about.
const PICKS = SHOW_DIRECTORY.filter((show) => show.schedule?.length).slice(0, 6);

function FollowCard({ show }) {
  const followed = useIsFavorite("shows", show);
  return (
    <button
      className={`welcome-show ${followed ? "followed" : ""}`}
      aria-pressed={followed}
      onClick={() => {
        tap();
        toggleFavorite("shows", show);
      }}
    >
      <Art src={show.img} alt="" />
      <span className="welcome-show-text">
        <strong>{shortName(show)}</strong>
        <small>{show.times[0]}</small>
      </span>
      <span className="welcome-check" aria-hidden="true">
        <Icon name={followed ? "check" : "plus"} size={16} />
      </span>
    </button>
  );
}

// What a reminder will look like: the benefit, shown rather than described.
function ReminderPreview({ show }) {
  const live = SHOWS[show.id] || show;
  return (
    <figure className="reminder-preview" aria-label="Example reminder">
      <img src={STATION_ART} alt="" />
      <figcaption>
        <span className="reminder-preview-top">
          <strong>WXPN</strong>
          <small>now</small>
        </span>
        <strong>{live.name} starts in 5 minutes</strong>
        <span>{live.host ? `${live.host} on WXPN 88.5` : "On WXPN 88.5"}. Tap to listen.</span>
      </figcaption>
    </figure>
  );
}

// The playlist a listener's hearts build, shown rather than described.
function PlaylistPreview() {
  return (
    <figure className="reminder-preview playlist-preview" aria-label="Example playlist">
      <span className="playlist-preview-art" aria-hidden="true">
        <Icon name="heartF" size={22} />
      </span>
      <figcaption>
        <span className="reminder-preview-top">
          <strong>Playlist</strong>
        </span>
        <strong>{PLAYLIST_NAME}</strong>
        <span>Every song you heart in the WXPN app, newest first.</span>
      </figcaption>
    </figure>
  );
}

// First launch only: follow a few shows, turn on reminders for them, and
// connect Spotify or Apple Music so hearted songs build a playlist. A step
// with nothing to offer is left out (no reminders without a followed show, no
// playlist step when no service is set up). Closing it any way counts as
// done; it never comes back.
export function Welcome({ onDone }) {
  const followed = useFavoriteItems("shows");
  const services = offeredServices();
  const steps = [
    "follow",
    ...(followed.length ? ["remind"] : []),
    ...(services.length ? ["music"] : []),
  ];
  const [stepName, setStepName] = useState("follow");
  const step = Math.max(0, steps.indexOf(stepName));
  const next = () => (step + 1 < steps.length ? setStepName(steps[step + 1]) : onDone());
  // Progress as a row of short bars, one per step, filled up to this one.
  const counter = (
    <span className="welcome-step">
      <span className="welcome-bars" aria-hidden="true">
        {steps.map((name, i) => (
          <i key={name} data-on={i <= step || undefined} />
        ))}
      </span>
      <span className="sr-only">{`Step ${step + 1} of ${steps.length}`}</span>
    </span>
  );
  const heading = useRef(null);

  // Each step replaces the button that was just pressed, so move focus to
  // the new step's heading rather than let it fall back to the page.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    heading.current?.focus();
  }, [stepName]);

  // Turning reminders on waits for the phone's permission prompt; the button
  // holds still meanwhile so a second tap can't ask twice.
  const [asking, setAsking] = useState(false);
  const turnOn = async () => {
    setAsking(true);
    try {
      await enableReminders({ quiet: true });
    } finally {
      setAsking(false);
    }
    next();
  };

  return (
    <Modal
      title="Welcome to WXPN"
      eyebrow="88.5 FM · PHILADELPHIA"
      onClose={onDone}
      className="welcome-dialog"
    >
      <div className="detail-body welcome">
        {stepName === "follow" ? (
          <>
            <h3 ref={heading} tabIndex={-1}>
              Follow the shows you love
            </h3>
            <p className="welcome-lede">
              They’ll be waiting in Favorites, and the app can remind you when they start.
            </p>
            <div className="welcome-grid">
              {PICKS.map((show) => (
                <FollowCard key={show.id} show={show} />
              ))}
            </div>
            <div className="welcome-actions">
              {counter}
              {followed.length ? (
                <button className="primary-button" onClick={next}>
                  Next
                </button>
              ) : (
                <button className="text-button" onClick={next}>
                  Skip for now
                </button>
              )}
            </div>
          </>
        ) : stepName === "music" ? (
          <>
            <h3 ref={heading} tabIndex={-1}>
              Keep every song you love
            </h3>
            <p className="welcome-lede">
              Connect {services.map((s) => s.name).join(" or ")}, and every song you heart here goes
              into a “{PLAYLIST_NAME}” playlist there, ready to play any time.
            </p>
            <PlaylistPreview />
            <div className="connect-buttons">
              {services.map((s, i) => (
                <button
                  key={s.id}
                  className={i === 0 ? "primary-button" : "secondary-button"}
                  onClick={() => {
                    // Done first: connecting may leave the app to sign in.
                    onDone();
                    connect(s.id);
                  }}
                >
                  Connect {s.name}
                </button>
              ))}
            </div>
            <div className="welcome-actions">
              {counter}
              <button className="text-button" onClick={onDone}>
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 ref={heading} tabIndex={-1}>
              Never miss a show
            </h3>
            <p className="welcome-lede">
              Get a reminder 5 minutes before {nameList(followed.map((s) => s.name))}{" "}
              {followed.length === 1 ? "starts" : "start"}.
              {notificationsAreNative() && " Your phone will ask to allow notifications."}
            </p>
            <ReminderPreview show={followed[0]} />
            {!notificationsAreNative() && (
              <p className="data-note">In a browser, reminders appear while WXPN is open.</p>
            )}
            <div className="welcome-actions">
              {counter}
              <button className="text-button" onClick={next}>
                Not now
              </button>
              <button className="primary-button" onClick={turnOn} disabled={asking}>
                Turn on reminders
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
