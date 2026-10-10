import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Art, focusFirstItem, shareText } from "../ui.jsx";
import { showToast } from "../toast.js";
import { PlaylistMenuItems } from "./PlaylistSync.jsx";
import { addToCalendar } from "../calendar.js";
import { tap } from "../haptics.js";
import {
  getFavorite,
  restoreFavorite,
  songId,
  toggleFavorite,
  useIsFavorite,
} from "../favorites.js";
import { readJson, writeJson } from "../storage.js";
import { PLAYLIST_URL } from "../links.js";
import { SHOWS, shortName } from "../catalog.js";
import { playedAt } from "../nowplaying.js";
import { useArtTint } from "../art-tint.js";

// The artwork a saved heart takes its color from, and a precomputed tint
// when the item is one of the station's shows. A show's segment in the
// playlist (a World Cafe session hour) takes the show's color: its photo is
// often black and white, which would leave the heart uncolored.
function tintSource(type, item) {
  const show =
    type === "shows"
      ? SHOWS[item.id]
      : type === "episodes"
        ? SHOWS[item.showId]
        : type === "songs"
          ? SHOWS[item.show] // a show's own segment in the playlist
          : null;
  const art =
    type === "concerts" ? null : type === "songs" && show ? show.img : item.img || item.poster;
  return { art, preset: show?.tint || null };
}

// "Wed, Oct 7 · Union Transfer", for the notice after saving a concert.
const CONCERT_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const concertWhen = (c) =>
  [c.date && CONCERT_DAY.format(new Date(`${c.date}T12:00:00`)), c.artist]
    .filter(Boolean)
    .join(" · ");

// The first time a listener saves anything, say where it went.
const HINT_KEY = "xpn.hint.saved";
function firstSaveHint(type) {
  if (readJson(HINT_KEY, false)) return;
  writeJson(HINT_KEY, true);
  const what = {
    songs: "song",
    shows: "show",
    episodes: "episode",
    concerts: "concert",
    videos: "video",
  }[type];
  showToast(
    { title: "Saved to Favorites", text: `Your ${what}s are kept there.` },
    {
      label: "View",
      onClick: () => {
        window.location.hash = "#/favorites";
      },
    },
  );
}

// A heart toggle for any saveable item: a song, show, episode, concert or
// video. Once saved, the heart takes a color from the item's artwork.
export function SaveButton({
  type,
  item,
  name,
  verb = "Save",
  className = "icon-button",
  children,
  onToggle,
}) {
  const saved = useIsFavorite(type, item);
  const { art, preset } = tintSource(type, item);
  const tint = useArtTint(saved ? art : null, saved ? preset : null);
  // Pops only on the tap that saves, not on every render of a saved item.
  const [pop, setPop] = useState(false);
  return (
    <button
      className={`${className} ${saved ? "saved" : ""}`}
      // A heart alone keeps one name and says on/off with aria-pressed; a
      // button with words ("Following") says it in the words instead.
      aria-pressed={children ? undefined : saved}
      aria-label={children ? undefined : `${verb} ${name}`}
      data-pop={pop || undefined}
      data-tinted={tint ? "" : undefined}
      style={tint ? { "--tint-light": tint.light, "--tint-dark": tint.dark } : undefined}
      onAnimationEnd={() => setPop(false)}
      onClick={() => {
        tap();
        const before = saved ? getFavorite(type, item) : null;
        toggleFavorite(type, item);
        onToggle?.(!saved);
        if (saved) {
          // Removing is one tap, so it can be taken back.
          showToast(
            { title: "Removed from Favorites", text: name || item.name || item.title },
            {
              label: "Undo",
              onClick: () => restoreFavorite(type, before),
            },
          );
        } else {
          setPop(true);
          if (type === "concerts") {
            // A saved concert is one tap from the listener's calendar.
            showToast(
              { title: "Concert saved", text: concertWhen(item), icon: "calendarAdd" },
              {
                label: "Add to calendar",
                onClick: async () => {
                  if (!(await addToCalendar(item)))
                    showToast(
                      "Couldn’t open your calendar. Allow calendar access for WXPN in Settings.",
                    );
                },
              },
            );
          } else if (type !== "shows") {
            // Following a show offers reminders in place; no hint on top.
            firstSaveHint(type);
          }
        }
      }}
    >
      <Icon name={saved ? "heartF" : "heart"} size={children ? 18 : 20} />
      {typeof children === "function" ? children(saved) : children}
    </button>
  );
}

// The "…" for a song: its place in the listener's connected playlist (or a
// way to connect one), and Share. A popover anchored to its button (a bottom
// sheet on phones).
export function SongMenu({ track, stationLabel = "WXPN" }) {
  const menuId = `song-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // The menu's contents exist only while it is open: a list of 50 songs
  // then carries 50 buttons, not 50 menus. They are drawn at once on
  // opening, so focus can move to the first of them.
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const onToggle = (e) => {
    flushSync(() => setOpen(e.newState === "open"));
    focusFirstItem(e);
  };
  const close = () => menu.current?.hidePopover();
  const share = async () => {
    close();
    showToast(
      await shareText(
        track.title,
        `${track.title} — ${track.artist}, heard on ${stationLabel}`,
        PLAYLIST_URL,
      ),
    );
  };
  return (
    <>
      <button
        className="icon-button"
        popoverTarget={menuId}
        aria-label={`More for ${track.title}`}
        style={{ anchorName: `--${menuId}` }}
      >
        <Icon name="more" />
      </button>
      <div
        id={menuId}
        ref={menu}
        onToggle={onToggle}
        className="popover-menu"
        popover="auto"
        role="dialog"
        aria-label={`${track.title} by ${track.artist}`}
        style={{ positionAnchor: `--${menuId}` }}
      >
        {open && (
          <>
            <div className="popover-menu-head">
              <Art src={track.img} alt="" />
              <span>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </span>
            </div>
            <PlaylistMenuItems track={track} close={close} />
            <button onClick={share}>
              Share song
              <Icon name="shareAlt" size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

export const SaveSong = ({ track }) => (
  <SaveButton type="songs" item={{ ...track, id: songId(track) }} name={track.title} />
);

// A show's artwork, name and host as one button (so only words that may sit
// in a button: no headings or paragraphs inside it).
export function ShowCard({ show, onOpen }) {
  return (
    <button className="show-card" onClick={() => onOpen(show.id)}>
      <span className="show-cover">
        <Art src={show.img} alt="" loading="lazy" />
      </span>
      <strong className="show-card-name">{shortName(show)}</strong>
      <small className="show-card-when">{show.host || show.times?.[0]}</small>
    </button>
  );
}

// A song in a list. `showTime` adds when it played, for the station's
// playlist; saved songs leave it out. A saved song's heart carries its color,
// and in Favorites (`wash`) so does its row.
// `stationLabel` names the station it played on, for sharing.
export function TrackRow({ track, showTime = false, stationLabel, wash = false }) {
  // Saved songs (wash) sit on a light wash of their own artwork's color.
  const tint = useArtTint(wash ? track.img : null);
  return (
    <div
      className="track-row"
      data-tinted={tint ? "" : undefined}
      style={tint ? { "--tint-light": tint.light, "--tint-dark": tint.dark } : undefined}
    >
      <Art src={track.img} loading="lazy" />
      <span>
        <strong>{track.title}</strong>
        <small className="track-meta">
          <span>{track.artist}</span>
          {showTime && track.time && <time className="track-time">{playedAt(track)}</time>}
        </small>
      </span>
      <SaveSong track={track} />
      <SongMenu track={track} stationLabel={stationLabel} />
    </div>
  );
}
