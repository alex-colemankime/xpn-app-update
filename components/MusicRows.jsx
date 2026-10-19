import { useState } from "react";
import { Icon, Art, shareText } from "../ui.jsx";
import { showToast } from "../toast.js";
import { PlaylistStatus } from "./PlaylistSync.jsx";
import { tap } from "../haptics.js";
import {
  getFavorite,
  restoreFavorite,
  songId,
  toggleFavorite,
  useIsFavorite,
} from "../favorites.js";
import { readJson, writeJson } from "../storage.js";
import { PLAYLIST_URL, appleMusicSearch, spotifySearch } from "../links.js";
import { SHOWS, shortName } from "../catalog.js";
import { playedAt } from "../nowplaying.js";
import { useArtTint } from "../art-tint.js";
import { openShow, parseRoute, routeHash } from "../hooks/useRoute.js";
import { holdable, openHoldMenu } from "../hold.js";
import { useNearScreen } from "../hooks/useNearScreen.js";

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

// What follows the first thing ever saved: where it went. Following a show
// offers reminders in place, so no hint on top of that.
function announceSave(type) {
  if (type !== "shows") firstSaveHint(type);
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
  // Its color is read from the artwork only once the heart is near the
  // screen, so a long list of saved songs doesn't fetch every cover at once.
  const [nearRef, near] = useNearScreen();
  const tint = useHeartTint(type, item, saved && near);
  // Pops only on the tap that saves, not on every render of a saved item.
  const [pop, setPop] = useState(false);
  return (
    <button
      ref={nearRef}
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
          announceSave(type);
        }
      }}
    >
      <Icon name={saved ? "heartF" : "heart"} size={children ? 18 : 20} />
      {typeof children === "function" ? children(saved) : children}
    </button>
  );
}

// A song's sheet: about the song, its Save, the song on Spotify and Apple
// Music, Share, and (with a playlist connected) where it stands there. A
// sheet from the bottom on phones; on wider screens it hangs from `from`,
// the row or button that opened it.
export function openSongSheet(track, stationLabel, from) {
  openHoldMenu({
    label: `${track.title} by ${track.artist}`,
    from,
    render: (close) => (
      <>
        <MenuHead art={track.img} title={track.title} line={track.artist} />
        <SongSheetItems track={track} stationLabel={stationLabel} close={close} />
      </>
    ),
  });
}

// The "…" beside Listen's song: its sheet, hanging from the button.
export function SongMenu({ track, stationLabel = "WXPN", className = "icon-button" }) {
  return (
    <button
      className={className}
      aria-label={`More for ${track.title}`}
      aria-haspopup="dialog"
      onClick={(e) => openSongSheet(track, stationLabel, e.currentTarget)}
    >
      <Icon name="more" />
    </button>
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

// The song on the services listeners play it on: their search for it,
// which a phone hands to the app where it is installed (links.js).
const ELSEWHERE = [
  ["Spotify", spotifySearch],
  ["Apple Music", appleMusicSearch],
];

// A song's sheet, in order: Save, the song elsewhere, Share, and its place
// in a connected playlist. A show's own segment in the playlist (a World
// Cafe session hour) isn't a song on those services: it offers the show.
export function SongSheetItems({ track, stationLabel = "WXPN", close }) {
  const show = track.show && SHOWS[track.show];
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
  const query = `${track.title} ${track.artist || ""}`.trim();
  return (
    <>
      <MenuSave
        type="songs"
        item={{ ...track, id: songId(track) }}
        name={track.title}
        close={close}
      />
      {show ? (
        <a
          href={routeHash({ screen: parseRoute(window.location.hash).screen, showId: track.show })}
          // Through the router, as every show opens, so closing it steps
          // back rather than leaving an extra entry behind.
          onClick={(e) => {
            e.preventDefault();
            close();
            openShow(track.show);
          }}
        >
          View {shortName(show)}
          <Icon name="chev" size={16} />
        </a>
      ) : (
        ELSEWHERE.map(([name, url]) => (
          <a key={name} href={url(query)} target="_blank" rel="noreferrer" onClick={close}>
            Open in {name}
            <Icon name="out" size={16} />
          </a>
        ))
      )}
      <button onClick={share}>
        Share song
        <Icon name="shareAlt" size={16} />
      </button>
      <PlaylistStatus track={track} />
    </>
  );
}

// A song's press-and-hold: the same sheet a tap on its row opens.
export const songHold = (track, stationLabel) =>
  holdable((el) => openSongSheet(track, stationLabel, el));

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

export const SaveSong = ({ track, className }) => (
  <SaveButton
    type="songs"
    item={{ ...track, id: songId(track) }}
    name={track.title}
    className={className}
  />
);

// Saves a song without its button (a double tap on Listen's artwork): saves
// it, or leaves it saved, as photo apps' double tap only ever likes.
export function heartSong(track) {
  const item = { ...track, id: songId(track) };
  tap();
  if (getFavorite("songs", item)) return;
  toggleFavorite("songs", item);
  announceSave("songs");
}

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

// A song in a list: the row itself opens the song's sheet (so does a
// press and hold), and its heart, at the end, saves it. `showTime` adds
// when it played, for the station's playlist; saved songs leave it out.
// `stationLabel` names the station it played on, for sharing.
export function TrackRow({ track, showTime = false, stationLabel }) {
  return (
    <div className="track-row">
      <button
        ref={songHold(track, stationLabel)}
        className="track-open"
        aria-haspopup="dialog"
        onClick={(e) => openSongSheet(track, stationLabel, e.currentTarget)}
      >
        {/* The station's playlist reads as a log: when it played first, in
            a column of its own, then the song. */}
        {showTime && <time className="track-time">{track.time ? playedAt(track) : ""}</time>}
        <Art src={track.img} loading="lazy" />
        <span>
          <strong>{track.title}</strong>
          <small className="track-meta">
            <span>{track.artist}</span>
          </small>
        </span>
      </button>
      <SaveSong track={track} />
    </div>
  );
}
