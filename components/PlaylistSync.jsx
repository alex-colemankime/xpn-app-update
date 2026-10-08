import { Icon } from "../ui.jsx";
import { SHOW_SAMPLES } from "../config.js";
import { songId, toggleFavorite, useFavoriteItems, useIsFavorite } from "../favorites.js";
import { PLAYLIST_NAME, SERVICES, availableServices } from "../music-services.js";
import { connect, disconnect, syncNow, usePlaylistSync } from "../playlist-sync.js";

// Which services to offer: the configured ones. A preview build without any
// shows them anyway, so the design can be reviewed.
function offered() {
  const services = availableServices();
  return services.length ? services : SHOW_SAMPLES ? Object.values(SERVICES) : [];
}
export const offeredServices = offered;

function status(sync, service, count) {
  if (sync.status === "syncing") return "Adding your songs…";
  if (sync.status === "signed-out")
    return `${service.name} signed you out. Reconnect to keep your playlist up to date.`;
  if (sync.status === "error") return `Couldn’t reach ${service.name}. It will try again shortly.`;
  if (sync.status === "not-allowed")
    return `${service.name} hasn’t opened WXPN’s playlist feature to your account yet.`;
  const inPlaylist = Object.keys(sync.matched).length;
  const missing = sync.missing.length;
  if (!count) return `Save a song and it goes straight into “${PLAYLIST_NAME}”.`;
  return `${inPlaylist} ${inPlaylist === 1 ? "song" : "songs"} in “${PLAYLIST_NAME}”${
    missing ? ` · ${missing} not on ${service.name}` : ""
  }.`;
}

// Settings: connect a service, see how the playlist is doing, disconnect.
export function PlaylistSyncPanel() {
  const sync = usePlaylistSync();
  const saved = useFavoriteItems("songs");
  const services = offered();
  if (!services.length) return null;
  const service = SERVICES[sync.service];
  return (
    <section className="settings-panel">
      <h2>
        <Icon name="music" />
        Your playlist
      </h2>
      {service ? (
        <>
          <p className="setting-status">
            <strong>Connected to {service.name}</strong>
            <span>{status(sync, service, saved.length)}</span>
          </p>
          <div className="button-row">
            {sync.status === "signed-out" ? (
              <button className="primary-button" onClick={() => connect(service.id)}>
                Reconnect {service.name}
              </button>
            ) : (
              sync.playlistUrl && (
                <a
                  className="secondary-button"
                  href={sync.playlistUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in {service.name}
                </a>
              )
            )}
            {sync.status === "error" && (
              <button className="secondary-button" onClick={syncNow}>
                Try again
              </button>
            )}
            <button className="text-button" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {!service.remove && (
            <p className="data-note">
              {service.name} doesn’t let apps take songs out of playlists, so removing a song here
              leaves it there.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="data-note">
            Connect once, and every song you heart in the app goes into a “{PLAYLIST_NAME}” playlist
            there, ready to play any time.
          </p>
          <ul className="service-list">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  className="setting-row full-width service-row"
                  onClick={() => connect(s.id)}
                >
                  <span className="service-name">{s.name}</span>
                  <span className="service-connect">
                    Connect
                    <Icon name="chev" size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// Favorites: a one-line invitation, until a service is connected.
export function PlaylistSyncPrompt({ onSetUp }) {
  const sync = usePlaylistSync();
  const services = offered();
  if (!services.length || sync.service) {
    if (!sync.service) return null;
    return (
      <p className="playlist-prompt connected">
        <Icon name="check" size={16} />
        Saving to “{PLAYLIST_NAME}” on {SERVICES[sync.service].name}
      </p>
    );
  }
  return (
    <button className="playlist-prompt" onClick={onSetUp}>
      <Icon name="music" size={18} />
      <span>Add every song you heart to a {services.map((s) => s.name).join(" or ")} playlist</span>
      <Icon name="chev" size={16} />
    </button>
  );
}

// The song menu's part: until a service is connected, the way to connect
// one; after, where this song stands in the playlist (or a way to add it).
export function PlaylistMenuItems({ track, close }) {
  const sync = usePlaylistSync();
  const item = { ...track, id: songId(track) };
  const saved = useIsFavorite("songs", item);
  const services = offered();
  if (!services.length) return null;
  const service = SERVICES[sync.service];
  if (!service) {
    return (
      <>
        <p className="popover-menu-note">
          Connect your music, and every song you heart goes into a “{PLAYLIST_NAME}” playlist.
        </p>
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              close();
              connect(s.id);
            }}
          >
            Connect {s.name}
            <Icon name="music" size={16} />
          </button>
        ))}
      </>
    );
  }
  if (!saved) {
    return (
      <button
        onClick={() => {
          close();
          toggleFavorite("songs", item);
        }}
      >
        Add to “{PLAYLIST_NAME}” on {service.name}
        <Icon name="heart" size={16} />
      </button>
    );
  }
  const where = sync.matched[item.id]
    ? `In “${PLAYLIST_NAME}” on ${service.name}`
    : sync.missing.includes(item.id)
      ? `Saved here; ${service.name} doesn’t have this song`
      : `Adding to “${PLAYLIST_NAME}” on ${service.name}…`;
  return (
    <p className="popover-menu-note">
      <Icon name="check" size={16} />
      {where}
    </p>
  );
}
