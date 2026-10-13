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
import { useArtTint, washVars } from "../art-tint.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { holdable, openHoldMenu } from "../hold.js";

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

// The color a saved item's heart takes, from its artwork (null: none, so
// the accent). `on` false asks for nothing yet.
export function useHeartTint(type, item, on = true) {
  const { art, preset } = tintSource(type, item || {});
  return useArtTint(on ? art : null, on ? preset : null);
}
const tintVars = (tint) =>
  tint ? { "--tint-light": tint.light, "--tint-dark": tint.dark } : undefined;

// What follows a save: for a concert, a notice with Add to calendar; for
// the first thing ever saved, where it went.
function announceSave(type, item) {
  if (type === "concerts") {
    // A saved concert is one tap from the listener's calendar.
    showToast(
      { title: "Concert saved", text: concertWhen(item), icon: "calendarAdd" },
      {
        label: "Add to calendar",
        onClick: async () => {
          if (!(await addToCalendar(item)))
            showToast("Couldn’t open your calendar. Allow calendar access for WXPN in Settings.");
        },
      },
    );
  } else if (type !== "shows") {
    // Following a show offers reminders in place; no hint on top.
    firstSaveHint(type);
  }
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
  const tint = useHeartTint(type, item, saved);
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
      style={tintVars(tint)}
      onAnimationEnd={() => setPop(false)}
      onClick={() => {
        tap();
        const before = saved ? getFavorite(type, item) : null;
        toggleFavorite(type, item);
        onToggle?.(!saved);
        if (saved) {
          // Removing is one tap, so it can be taken back: a small pill with
          // Undo, gone in a moment.
          showToast(type === "shows" ? "Unfollowed" : "Removed from Favorites", {
            label: "Undo",
            onClick: () => restoreFavorite(type, before),
          });
        } else {
          setPop(true);
          announceSave(type, item);
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
  const drag = useSheetDrag();
  const onToggle = (e) => {
    flushSync(() => setOpen(e.newState === "open"));
    focusFirstItem(e);
  };
  const close = () => menu.current?.hidePopover();
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
        ref={(el) => {
          menu.current = el;
          return drag(el);
        }}
        onToggle={onToggle}
        className="popover-menu"
        popover="auto"
        role="dialog"
        aria-label={`${track.title} by ${track.artist}`}
        style={{ positionAnchor: `--${menuId}` }}
      >
        {open && (
          <>
            <MenuHead art={track.img} title={track.title} line={track.artist} />
            <SongMenuItems track={track} stationLabel={stationLabel} close={close} />
          </>
        )}
      </div>
    </>
  );
}

// What a menu is about, over its choices: artwork (if any), a title and a
// muted line.
export function MenuHead({ art, title, line }) {
  return (
    <div className="popover-menu-head">
      {art && <Art src={art} alt="" />}
      <span>
        <strong>{title}</strong>
        {line && <small>{line}</small>}
      </span>
    </div>
  );
}

// Save (or un-save) as a choice in a menu, the words saying which.
export function MenuSave({ type, item, name, close }) {
  const follow = type === "shows";
  return (
    <SaveButton type={type} item={item} name={name} className="menu-save" onToggle={close}>
      {(saved) =>
        saved
          ? follow
            ? "Unfollow"
            : "Remove from Favorites"
          : follow
            ? "Follow show"
            : "Save to Favorites"
      }
    </SaveButton>
  );
}

// A plain choice in a menu: words, then a small icon at the end.
export function MenuItem({ icon, children, onClick }) {
  return (
    <button onClick={onClick}>
      {children}
      {icon && <Icon name={icon} size={16} />}
    </button>
  );
}

// Shares something from a menu, saying how it went.
export const shareFrom =
  (close, ...what) =>
  async () => {
    close();
    showToast(await shareText(...what));
  };

// A song's choices, in its "…" menu and its press-and-hold menu: its place
// in the listener's playlist, and Share. The hold menu (`withSave`) leads
// with Save, which also adds the song to a connected playlist.
export function SongMenuItems({ track, stationLabel = "WXPN", close, withSave = false }) {
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
      {withSave && (
        <MenuSave
          type="songs"
          item={{ ...track, id: songId(track) }}
          name={track.title}
          close={close}
        />
      )}
      <PlaylistMenuItems track={track} close={close} saveShown={withSave} />
      <button onClick={share}>
        Share song
        <Icon name="shareAlt" size={16} />
      </button>
    </>
  );
}

// A song's press-and-hold menu (hold.js).
export const songHold = (track, stationLabel) =>
  holdable(() =>
    openHoldMenu({
      label: `${track.title} by ${track.artist}`,
      render: (close) => (
        <>
          <MenuHead art={track.img} title={track.title} line={track.artist} />
          <SongMenuItems track={track} stationLabel={stationLabel} close={close} withSave />
        </>
      ),
    }),
  );

// A show's press-and-hold menu: open it, follow it, share it.
export const showHold = (show, onOpen) =>
  holdable(() =>
    openHoldMenu({
      label: show.name,
      render: (close) => (
        <>
          <MenuHead art={show.img} title={show.name} line={show.host} />
          <MenuItem
            icon="chev"
            onClick={() => {
              close();
              onOpen(show.id);
            }}
          >
            View show
          </MenuItem>
          <MenuSave type="shows" item={show} name={show.name} close={close} />
          {show.page && (
            <MenuItem
              icon="shareAlt"
              onClick={shareFrom(close, show.name, `${show.name} on WXPN`, show.page)}
            >
              Share show
            </MenuItem>
          )}
        </>
      ),
    }),
  );

export const SaveSong = ({ track }) => (
  <SaveButton type="songs" item={{ ...track, id: songId(track) }} name={track.title} />
);

// Saves an item without its button (a double tap on Listen's artwork or on
// a concert): saves it, or leaves it saved, as photo apps' double tap only
// ever likes.
export function heartItem(type, item) {
  tap();
  if (getFavorite(type, item)) return;
  toggleFavorite(type, item);
  announceSave(type, item);
}
export const heartSong = (track) => heartItem("songs", { ...track, id: songId(track) });

// The heart that blooms over whatever a double tap just saved, in the
// color that item's own heart takes, outlined in white so it shows on any
// artwork. Each bloom has its own key, so a second double tap plays it again.
export function HeartBloom({ type, item, bloom, onEnd, size = 88 }) {
  const tint = useHeartTint(type, item);
  if (!bloom) return null;
  return (
    <span
      key={bloom}
      className="art-heart"
      data-tinted={tint ? "" : undefined}
      style={tintVars(tint)}
      aria-hidden="true"
      onAnimationEnd={onEnd}
    >
      <Icon name="heartF" size={size} />
    </span>
  );
}

// A show's artwork, name and host as one button (so only words that may sit
// in a button: no headings or paragraphs inside it).
export function ShowCard({ show, onOpen }) {
  return (
    <button ref={showHold(show, onOpen)} className="show-card" onClick={() => onOpen(show.id)}>
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
      ref={songHold(track, stationLabel)}
      className="track-row"
      data-tinted={tint ? "" : undefined}
      style={tint ? washVars("band", tint, 0, [0.32, 0.34]) : undefined}
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
