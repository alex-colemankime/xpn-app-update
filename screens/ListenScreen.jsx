import { STREAMS } from "../player.js";
import { Icon, Art, shareText } from "../ui.jsx";
import { clockLabel } from "../catalog.js";
import { SaveSong, TrackRow } from "../components/MusicRows.jsx";

export function ListenScreen({ streamId, pickStation, station, current, fresh, playlist, status, playing, togglePlay, playLabel, setMessage, castAvailable, cast, historyExpanded, setHistoryExpanded, favorites, navigate }) {
 return (<>
            <div className="listen-heading">
              <h1>Listen live</h1>
              <div className="station-switcher" role="group" aria-label="Radio station">
                {Object.values(STREAMS).map((s) => (
                  <button
                    key={s.id}
                    className={`station ${streamId === s.id ? "selected" : ""}`}
                    aria-pressed={streamId === s.id}
                    onClick={() => pickStation(s.id)}
                  >
                    <strong>{s.label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="live-workspace">
              <section className="now-card" aria-label="Current song">
                <div className="now-art">
                  {current?.img ? (
                    <Art
                      src={current.img}
                      alt={`${current.album || current.title} — ${current.artist}`}
                    />
                  ) : (
                    <div className="station-art">
                      <strong>
                        {streamId === "kids"
                          ? "Kids Corner"
                          : streamId === "xpn2"
                            ? "xpn2"
                            : "wxpn"}
                      </strong>
                      <span>{station.tagline}</span>
                    </div>
                  )}
                </div>
                <div className="now-info" aria-live="polite">
                  <span className="eyebrow">
                    {current
                      ? fresh
                        ? "NOW PLAYING"
                        : "LAST REPORTED SONG"
                      : playlist.status === "loading"
                        ? "LOADING SONG INFO"
                        : "LIVE STREAM"}
                  </span>
                  <h2>{current?.title || station.label}</h2>
                  <p className="now-artist">{current?.artist || station.tagline}</p>
                  {current?.album && <p className="now-album">{current.album}</p>}
                </div>
                <div className="now-controls">
                  {current ? <SaveSong track={current} /> : <span className="control-space" />}
                  <button
                    className="primary-button"
                    onClick={togglePlay}
                    aria-label={
                      status === "loading"
                        ? "Cancel connecting"
                        : `${playing ? "Pause" : "Play"} ${station.label}`
                    }
                  >
                    <Icon name={playing || status === "loading" ? "pause" : "play"} size={21} />
                    {playLabel}
                  </button>
                  {current ? (
                    <button
                      className="icon-button"
                      aria-label={`Share ${current.title}`}
                      onClick={async () =>
                        setMessage(
                          await shareText(
                            current.title,
                            `${current.title} — ${current.artist}, heard on ${station.label}`,
                          ),
                        )
                      }
                    >
                      <Icon name="shareAlt" />
                    </button>
                  ) : (
                    <span className="control-space" />
                  )}
                </div>
                <div className="now-status" role="status">
                  {status === "error"
                    ? "The stream could not connect. Tap Try again."
                    : playlist.status === "unavailable"
                      ? streamId === "kids"
                        ? "Song information is not available for this stream."
                        : "Song updates are temporarily unavailable. Audio is independent."
                      : !current && playlist.status === "empty"
                        ? "Waiting for the station’s next song update."
                        : playing
                          ? "Listening live"
                          : status === "loading"
                            ? "Connecting to the live broadcast…"
                            : "Press play to join the live broadcast."}
                </div>
                <div className="now-footer">
                  <span>
                    {current?.time ? `Reported at ${clockLabel(current.time)} ET` : "Live radio"}
                  </span>
                  {castAvailable && (
                    <button className="text-button" onClick={cast}>
                      <Icon name="cast" size={16} />
                      Audio output
                    </button>
                  )}
                </div>
              </section>
              <div className="live-lists">
                <section className="recent-panel">
                  <div className="section-heading">
                    <h2>Recently played</h2>
                    <span className="subtle">{station.label} · ET</span>
                  </div>
                  {playlist.tracks.length > 1 ? (
                    <>
                      {playlist.tracks.slice(1, historyExpanded ? 51 : 7).map((t, i) => (
                        <TrackRow key={`${t.title}-${t.time}-${i}`} track={t} />
                      ))}
                      {playlist.tracks.length > 7 && (
                        <button
                          className="text-button playlist-expand"
                          onClick={() => setHistoryExpanded(!historyExpanded)}
                        >
                          {historyExpanded ? "Show fewer songs" : "Show more songs"}
                          <Icon name={historyExpanded ? "chevD" : "arrowRight"} size={17} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="playlist-empty">
                      <Icon name="music" size={25} />
                      <p>
                        {playlist.status === "loading"
                          ? "Loading the station playlist…"
                          : streamId === "kids"
                            ? "A playlist is not available for Kids Corner."
                            : "The station has not reported any recent songs."}
                      </p>
                      {streamId !== "kids" && (
                        <a
                          className="text-button"
                          href="https://xpn.org/wxpn-playlists/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open WXPN’s playlist
                          <Icon name="arrowUp" size={16} />
                        </a>
                      )}
                    </div>
                  )}
                </section>
                <section className="saved-preview">
                  <div className="section-heading">
                    <h2>Your saved songs</h2>
                    <button className="text-button" onClick={() => navigate("library")}>
                      View all
                      <Icon name="arrowRight" size={16} />
                    </button>
                  </div>
                  {favorites.items.length ? (
                    favorites.items.slice(0, 3).map((t) => <TrackRow key={t.id} track={t} />)
                  ) : (
                    <p className="saved-empty">Tap the heart beside a song to save it here.</p>
                  )}
                </section>
              </div>
            </div>
</>);
}
