import { useState, useEffect, useMemo, useRef } from "react";
import { initPlayer, playStream, pauseStream, setStream, setPlayerVolume, STREAMS } from "./player.js";
import { isMobile, C, F, ibtn, row, kicker, screenTitle } from "./theme.js";
import { ic } from "./icons.jsx";
import { ALBUMS, ART, ARTIST, TRACK, HOSTS, SHOWS, publicAsset } from "./data.js";
import { fetchConcerts, useSavedConcerts, monthLabel } from "./concerts.js";
import { useFavorites, songId } from "./favorites.js";
import { DAY_LABELS, useAlarmSettings, dateKey, timeKey, formatAlarmTime } from "./alarm.js";

/* Placeholder "now playing" per stream, so switching streams visibly
   changes the hero and mini player instead of showing WXPN's song over
   Kids Corner. The live metadata feed (player.js setMetadata hook /
   the per-stream now-playing API) replaces these once wired. */
const STREAM_NOW = {
  xpn:  { title: "Returning to Myself", artist: "Brandi Carlile", img: ART },
  xpn2: { title: "Motion Sickness", artist: "Phoebe Bridgers", img: ALBUMS.nobody },
  kids: { title: "Don't Blame the Kids", artist: "Lunch Money", img: ALBUMS.jubilee },
};

/* External destinations, centralized so there's one place to confirm
   each URL before launch (mirrors how stream mounts live in player.js). */
const LINKS = {
  donate: "https://xpn.org/donate/",
  xpn: "https://xpn.org/",
  contactEmail: "wxpndesk@xpn.org",
  privacy: "https://xpn.org/privacy-policy/",
};
const openExternal = (url) => { try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* no-op */ } };

/* Share a song via the OS share sheet (native on iOS/Android through the
   WebView), falling back to copying text if Web Share isn't available. */
const shareSong = async (song) => {
  const text = `${song.title} — ${song.artist}, heard on WXPN`;
  try {
    if (navigator.share) { await navigator.share({ title: "WXPN", text }); return; }
    await navigator.clipboard?.writeText(text);
  } catch { /* user cancelled or unsupported — no-op */ }
};

const episodeFavoriteId = (show, episode) => songId({ title: episode.title, artist: show.name });
const episodeFavoriteItem = (show, episode, savedAt) => ({
  id: episodeFavoriteId(show, episode),
  title: episode.title,
  showId: show.id,
  showName: show.name,
  host: show.host,
  date: episode.date,
  dur: episode.dur,
  img: episode.img || show.img,
  savedAt,
});
const ARCHIVE_EPISODES = new Map(
  Object.values(SHOWS).flatMap((show) =>
    (show.episodes || []).map((episode) => {
      const item = episodeFavoriteItem(show, episode);
      return [item.id, item];
    })
  )
);

/* Neutral placeholder shown if a remote image fails to load — far better
   than a broken-image glyph once live album art / portraits are wired,
   since any single 404 would otherwise blemish the row it's in. */
const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23F1E6D4'/%3E%3Cpath d='M30 64l16-20 12 14 8-9 14 15z' fill='%23D6C7AE'/%3E%3Ccircle cx='38' cy='36' r='7' fill='%23D6C7AE'/%3E%3C/svg%3E";
const SmartImg = ({ src, alt = "", style, eager = false }) => (
  <img
    src={src || FALLBACK_IMG}
    alt={alt}
    loading={eager ? "eager" : "lazy"}
    decoding="async"
    onError={(e) => { if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG; }}
    style={style}
  />
);

/* Keyboard-operable row. The list rows carry their own nested buttons
   (the heart), so they can't be <button>s themselves (no nested buttons
   in valid HTML). This gives a plain div proper button semantics:
   focusable, Enter/Space activates, announced as a button to AT. */
const Pressable = ({ onClick, style, children, ariaLabel }) => (
  <div
    role="button"
    tabIndex={0}
    aria-label={ariaLabel}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(e); }
    }}
    style={style}
  >
    {children}
  </div>
);

/* ─── BOTTOM SHEET (shared) ───
   One sheet primitive behind both the More menu and the stream picker,
   so they stay visually identical and both get the same accessibility:
   role="dialog" + aria-modal, Escape to close, background scroll lock,
   and a tap-scrim. Content is passed as children. */
const Sheet = ({ open, onClose, title, children, maxHeight }) => {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0, background: "rgba(40,32,26,0.55)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          maxHeight: maxHeight || "72%",
          background: C.card, borderRadius: "4px 4px 0 0",
          borderTop: `3px solid ${C.accent}`,
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "10px 12px 12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${C.divider}`, flexShrink: 0,
        }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span aria-hidden="true" style={{ width: 42, height: 3, borderRadius: 2, background: C.divider }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontFamily: F.display }}>{title}</span>
          </span>
          <button aria-label="Close" onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation",
          }}>
            {ic.close(20, C.textMut)}
          </button>
        </div>
        <div style={{
          overflow: "auto", overscrollBehaviorY: "contain", flex: 1,
          paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 12px)" : "16px",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════ NAVIGATION MODEL ═══════════════
   One rule set instead of the old screen/sub/settings tangle:

   - Four content tabs: Live, Shows, Concerts, Favorites. The fifth
     tab, More, opens a sheet — it never becomes a "current screen".
   - Detail views (show page, episode player, settings) push onto a
     stack ON TOP of whatever tab you're on. Back pops the stack.
     Favorites → show detail → back lands you back in Favorites, and
     the Favorites tab stays highlighted the whole time. The old code
     hijacked the Shows tab for this and lost your place.
   - The Live tab IS the now-playing screen. The old separate
     swipe-down Now Playing modal duplicated it with a different
     layout; it's gone. Tapping the mini player goes to the Live tab.
*/

/* ─── PHONE WRAPPER ───
   Mobile: full viewport (100vw × 100dvh) — no fake frame
   Desktop: 375×812 mockup with rounded corners + dynamic island */
const Phone = ({ children }) => {
  const bg = `radial-gradient(120% 80% at 50% -10%, rgba(213,78,27,0.06) 0%, rgba(250,242,231,0) 55%), linear-gradient(180deg, ${C.bgTop} 0%, ${C.bg} 100%)`;
  if (isMobile) {
    return (
      <div style={{
        width: "100vw", height: "100dvh",
        background: bg, position: "relative",
        fontFamily: F.body, color: C.text,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{
      width: 375, height: 812, borderRadius: 48, overflow: "hidden",
      background: bg, position: "relative",
      boxShadow: "0 40px 100px rgba(70,45,20,0.30), 0 0 0 1px rgba(70,45,20,0.06)",
      fontFamily: F.body, color: C.text,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 50, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 8,
      }}>
        <div style={{ width: 126, height: 34, borderRadius: 17, background: "#000" }} />
      </div>
      <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
};

/* ─── HEADER ───
   One home for each global action: cast lives here (it's an output-
   device control, not a per-song action) and Donate lives here — the
   ONLY Donate in the app, instead of the old three scattered copies. */
const Header = ({ showBack, onBack }) => (
  <div style={{
    paddingTop: isMobile ? "calc(env(safe-area-inset-top, 44px) + 4px)" : "58px",
    paddingRight: 10, paddingBottom: 6, paddingLeft: 14,
    background: "rgba(250,242,231,0.92)",
    flexShrink: 0,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    display: "flex", alignItems: "center", gap: 4,
  }}>
    {showBack && (
      <button aria-label="Back" onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        width: 36, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center",
        touchAction: "manipulation", marginRight: 2, flexShrink: 0,
      }}>
        {ic.back(22, C.textSec)}
      </button>
    )}
    <img
      src={publicAsset("icons/WXPN_88.5_logo.png")}
      alt="WXPN"
      style={{ height: 31, width: "auto", display: "block", flexShrink: 0 }}
    />
    <span style={{ flex: 1 }} />
    <button onClick={() => openExternal(LINKS.donate)} style={{
      background: C.accentGlow, border: `1px solid ${C.accentBorder}`, borderRadius: 6,
      padding: "0 12px", minHeight: 34, cursor: "pointer",
      fontSize: 13, fontWeight: 800, color: C.accentDim, fontFamily: F.display,
      touchAction: "manipulation",
    }}>
      Donate
    </button>
  </div>
);

/* ─── BOTTOM NAV ─── */
const Nav = ({ active, onNav }) => {
  const tabs = [
    { id: "live", label: "Live", icon: ic.navLive },
    { id: "shows", label: "Shows", icon: ic.navShows },
    { id: "concerts", label: "Concerts", icon: ic.navConcerts },
    { id: "favorites", label: "Favorites", icon: ic.navFav },
    { id: "more", label: "More", icon: ic.menu },
  ];
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "center",
      paddingTop: 6,
      paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : "34px",
      paddingLeft: 10, paddingRight: 10,
      background: "linear-gradient(180deg, rgba(250,242,231,0.35) 0%, rgba(250,242,231,0.98) 100%)",
      borderTop: `1px solid ${C.divider}`,
      flexShrink: 0,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{
            background: "none",
            border: "none",
            borderRadius: 10, cursor: "pointer", display: "flex",
            flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2,
            padding: "6px 4px",
            minWidth: 60,
            minHeight: 48,  // WCAG 2.5.8 minimum target size
            touchAction: "manipulation",
          }}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "4px 16px", borderRadius: 14,
              background: "none",
            }}>{t.icon(20, on ? C.ink : C.textMut)}</span>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? C.ink : C.textMut }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── SCREEN TITLE ───
   The shared opening block for every tab screen — same spot, same
   size, everywhere. Concerts used to be the only screen that told you
   where you were. */
const Title = ({ children }) => (
  <div style={{ padding: "16px 16px 8px" }}>
    <div style={screenTitle}>{children}</div>
  </div>
);

/* ─── MORE MENU — bottom sheet ───
   Only things that genuinely live nowhere else. The old sheet
   duplicated Home (the Live tab), Concert Calendar (the Concerts
   tab), and Donate (the header) — every duplicate is gone. */
const MenuDrawer = ({ open, onClose, items }) => (
  <Sheet open={open} onClose={onClose} title="More">
    {items.map((item, i) => (
      <button
        key={`${item.label}-${i}`}
        onClick={() => { item.action?.(); onClose(); }}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "0 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          color: C.ink, fontSize: 16, fontWeight: 500, textAlign: "left", fontFamily: F.display,
          borderBottom: `1px solid ${C.divider}`,
          minHeight: 52,
          touchAction: "manipulation",
        }}
      >
        <span>{item.label}</span>
        {item.note && <span style={{ fontSize: 11, color: C.textMut, letterSpacing: "0.14em", fontFamily: F.mono }}>{item.note}</span>}
      </button>
    ))}
  </Sheet>
);

/* ─── MINI PLAYER ───
   Tapping it goes to the Live tab — the one and only now-playing
   screen — instead of opening a second, differently-laid-out copy. */
const Mini = ({ onTap, playing, setPlaying, streamId }) => {
  const np = STREAM_NOW[streamId] || STREAM_NOW.xpn;
  const label = (STREAMS[streamId] || STREAMS.xpn).label;
  return (
  <div style={{
    margin: "0 6px 3px",
    borderRadius: 10,
    background: C.surface,
    border: `1px solid ${C.divider}`,
    flexShrink: 0,
    overflow: "hidden",
    boxShadow: "0 2px 14px rgba(70,45,20,0.12)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 6px 6px" }}>
      <SmartImg
        src={np.img}
        style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
      />
      <div
        onClick={onTap}
        role="button" tabIndex={0}
        aria-label={`Now playing ${np.title} by ${np.artist} on ${label}. Open player`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap?.(); } }}
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accentDim, letterSpacing: "0.1em", fontFamily: F.display, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>ON AIR · {label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{np.title}</div>
        <div style={{ fontSize: 13, color: C.textMut }}>{np.artist}</div>
      </div>
      <button
        aria-label={playing ? "Pause live stream" : "Play live stream"}
        onClick={(e) => { e.stopPropagation(); setPlaying(!playing); }}
        style={{
          width: 50, height: 42, borderRadius: 6, border: "none", cursor: "pointer",
          background: playing ? C.ink : C.accent, display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation", flexShrink: 0,
        }}
      >
        {playing ? ic.pause(23, C.white) : ic.play(22, C.white)}
      </button>
    </div>
  </div>
  );
};

/* ─── STREAM TABS — segmented switcher ───
   Replaces the old tap-a-chip-then-open-a-sheet flow. All three streams
   are visible at once; one tap switches. Squared corners and a hard
   active fill keep it editorial rather than bubbly. */
const StreamTabs = ({ current, onPick }) => {
  const streams = [STREAMS.xpn, STREAMS.xpn2, STREAMS.kids];
  return (
    <div role="tablist" aria-label="Live streams" style={{
      display: "flex", gap: 0, padding: 1, margin: "6px 16px 0",
      background: C.surface, borderRadius: 5,
    }}>
      {streams.map((s, i) => {
        const on = s.id === current;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={on}
            onClick={() => onPick(s.id)}
            style={{
              flex: 1, minHeight: 31, borderRadius: 4, border: "none", cursor: "pointer",
              background: on ? C.accent : "transparent",
              color: on ? C.white : C.textSec,
              fontSize: 12.5, fontWeight: on ? 800 : 600, fontFamily: F.display,
              letterSpacing: "0.01em", touchAction: "manipulation",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: i === 0 ? "none" : `inset 1px 0 0 ${on ? "rgba(255,252,246,0.22)" : "rgba(40,32,26,0.08)"}`,
            }}
          >
            {s.short}
          </button>
        );
      })}
    </div>
  );
};

/* Animated equalizer bars — the "live audio is flowing" signal on the
   play control while the stream is playing. Purely decorative. */
const Equalizer = ({ color = C.white, height = 18 }) => (
  <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "flex-end", gap: 2.5, height }}>
    {[0, 1, 2, 3].map((i) => (
      <span key={i} style={{
        width: 3, height, borderRadius: 1.5, background: color,
        transformOrigin: "bottom",
        animation: `xpnEq ${0.8 + i * 0.12}s ease-in-out ${i * 0.13}s infinite`,
      }} />
    ))}
  </span>
);

/* ═══════════════ LIVE — THE now-playing screen ═══════════════
   The hierarchy follows what a listener actually wants, in order:
   what's on → what's playing → the play control → song actions →
   what just played. The old vertical icon rail beside the art (with
   its spacer-div centering hack) is gone; actions sit in a horizontal
   row around the play button, where thumbs are. */
const LiveScreen = ({ playing, setPlaying, onShow, streamId, onPickStream }) => {
  const { isSaved, toggle } = useFavorites("songs");
  const tracks = [
    { title: "Right Back to It", artist: "Waxahatchee", time: "2:30 PM", img: ALBUMS.tigersBlood },
    { title: "Favourite", artist: "Fontaines D.C.", time: "2:26 PM", img: ALBUMS.romance },
    { title: "Oceans of Darkness", artist: "The War on Drugs", time: "2:22 PM", img: ALBUMS.idlha },
    { title: "Coast", artist: "Kim Deal", time: "2:17 PM", img: ALBUMS.nobody },
  ];
  // The song on air right now follows the selected stream — the hero art
  // and the heart both act on this one object, so saving from the big
  // heart and seeing it in Favorites are the same record.
  const nowPlaying = STREAM_NOW[streamId] || STREAM_NOW.xpn;
  const npSaved = isSaved(songId(nowPlaying));
  const onAir = SHOWS.middays;
  const upNext = SHOWS.worldcafe;

  const railBtn = {
    width: 46, height: 46, borderRadius: 23, border: "none", background: "none",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    touchAction: "manipulation", padding: 0,
  };

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>

      {/* ── Stream switcher ── */}
      <StreamTabs current={streamId} onPick={onPickStream} />

      {/* ── On Air strip — KEXP-style show / host, tappable ── */}
      <Pressable
        onClick={() => onShow?.(onAir)}
        ariaLabel={`On air now: ${onAir.name} with ${onAir.host}. Open show`}
        style={{
          padding: "12px 16px 14px",
          display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.divider}`, cursor: "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: C.accentDim, fontFamily: F.display, letterSpacing: "0.1em" }}>ON AIR</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.ink, lineHeight: 1.2, fontFamily: F.display }}>{onAir.name}</div>
          <div style={{ fontSize: 14, color: C.textSec, marginTop: 1 }}>{onAir.host}</div>
        </div>
        {ic.chev(18, C.textDim)}
      </Pressable>

      {/* ── Now Playing: centered art with a vertical action rail (KEXP) ── */}
      <div style={{ position: "relative", padding: "22px 16px 0" }}>
        <SmartImg src={nowPlaying.img} eager style={{
          width: "min(216px, 56vw)", height: "min(216px, 56vw)",
          borderRadius: 6, objectFit: "cover", display: "block", margin: "0 auto",
          boxShadow: "0 14px 36px rgba(70,45,20,0.22)",
        }} />
        <div style={{
          position: "absolute", right: 14, top: 22, bottom: 0,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 14,
        }}>
          <button aria-label={npSaved ? "Remove this song from favorites" : "Save this song"} aria-pressed={npSaved} onClick={() => toggle(nowPlaying)} style={railBtn}>
            {npSaved ? ic.heartF(26, C.accent) : ic.heart(26, C.textSec)}
          </button>
          <button aria-label="Share this song" onClick={() => shareSong(nowPlaying)} style={railBtn}>
            {ic.shareAlt(24, C.textSec)}
          </button>
          <button aria-label="Cast to a device" style={railBtn}>
            {ic.cast(24, C.textSec)}
          </button>
        </div>
      </div>

      {/* ── Listen Live (flat lozenge), centered under the cover ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 24px 8px" }}>
        <button
          aria-label={playing ? "Pause live stream" : "Listen to the live stream"}
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "min(216px, 56vw)", height: 42, padding: "0 20px", borderRadius: 6,
            background: C.accent, border: "none", cursor: "pointer",
            touchAction: "manipulation",
          }}
        >
          {playing ? (
            <>
              {ic.pause(20, C.white)}
              <Equalizer color={C.white} height={16} />
            </>
          ) : (
            <>
              {ic.play(17, C.white)}
              <span style={{ fontSize: 14.5, fontWeight: 800, color: C.white, fontFamily: F.display, letterSpacing: "0.01em" }}>Listen Live</span>
            </>
          )}
        </button>
      </div>

      {/* ── Title / artist ── */}
      <div style={{ textAlign: "center", padding: "8px 28px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.2, fontFamily: F.display }}>{nowPlaying.title}</div>
        <div style={{ fontSize: 15.5, color: C.textSec, marginTop: 4 }}>{nowPlaying.artist}</div>
      </div>

      {/* ── Recently Played — program-guide rows ── */}
      <div style={{ padding: "4px 16px 2px", borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ ...kicker, paddingBottom: 8 }}>Recently Played</div>
      </div>
      {tracks.map((t) => {
        const tSaved = isSaved(songId(t));
        return (
        <div key={`${t.time}-${songId(t)}`} style={{ ...row, minHeight: 64 }}>
          <SmartImg src={t.img || TRACK}
            style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3, fontFamily: F.display }}>{t.title}</div>
            <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 1 }}>
              {t.artist} <span style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11.5 }}>· {t.time}</span>
            </div>
          </div>
          <button
            aria-label={tSaved ? `Remove ${t.title} from favorites` : `Save ${t.title}`}
            aria-pressed={tSaved}
            onClick={() => toggle(t)}
            style={ibtn}
          >
            {tSaved ? ic.heartF(19, C.accent) : ic.heart(19, C.textMut)}
          </button>
        </div>
        );
      })}

      {/* ── Up next — quiet pointer into the schedule ── */}
      <Pressable
        onClick={() => onShow?.(upNext)}
        ariaLabel={`Up next at 2pm: ${upNext.name} with ${upNext.host}. Open show`}
        style={{ ...row, cursor: "pointer", minHeight: 56 }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ ...kicker }}>Up Next · 2p</span>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: C.textSec, fontFamily: F.display, marginTop: 3 }}>
            {upNext.name} <span style={{ fontWeight: 400, color: C.textMut }}>with {upNext.host}</span>
          </div>
        </div>
        {ic.chev(18, C.textDim)}
      </Pressable>
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SHOWS ═══════════════
   Radio is time-based, so Schedule leads — it was buried behind
   "Archive" (jargon) before. The full broadcast day is here, not just
   the daytime slots, and only rows with a real show page are tappable
   and chevroned. */
const ShowsScreen = ({ onShow }) => {
  const [tab, setTab] = useState("schedule");
  const { isSaved: showSaved, toggle: toggleShow } = useFavorites("shows");
  const tabs = [
    { id: "schedule", label: "Schedule" },
    { id: "ondemand", label: "On Demand" },
    { id: "hosts", label: "Hosts" },
  ];
  const onDemand = [
    SHOWS.worldcafe, SHOWS.freeatnoon, SHOWS.funky,
    SHOWS.morning, SHOWS.middays, SHOWS.afternoons,
  ];
  const sched = [
    { time: "6–10a", show: SHOWS.morning },
    { time: "10a–2p", show: SHOWS.middays, on: true },
    { time: "2–4p", show: SHOWS.worldcafe },
    { time: "4–7p", show: SHOWS.afternoons },
    { time: "7–8p", name: "Kids Corner", host: "Kathy O'Connell", img: HOSTS.find(h => h.name === "Kathy O'Connell")?.img },
    { time: "10p–12a", name: "Echoes", host: "John Diliberto", img: HOSTS.find(h => h.name === "John Diliberto")?.img },
  ];
  const friday = [
    { time: "12p", show: SHOWS.freeatnoon },
    { time: "8–11p", show: SHOWS.funky },
  ];
  const hostShow = {
    "Kristen Kurtis": SHOWS.morning, "Bob Bumbera": SHOWS.morning,
    "Mike Vasilikos": SHOWS.middays, "Raina Douris & Stephen Kallao": SHOWS.worldcafe,
    "Dan Reed": SHOWS.afternoons, "Robert Drake": SHOWS.funky,
  };

  const SchedRow = ({ s }) => {
    const show = s.show;
    const tappable = !!show;
    const name = show ? show.name : s.name;
    const host = show ? show.host : s.host;
    const img = show ? show.img : s.img;
    const rowStyle = {
      display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
      borderBottom: `1px solid ${C.divider}`, cursor: tappable ? "pointer" : "default",
      background: s.on ? "rgba(213,78,27,0.07)" : "transparent",
      minHeight: 70,
    };
    const inner = (
      <>
        {img && <SmartImg src={img}
          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11.5, fontFamily: F.mono, color: s.on ? C.accentDim : C.textMut }}>{s.time}</span>
            {s.on && <span style={{ fontSize: 10, color: C.accentDim, fontFamily: F.display, fontWeight: 800, letterSpacing: "0.08em" }}>ON AIR</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: s.on ? C.ink : C.text, fontFamily: F.display }}>{name}</div>
          <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>{host}</div>
        </div>
        {tappable && ic.chev(18, C.textDim)}
      </>
    );
    return tappable
      ? <Pressable onClick={() => onShow?.(show)} ariaLabel={`${name} at ${s.time}${host ? `, ${host}` : ""}. Open show`} style={rowStyle}>{inner}</Pressable>
      : <div style={rowStyle}>{inner}</div>;
  };

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <Title>Shows</Title>
      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: `2px solid ${C.divider}`, flexShrink: 0 }}>
        {tabs.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "13px 0", fontSize: 15, fontWeight: on ? 600 : 400,
              cursor: "pointer", background: "none", fontFamily: F.body, textAlign: "center",
              color: on ? C.ink : C.textMut,
              borderBottom: on ? `3px solid ${C.accent}` : "3px solid transparent",
              borderTop: "none", borderLeft: "none", borderRight: "none", marginBottom: -2,
              minHeight: 48, touchAction: "manipulation",
            }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "schedule" ? (
        <div style={{ padding: "6px 0" }}>
          {sched.map((s) => <SchedRow key={s.time} s={s} />)}
          <div style={{ padding: "18px 16px 6px" }}>
            <span style={kicker}>Friday Specials</span>
          </div>
          {friday.map((s, i) => <SchedRow key={`f${i}`} s={s} />)}
        </div>
      ) : tab === "hosts" ? (
        <div>
          {HOSTS.map((h) => {
            const show = hostShow[h.name];
            const hostStyle = { ...row, minHeight: 72, cursor: show ? "pointer" : "default" };
            const inner = (
              <>
                <SmartImg src={h.img}
                  style={{ width: 50, height: 50, borderRadius: 25, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: F.display }}>{h.name}</div>
                  <div style={{ fontSize: 13.5, color: C.textSec }}>{h.show}</div>
                  {h.time && <div style={{ fontSize: 11.5, color: C.textMut, fontFamily: F.mono, marginTop: 2 }}>{h.time}</div>}
                </div>
                {show && ic.chev(18, C.textDim)}
              </>
            );
            return show
              ? <Pressable key={h.name} onClick={() => onShow?.(show)} ariaLabel={`${h.name}, ${h.show}. Open show`} style={hostStyle}>{inner}</Pressable>
              : <div key={h.name} style={hostStyle}>{inner}</div>;
          })}
        </div>
      ) : (
        <>
          {onDemand.map((s) => {
            const followed = showSaved(s.id);
            return (
            <Pressable key={s.id} onClick={() => onShow?.(s)} ariaLabel={`${s.name}, ${s.host}. Open show`} style={{ ...row, cursor: "pointer", minHeight: 84 }}>
              <SmartImg src={s.img}
                style={{ width: 60, height: 60, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: F.display }}>{s.name}</div>
                <div style={{ fontSize: 14, color: C.textMut, marginTop: 2 }}>{s.host}</div>
                <div style={{ fontSize: 11.5, color: C.textMut, marginTop: 4, fontFamily: F.mono }}>{s.time}</div>
              </div>
              <button
                aria-label={followed ? `Unfollow ${s.name}` : `Follow ${s.name}`}
                aria-pressed={followed}
                style={ibtn}
                onClick={(e) => { e.stopPropagation(); toggleShow(s); }}
              >
                {followed ? ic.heartF(20, C.accent) : ic.heart(20, C.textMut)}
              </button>
              {ic.chev(18, C.textDim)}
            </Pressable>
            );
          })}
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SHOW DETAIL ═══════════════ */
const ShowDetail = ({ show, onEp }) => {
  const s = show || SHOWS.worldcafe;
  const { isSaved: showSaved, toggle: toggleShow } = useFavorites("shows");
  const { isSaved: legacySongSaved, toggle: toggleLegacySong } = useFavorites("songs");
  const { isSaved: episodeSavedFn, toggle: toggleEpisode } = useFavorites("episodes");
  const followed = showSaved(s.id);
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* Hero image */}
      <div style={{ position: "relative", height: 170, overflow: "hidden", flexShrink: 0 }}>
        <SmartImg src={s.img} eager style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(250,242,231,0.2) 0%, ${C.bg} 62%)` }} />
        <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 14, alignItems: "flex-end" }}>
          <SmartImg src={s.img} eager style={{ width: 78, height: 78, borderRadius: 10, objectFit: "cover", border: `2px solid ${C.card}` }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, fontFamily: F.display, letterSpacing: "0.01em" }}>{s.name}</div>
            <div style={{ fontSize: 15, color: C.textSec }}>{s.host}</div>
            <div style={{ fontSize: 12, color: C.textMut, fontFamily: F.mono, marginTop: 4 }}>{s.time}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 16, color: C.textMut, lineHeight: 1.65, margin: 0 }}>
          {s.desc}
        </p>
      </div>
      <div style={{
        margin: "0 16px 8px",
        borderTop: `1px solid ${C.divider}`,
        borderBottom: `1px solid ${C.divider}`,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
      }}>
        <button onClick={() => onEp?.()} style={{
          minHeight: 44,
          background: "none", border: "none", borderRight: `1px solid ${C.divider}`,
          cursor: "pointer", touchAction: "manipulation",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          color: C.ink, fontFamily: F.display, fontSize: 14.5, fontWeight: 800,
        }}>
          {ic.play(16, C.accent)}
          <span>Latest</span>
        </button>
        <button
          onClick={() => toggleShow(s)}
          aria-pressed={followed}
          style={{
            minHeight: 44,
            background: "none", border: "none", cursor: "pointer", touchAction: "manipulation",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            color: followed ? C.accentDim : C.ink, fontFamily: F.display, fontSize: 14.5, fontWeight: 800,
          }}>
          {followed ? ic.heartF(17, C.accent) : ic.heart(17, C.accentDim)}
          <span>{followed ? "Following" : "Follow"}</span>
        </button>
      </div>
      {(s.episodes || []).map((ep) => {
        const epItem = episodeFavoriteItem(s, ep);
        const legacyItem = { title: ep.title, artist: s.name, img: ep.img || s.img };
        const savedAsEpisode = episodeSavedFn(epItem.id);
        const savedAsLegacySong = legacySongSaved(epItem.id);
        const epSaved = savedAsEpisode || savedAsLegacySong;
        const toggleEpisodeSave = (e) => {
          e.stopPropagation();
          if (savedAsEpisode) toggleEpisode(epItem);
          if (savedAsLegacySong) toggleLegacySong(legacyItem);
          if (!epSaved) toggleEpisode(epItem);
        };
        return (
        <Pressable key={`${ep.title}-${ep.date}`} onClick={() => onEp?.()} ariaLabel={`Play episode ${ep.title}, ${ep.date}`} style={{ ...row, cursor: "pointer", minHeight: 68 }}>
          <SmartImg src={ep.img || s.img}
            style={{ width: 50, height: 50, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>{ep.title}</div>
            <div style={{ fontSize: 12.5, color: C.textMut, marginTop: 3, fontFamily: F.mono }}>{ep.date} · {ep.dur}</div>
          </div>
          <button
            aria-label={epSaved ? `Remove ${ep.title} from favorites` : `Save ${ep.title}`}
            aria-pressed={epSaved}
            style={ibtn}
            onClick={toggleEpisodeSave}
          >
            {epSaved ? ic.heartF(19, C.accent) : ic.heart(19, C.textMut)}
          </button>
          {ic.chev(18, C.textDim)}
        </Pressable>
        );
      })}
      <div style={{ height: 16 }} />
    </div>
  );
};

/* ═══════════════ EPISODE PLAYER (on demand) ═══════════════ */
const EpisodePlayer = ({ show }) => {
  const s = show || SHOWS.worldcafe;
  const { isSaved: songSavedFn, toggle: toggleSong } = useFavorites("songs");
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 16px 20px" }}>
        <div style={{ width: 220, height: 220, borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 40px rgba(70,45,20,0.25)" }}>
          <SmartImg src={ARTIST} eager style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "0 24px 18px" }}>
        <div style={{ fontSize: 23, fontWeight: 600, color: C.ink, fontFamily: F.display, lineHeight: 1.2 }}>Adia Victoria Session</div>
        <div style={{ fontSize: 16, color: C.textSec, marginTop: 6 }}>{s.name}</div>
        <div style={{ fontSize: 14, color: C.textMut, marginTop: 3 }}>Feb 9, 2026 — 52 min</div>
      </div>
      {/* Progress scrubber — 36px tall hit area so it's easy to grab */}
      <div style={{ padding: "0 28px 8px" }}>
        <div style={{ height: 36, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
          <div style={{ flex: 1, height: 5, borderRadius: 2.5, background: C.surface, position: "relative" }}>
            <div style={{ width: "35%", height: "100%", borderRadius: 2.5, background: C.accent }} />
            <div style={{
              width: 18, height: 18, borderRadius: 9, background: C.white,
              position: "absolute", top: "50%", left: "35%",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 1px 6px rgba(70,45,20,0.35)",
            }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 13, color: C.textMut, fontFamily: F.mono }}>18:12</span>
          <span style={{ fontSize: 13, color: C.textMut, fontFamily: F.mono }}>52:00</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 24px 22px" }}>
        <button style={{
          width: 52, height: 52, borderRadius: 26,
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation",
        }}>
          {ic.skipBack(30, C.textSec)}
        </button>
        <button style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: C.accentDim, border: "none", borderRadius: 30,
          padding: "12px 28px", cursor: "pointer", minHeight: 56,
          boxShadow: "0 6px 18px rgba(213,78,27,0.3)",
          touchAction: "manipulation",
        }}>
          {ic.pause(26, C.white)}
          <span style={{ fontSize: 17, fontWeight: 700, color: C.white, fontFamily: F.display }}>Playing</span>
        </button>
        <button style={{
          width: 52, height: 52, borderRadius: 26,
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation",
        }}>
          {ic.skipFwd(30, C.textSec)}
        </button>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      <div style={{ padding: "16px 16px 6px" }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: C.ink, fontFamily: F.display }}>In This Episode</div>
      </div>
      {[
        { song: "Mean", artist: "Adia Victoria", at: "2:15" },
        { song: "Sleepy Hollow", artist: "Adia Victoria", at: "5:00" },
        { song: "Magnolia Blues", artist: "Adia Victoria", at: "12:30" },
        { song: "Different Kind of Love", artist: "Adia Victoria", at: "24:45" },
      ].map((t) => {
        const item = { title: t.song, artist: t.artist, img: ARTIST };
        const tSaved = songSavedFn(songId(item));
        return (
        <div key={`${t.song}-${t.at}`} style={{ ...row, minHeight: 62 }}>
            <SmartImg src={ARTIST}
              style={{ width: 46, height: 46, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{t.song}</div>
              <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>{t.artist}</div>
            </div>
            <span style={{ fontSize: 12, color: C.textMut, fontFamily: F.mono, flexShrink: 0 }}>{t.at}</span>
            <button
              aria-label={tSaved ? `Remove ${t.song} from favorites` : `Save ${t.song}`}
              aria-pressed={tSaved}
              style={ibtn}
              onClick={() => toggleSong(item)}
            >
              {tSaved ? ic.heartF(19, C.accent) : ic.heart(19, C.textMut)}
            </button>
        </div>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ CONCERTS ═══════════════
   In-app version of xpn.org/concert-and-events/. Data comes from
   concerts.js — live feed when the endpoint is wired, samples until
   then. Hearts persist to device storage and surface in Favorites. */
const ConcertRow = ({ c, saved, onToggle }) => {
  const d = new Date(c.date + "T12:00:00");
  return (
    <div style={{ ...row, padding: "12px 8px 12px 16px", minHeight: 70 }}>
      <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, color: C.textMut, fontFamily: F.mono, letterSpacing: "0.1em" }}>{c.day}</div>
        <div style={{ fontSize: 23, fontWeight: 700, color: saved ? C.accentDim : C.ink, fontFamily: F.display, lineHeight: 1.1 }}>{d.getDate()}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16.5, fontWeight: 600, color: C.ink, fontFamily: F.display, lineHeight: 1.25 }}>{c.artist}</div>
        <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.venue}{c.region ? ` · ${c.region}` : ""}
        </div>
        {(c.xpnWelcomes || c.age) && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, fontSize: 11.5 }}>
            {c.xpnWelcomes && <span style={{ color: C.textSec, fontWeight: 700, fontFamily: F.body }}>WXPN Welcomes</span>}
            {c.age && <span style={{ color: C.textMut }}>{c.age}</span>}
          </div>
        )}
      </div>
      <button
        aria-label={saved ? `Remove ${c.artist} from saved concerts` : `Save ${c.artist} concert`}
        onClick={() => onToggle(c.id)}
        style={ibtn}
      >
        {saved ? ic.heartF(21, C.accent) : ic.heart(21, C.textMut)}
      </button>
    </div>
  );
};

/* Native <select> in app clothes: dark surface, chevron, Figtree. */
const SelectBox = ({ value, onChange, ariaLabel, children }) => (
  <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
    <select value={value} onChange={onChange} aria-label={ariaLabel} style={{
      width: "100%", minHeight: 44, borderRadius: 8, border: "none",
      background: C.surface, color: C.ink,
      padding: "10px 34px 10px 12px", fontSize: 14, fontFamily: F.body, fontWeight: 500,
      outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer",
    }}>
      {children}
    </select>
    <span style={{ position: "absolute", right: 11, pointerEvents: "none", display: "flex" }}>
      {ic.chevD(15, C.textMut)}
    </span>
  </div>
);

const ConcertsScreen = () => {
  const [concerts, setConcerts] = useState(null);
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState("next7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("all");
  const [saved, toggleSaved] = useSavedConcerts();
  useEffect(() => { fetchConcerts().then(setConcerts); }, []);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const addDays = (iso, days) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const currentMonthBounds = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  };

  const rangeBounds = () => {
    if (dateRange === "next7") return { start: todayIso, end: addDays(todayIso, 7) };
    if (dateRange === "next30") return { start: todayIso, end: addDays(todayIso, 30) };
    if (dateRange === "next90") return { start: todayIso, end: addDays(todayIso, 90) };
    if (dateRange === "month") return currentMonthBounds();
    if (dateRange === "custom") return { start: startDate || "", end: endDate || "" };
    return { start: "", end: "" };
  };

  const { start: effectiveStart, end: effectiveEnd } = rangeBounds();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const regionMatch = (c) => {
      const region = (c.region || "").toLowerCase();
      if (category === "welcomes") return c.xpnWelcomes;
      if (category === "philly") return region === "philadelphia" || region === "suburbs" || region.includes("philadelphia");
      if (category === "newjersey") return region === "new jersey" || region.includes("new jersey");
      if (category === "lehigh") return region === "lehigh valley" || region.includes("lehigh valley");
      if (category === "centralpa") return region === "central pa" || region.includes("central pa");
      return true;
    };

    return (concerts || []).filter((c) => {
      const matchesQuery = !q ||
        c.artist.toLowerCase().includes(q) ||
        c.venue.toLowerCase().includes(q);
      const matchesStart = !effectiveStart || c.date >= effectiveStart;
      const matchesEnd = !effectiveEnd || c.date <= effectiveEnd;
      return matchesQuery && matchesStart && matchesEnd && regionMatch(c);
    });
  }, [concerts, query, effectiveStart, effectiveEnd, category]);

  const groups = useMemo(() => {
    const grouped = [];
    for (const c of list) {
      const label = monthLabel(c.date);
      const g = grouped[grouped.length - 1];
      if (g && g.label === label) g.items.push(c);
      else grouped.push({ label, items: [c] });
    }
    return grouped;
  }, [list]);

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <Title>Concerts</Title>
      {/* Search */}
      <div style={{ padding: "2px 16px 2px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: C.surface, borderRadius: 8, padding: "0 12px", minHeight: 44,
        }}>
          {ic.search(17, C.textDim)}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artist or venue"
            aria-label="Search concerts by artist or venue"
            style={{
              flex: 1, minHeight: 44, border: "none", background: "none",
              color: C.ink, fontSize: 14.5, fontFamily: F.body, outline: "none",
            }}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} style={{ ...ibtn, width: 36, height: 36 }}>
              {ic.close(15, C.textMut)}
            </button>
          )}
        </div>
      </div>
      {/* Filters — native pickers, dressed for the app */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 12px", borderBottom: `1px solid ${C.divider}` }}>
        <SelectBox value={category} onChange={(e) => setCategory(e.target.value)} ariaLabel="Filter by category">
          <option value="all">All categories</option>
          <option value="welcomes">WXPN Welcomes</option>
          <option value="philly">Philadelphia area</option>
          <option value="newjersey">New Jersey</option>
          <option value="lehigh">Lehigh Valley</option>
          <option value="centralpa">Central PA</option>
        </SelectBox>
        <SelectBox value={dateRange} onChange={(e) => setDateRange(e.target.value)} ariaLabel="Filter by date range">
          <option value="any">Any date</option>
          <option value="next7">Next 7 days</option>
          <option value="next30">Next 30 days</option>
          <option value="next90">Next 90 days</option>
          <option value="month">This month</option>
          <option value="custom">Custom range</option>
        </SelectBox>
      </div>
      {dateRange === "custom" && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 12px", borderBottom: `1px solid ${C.divider}`, marginTop: -1 }}>
          {[
            { v: startDate, set: setStartDate, label: "Start date" },
            { v: endDate, set: setEndDate, label: "End date" },
          ].map(({ v, set, label }) => (
            <input
              key={label} type="date" value={v} aria-label={label}
              onChange={(e) => set(e.target.value)}
              style={{
                flex: 1, minHeight: 42, borderRadius: 8, border: "none",
                background: C.surface, color: C.ink,
                padding: "8px 10px", fontSize: 13, fontFamily: F.body,
                outline: "none", colorScheme: "light",
              }}
            />
          ))}
        </div>
      )}
      {/* Result count — broadcast-data voice */}
      {concerts !== null && list.length > 0 && (
        <div style={{
          padding: "10px 16px 0", fontSize: 10.5, fontFamily: F.mono,
          color: C.textMut, letterSpacing: "0.14em",
        }}>{list.length} SHOW{list.length === 1 ? "" : "S"}</div>
      )}

      {/* List */}
      {concerts === null ? (
        <div style={{ padding: "40px 16px", textAlign: "center", color: C.textMut, fontSize: 14 }}>
          Loading shows…
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: "44px 32px", textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}>{ic.heart(28, C.textDim)}</div>
          <div style={{ fontSize: 15, color: C.textSec, fontFamily: F.display, fontWeight: 600 }}>
            No shows found
          </div>
          <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 6, lineHeight: 1.5 }}>
            Try broadening your search, date range, or category filter.
          </div>
        </div>
      ) : groups.map(g => (
        <div key={g.label}>
          {/* Month header — the typographic spine of the calendar */}
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8,
            padding: "20px 16px 8px", borderBottom: `1px solid ${C.divider}`,
          }}>
            <span style={{ fontSize: 21, fontWeight: 700, color: C.ink, fontFamily: F.display }}>{g.label.split(" ")[0]}</span>
            <span style={{ fontSize: 11.5, fontFamily: F.mono, color: C.textMut, letterSpacing: "0.1em" }}>{g.label.split(" ")[1]}</span>
          </div>
          {g.items.map(c => (
            <ConcertRow key={c.id} c={c} saved={saved.has(c.id)} onToggle={toggleSaved} />
          ))}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ FAVORITES ═══════════════ */
const FavScreen = ({ onShow, onShows, onConcerts }) => {
  const [tab, setTab] = useState("songs");
  const [saved, toggleSaved] = useSavedConcerts();
  const { items: savedSongs, toggle: toggleSong } = useFavorites("songs");
  const { items: savedEpisodeItems, toggle: toggleEpisode } = useFavorites("episodes");
  const { items: savedShows, toggle: toggleShow } = useFavorites("shows");
  const [concerts, setConcerts] = useState([]);
  useEffect(() => { fetchConcerts().then(setConcerts); }, []);
  const savedConcerts = useMemo(() => concerts.filter(c => saved.has(c.id)), [concerts, saved]);
  const legacyEpisodeItems = useMemo(() =>
    savedSongs
      .map((song) => {
        const id = song.id || songId(song);
        const episode = ARCHIVE_EPISODES.get(id);
        return episode ? { ...episode, savedAt: song.savedAt, legacySong: song } : null;
      })
      .filter(Boolean),
    [savedSongs]
  );
  const savedEpisodes = useMemo(() => {
    const byId = new Map();
    legacyEpisodeItems.forEach((episode) => byId.set(episode.id, episode));
    savedEpisodeItems.forEach((episode) => byId.set(episode.id, episode));
    return Array.from(byId.values()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }, [legacyEpisodeItems, savedEpisodeItems]);
  const savedEpisodeIds = useMemo(() => new Set(savedEpisodeItems.map((episode) => episode.id)), [savedEpisodeItems]);
  const legacyEpisodeIds = useMemo(() => new Set(legacyEpisodeItems.map((episode) => episode.id)), [legacyEpisodeItems]);
  const visibleSongs = useMemo(
    () => savedSongs.filter((song) => !legacyEpisodeIds.has(song.id || songId(song))),
    [savedSongs, legacyEpisodeIds]
  );

  // "Feb 9" style label from a savedAt timestamp
  const savedLabel = (ts) => ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  const BrowseCta = ({ label, onClick }) => (
    <button onClick={onClick} style={{
      marginTop: 18,
      minHeight: 46,
      padding: "0 16px 0 18px",
      borderRadius: 6,
      background: C.ink,
      border: "none",
      color: C.white,
      fontSize: 14.5,
      fontWeight: 800,
      fontFamily: F.display,
      cursor: "pointer",
      touchAction: "manipulation",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      boxShadow: "0 8px 20px rgba(40,32,26,0.18)",
    }}>
      <span>{label}</span>
      {ic.chev(16, C.white)}
    </button>
  );

  const Empty = ({ label, hint, cta, onCta }) => (
    <div style={{ padding: "44px 32px", textAlign: "center" }}>
      <div style={{ marginBottom: 10 }}>{ic.heart(28, C.textDim)}</div>
      <div style={{ fontSize: 15, color: C.textSec, fontFamily: F.display, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      {cta && <BrowseCta label={cta} onClick={onCta} />}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <Title>Favorites</Title>
      {/* Tabs — each shows a live count once you've saved anything */}
      <div style={{ display: "flex", borderBottom: `2px solid ${C.divider}`, flexShrink: 0 }}>
        {[
          { label: "Songs", count: visibleSongs.length },
          { label: "Episodes", count: savedEpisodes.length },
          { label: "Shows", count: savedShows.length },
          { label: "Concerts", count: savedConcerts.length },
        ].map(t => {
          const on = tab === t.label.toLowerCase();
          return (
            <button key={t.label} onClick={() => setTab(t.label.toLowerCase())} style={{
              flex: 1, padding: "12px 0", fontSize: 14, fontWeight: on ? 700 : 500, cursor: "pointer",
              background: "none", fontFamily: F.body, textAlign: "center",
              color: on ? C.ink : C.textMut,
              borderBottom: on ? `3px solid ${C.accent}` : "3px solid transparent",
              borderTop: "none", borderLeft: "none", borderRight: "none", marginBottom: -2,
              minHeight: 48, touchAction: "manipulation",
            }}>{t.label}{t.count > 0 ? ` (${t.count})` : ""}</button>
          );
        })}
      </div>

      {tab === "songs" ? (
        visibleSongs.length === 0 ? (
          <Empty label="No saved songs yet" hint="Tap the heart on any song from the Live screen or episode track list to save it here." />
        ) : visibleSongs.map((t) => (
          <div key={t.id} style={{ ...row, minHeight: 64 }}>
            <SmartImg src={t.img || TRACK}
              style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontFamily: F.display }}>{t.title}</div>
              <div style={{ fontSize: 14, color: C.textMut, marginTop: 2 }}>{t.artist}</div>
            </div>
            <span style={{ fontSize: 12, color: C.textMut, fontFamily: F.mono, flexShrink: 0 }}>{savedLabel(t.savedAt)}</span>
            <button aria-label={`Remove ${t.title} from favorites`} aria-pressed={true} onClick={() => toggleSong(t)} style={ibtn}>{ic.heartF(20, C.accent)}</button>
          </div>
        ))
      ) : tab === "episodes" ? (
        savedEpisodes.length === 0 ? (
          <Empty label="No saved episodes yet" hint="Tap the heart on a show archive episode to save it here." cta="Browse Shows" onCta={() => onShows?.()} />
        ) : savedEpisodes.map((ep) => {
          const show = SHOWS[ep.showId];
          const removeEpisode = (e) => {
            e.stopPropagation();
            if (savedEpisodeIds.has(ep.id)) toggleEpisode(ep);
            if (ep.legacySong) toggleSong(ep.legacySong);
          };
          return (
            <Pressable key={ep.id} onClick={() => show && onShow?.(show)} ariaLabel={`${ep.title}, ${ep.showName}. Open show`} style={{ ...row, cursor: show ? "pointer" : "default", minHeight: 72 }}>
              <SmartImg src={ep.img || show?.img}
                style={{ width: 50, height: 50, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontFamily: F.display }}>{ep.title}</div>
                <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>
                  {ep.showName}{ep.date ? ` · ${ep.date}` : ""}{ep.dur ? ` · ${ep.dur}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 12, color: C.textMut, fontFamily: F.mono, flexShrink: 0 }}>{savedLabel(ep.savedAt)}</span>
              <button aria-label={`Remove ${ep.title} from favorites`} aria-pressed={true} onClick={removeEpisode} style={ibtn}>{ic.heartF(20, C.accent)}</button>
              {show && ic.chev(18, C.textDim)}
            </Pressable>
          );
        })
      ) : tab === "shows" ? (
        savedShows.length === 0 ? (
          <Empty label="No followed shows yet" hint="Follow a show from its page or the On Demand list to keep it here." cta="Browse Shows" onCta={() => onShows?.()} />
        ) : savedShows.map((s) => (
          <Pressable key={s.id} onClick={() => onShow?.(s)} ariaLabel={`${s.name}, ${s.host}. Open show`} style={{ ...row, cursor: "pointer", minHeight: 76 }}>
            <SmartImg src={s.img}
              style={{ width: 56, height: 56, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: F.display }}>{s.name}</div>
              <div style={{ fontSize: 14, color: C.textMut, marginTop: 2 }}>{s.host}</div>
            </div>
            <button aria-label={`Unfollow ${s.name}`} aria-pressed={true} style={ibtn} onClick={(e) => { e.stopPropagation(); toggleShow(s); }}>{ic.heartF(21, C.accent)}</button>
            {ic.chev(18, C.textDim)}
          </Pressable>
        ))
      ) : (
        savedConcerts.length === 0 ? (
          <Empty label="No saved concerts yet" hint="Browse the Concerts tab and heart the shows you want to catch." cta="Browse Concerts" onCta={() => onConcerts?.()} />
        ) : savedConcerts.map(c => (
          <ConcertRow key={c.id} c={c} saved={true} onToggle={toggleSaved} />
        ))
      )}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ ALARM CLOCK ═══════════════ */
const TogglePill = ({ checked, onChange, ariaLabel }) => (
  <button
    onClick={() => onChange(!checked)}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    style={{
      minHeight: 44,
      padding: "6px 0 6px 16px",
      background: "none",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 9,
      touchAction: "manipulation",
    }}
  >
    <span style={{
      fontSize: 11,
      fontWeight: 800,
      fontFamily: F.mono,
      letterSpacing: "0.13em",
      color: checked ? C.accentDim : C.textMut,
    }}>
      {checked ? "ON" : "OFF"}
    </span>
    <div style={{
      width: 34,
      height: 18,
      position: "relative",
      display: "flex",
      alignItems: "center",
    }}>
      <span style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 2,
        background: checked ? C.accentBorder : C.divider,
      }} />
      <span style={{
        position: "absolute",
        left: checked ? 23 : 0,
        width: 11,
        height: 11,
        borderRadius: 6,
        background: checked ? C.accent : C.textDim,
        boxShadow: checked ? "0 0 0 4px rgba(213,78,27,0.12)" : "none",
        transition: "left 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
      }} />
    </div>
  </button>
);

const AlarmScreen = ({ alarm, updateAlarm, onPreview }) => {
  const timeInputRef = useRef(null);
  const snoozed = alarm.enabled && alarm.snoozeUntil > Date.now();
  const snoozeLabel = snoozed
    ? new Date(alarm.snoozeUntil).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const scheduledTime = formatAlarmTime(alarm.time);

  const toggleDay = (day) => {
    updateAlarm((current) => {
      const days = new Set(current.repeatDays);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      return { repeatDays: [...days].sort() };
    });
  };
  const openTimePicker = () => {
    const input = timeInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  };
  const onTimeKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTimePicker();
    }
  };

  const currentStream = STREAMS[alarm.streamId] || STREAMS.xpn;
  const repeatSummary = alarm.repeatDays.length === 7
    ? "Every day"
    : alarm.repeatDays.length === 5 && [1, 2, 3, 4, 5].every((day) => alarm.repeatDays.includes(day))
      ? "Weekdays"
      : alarm.repeatDays.length
        ? alarm.repeatDays.map((day) => DAY_LABELS[day].short).join(" ")
        : "Never";
  const headerKicker = snoozed ? "Snoozed Until" : alarm.enabled ? "Alarm On" : "Alarm Off";
  const headerHero = snoozed ? snoozeLabel : alarm.enabled ? scheduledTime : "Off";
  const headerContext = snoozed
    ? `Paused until ${snoozeLabel}`
    : alarm.enabled
      ? `${repeatSummary} · ${currentStream.label}`
      : "Wake with live radio";
  const snoozeOptions = [5, 10, 15, 20];

  const section = {
    padding: "15px 16px",
    borderBottom: `1px solid ${C.divider}`,
  };
  const rowButton = {
    width: "100%",
    minHeight: 58,
    padding: 0,
    background: "none",
    border: "none",
    borderBottom: `1px solid ${C.divider}`,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: F.body,
    touchAction: "manipulation",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };
  const labelStyle = { fontSize: 15.5, fontWeight: 700, color: C.ink, fontFamily: F.display };
  const subStyle = { fontSize: 12.5, color: C.textMut, marginTop: 3 };

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <Title>Alarm Clock</Title>

      <div style={{
        padding: "2px 16px 18px",
        borderBottom: `1px solid ${C.divider}`,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={kicker}>{headerKicker}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, fontFamily: F.display, marginTop: 2, lineHeight: 1, whiteSpace: "nowrap" }}>
            {headerHero}
          </div>
          <div style={{ fontSize: 13, color: C.textMut, marginTop: 7 }}>
            {headerContext}
          </div>
        </div>
        <TogglePill checked={alarm.enabled} onChange={(enabled) => updateAlarm({ enabled, snoozeUntil: enabled ? alarm.snoozeUntil : 0 })} ariaLabel="Turn alarm on or off" />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Wake time ${scheduledTime}`}
        onClick={openTimePicker}
        onKeyDown={onTimeKeyDown}
        style={{
        ...section,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 78,
        cursor: "pointer",
      }}>
        <span>
          <span style={labelStyle}>Wake Time</span>
          <span style={{ ...subStyle, display: "block" }}>{repeatSummary}</span>
        </span>
        <span style={{ position: "relative", minWidth: 126, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <span style={{
            fontSize: 25,
            fontWeight: 800,
            fontFamily: F.display,
            color: C.ink,
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}>
            {scheduledTime}
          </span>
          <input
            ref={timeInputRef}
            type="time"
            aria-label="Wake time"
            value={alarm.time}
            onChange={(e) => updateAlarm({ time: e.target.value, lastTriggeredDate: "" })}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 1,
              height: 1,
              opacity: 0,
              border: "none",
              background: "transparent",
              pointerEvents: "none",
              colorScheme: "light",
            }}
          />
        </span>
      </div>

      <div style={{ padding: "14px 16px 2px" }}>
        <div style={{ ...kicker, marginBottom: 2 }}>Stream</div>
        <div role="radiogroup" aria-label="Alarm stream">
          {[STREAMS.xpn, STREAMS.xpn2, STREAMS.kids].map((stream) => {
            const selected = alarm.streamId === stream.id;
            return (
              <button
                key={stream.id}
                role="radio"
                aria-checked={selected}
                onClick={() => updateAlarm({ streamId: stream.id })}
                style={{
                  ...rowButton,
                  color: C.textSec,
                  borderBottom: `1px solid ${C.divider}`,
                  minHeight: 61,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{
                    width: 5,
                    height: 32,
                    borderRadius: 3,
                    background: selected ? C.accent : "transparent",
                    flexShrink: 0,
                  }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: selected ? C.ink : C.text, fontFamily: F.display }}>
                      {stream.label}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: C.textMut, marginTop: 2 }}>
                      {stream.tagline}
                    </span>
                  </span>
                </span>
                <span aria-hidden={!selected} style={{ minWidth: 22, fontSize: 11, fontWeight: 800, fontFamily: F.mono, color: C.accentDim, letterSpacing: "0.1em", textAlign: "right" }}>
                  {selected ? "ON" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={labelStyle}>Repeat</div>
          <div style={{ fontSize: 12.5, color: C.textMut }}>{repeatSummary}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {DAY_LABELS.map((day) => {
            const selected = alarm.repeatDays.includes(day.id);
            return (
              <button
                key={day.id}
                aria-label={day.label}
                aria-pressed={selected}
                onClick={() => toggleDay(day.id)}
                style={{
                  minHeight: 38,
                  border: "none",
                  borderBottom: `3px solid ${selected ? C.accent : "transparent"}`,
                  background: "transparent",
                  color: selected ? C.ink : C.textDim,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 800,
                  fontFamily: F.display,
                  touchAction: "manipulation",
                }}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={labelStyle}>Snooze Length</div>
          <div style={{ fontSize: 12.5, color: C.textMut }}>{alarm.snoozeMinutes} min</div>
        </div>
        <div role="radiogroup" aria-label="Snooze length" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {snoozeOptions.map((minutes) => {
            const selected = alarm.snoozeMinutes === minutes;
            return (
              <button
                key={minutes}
                role="radio"
                aria-checked={selected}
                onClick={() => updateAlarm({ snoozeMinutes: minutes })}
                style={{
                  minHeight: 38,
                  border: "none",
                  borderBottom: `3px solid ${selected ? C.accent : "transparent"}`,
                  background: "transparent",
                  color: selected ? C.ink : C.textDim,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 800,
                  fontFamily: F.display,
                  touchAction: "manipulation",
                }}
              >
                {minutes}
              </button>
            );
          })}
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={labelStyle}>Volume</div>
          <div style={{ fontSize: 13, color: C.textMut, fontFamily: F.mono }}>{alarm.volume}%</div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={alarm.volume}
          aria-label="Alarm volume"
          onChange={(e) => updateAlarm({ volume: Number(e.target.value) })}
          style={{ width: "100%", accentColor: C.accent }}
        />
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        {snoozed && (
          <button
            onClick={() => updateAlarm({ snoozeUntil: 0 })}
            style={{
              ...rowButton,
              minHeight: 62,
              color: C.ink,
            }}
          >
            <span>
              <span style={labelStyle}>Snoozed Until {snoozeLabel}</span>
              <span style={{ ...subStyle, display: "block" }}>Cancel snooze and use the regular alarm time</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: F.display, color: C.accentDim }}>Cancel</span>
          </button>
        )}
        <div style={{ ...kicker, margin: "12px 0 2px" }}>Actions</div>
        <button
          onClick={onPreview}
          style={{
            ...rowButton,
            color: C.ink,
          }}
        >
          <span>
            <span style={labelStyle}>Preview Alarm</span>
            <span style={{ ...subStyle, display: "block" }}>Start {currentStream.short} now</span>
          </span>
          {ic.play(18, C.accent)}
        </button>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SETTINGS ═══════════════ */
const SettingsScreen = () => {
  const [cp, setCp] = useState(false);
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <Title>Settings</Title>
      <div style={{ padding: "8px 16px 12px" }}>
        <div style={{ ...kicker, marginBottom: 6 }}>Favorites</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", borderBottom: `1px solid ${C.divider}`,
          minHeight: 64,
        }}>
          <div>
            <div style={{ fontSize: 16, color: C.text }}>Share Favorites</div>
          </div>
          {ic.shareAlt(22, C.textMut)}
        </div>
      </div>
      <div style={{ padding: "12px 16px 12px" }}>
        <div style={{ ...kicker, marginBottom: 6 }}>CarPlay</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${C.divider}`,
          minHeight: 68,
        }}>
          <div>
            <div style={{ fontSize: 16, color: C.text }}>Time Skip Controls</div>
            <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>Make visible in CarPlay</div>
          </div>
          {/* Toggle — 54×32 pill with extended tap wrapper for accessibility */}
          <button
            onClick={() => setCp(!cp)}
            role="switch"
            aria-checked={cp}
            aria-label="Show time skip controls in CarPlay"
            style={{
              padding: "8px 0 8px 12px",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center",
              touchAction: "manipulation",
            }}
          >
            <div style={{
              width: 54, height: 32, borderRadius: 16, padding: 2, border: `1px solid ${C.divider}`,
              background: cp ? C.accent : C.surface,
              display: "flex", justifyContent: cp ? "flex-end" : "flex-start", alignItems: "center",
              transition: "background 0.2s",
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: cp ? C.white : C.textDim, transition: "all 0.2s" }} />
            </div>
          </button>
        </div>
      </div>
      <div style={{ padding: "12px 16px 12px" }}>
        <div style={{ ...kicker, marginBottom: 6 }}>Contact</div>
        {[
          { label: "Technical Support", href: `mailto:${LINKS.contactEmail}?subject=WXPN%20App%20Support` },
          { label: "Contact WXPN", href: `mailto:${LINKS.contactEmail}` },
          { label: "Privacy Policy", href: LINKS.privacy },
        ].map((item) => (
          <button key={item.label} onClick={() => openExternal(item.href)} style={{
            width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${C.divider}`,
            minHeight: 56, touchAction: "manipulation", fontFamily: F.body,
          }}>
            <span style={{ fontSize: 16, color: C.textSec }}>{item.label}</span>
            {ic.chev(20, C.textDim)}
          </button>
        ))}
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
};

/* ═══════════════ MAIN APP ═══════════════ */
export default function WXPNApp() {
  const [screen, setScreen] = useState("live");      // which tab
  const [stack, setStack] = useState([]);            // detail views pushed over the tab
  const [menuOpen, setMenuOpen] = useState(false);
  const [streamId, setStreamId] = useState("xpn");   // active live stream
  const [alarm, updateAlarm] = useAlarmSettings();
  // Start paused — browsers block autoplay with sound, and on first launch
  // the user should tap play deliberately anyway.
  const [playing, setPlaying] = useState(false);

  // Real audio. initPlayer wires up the <audio> element and Media Session
  // (lock screen / control center play-pause) once on mount.
  useEffect(() => { initPlayer(setPlaying); }, []);
  useEffect(() => { playing ? playStream() : pauseStream(); }, [playing]);

  // Switching streams swaps the audio source (player.setStream re-attaches
  // and keeps playing if it was playing) and updates every now-playing surface.
  const pickStream = (id) => {
    if (setStream(id)) setStreamId(id);
  };
  const startAlarmStream = () => {
    setPlayerVolume(alarm.volume);
    pickStream(alarm.streamId);
    setPlaying(true);
  };

  useEffect(() => {
    if (!alarm.enabled || alarm.repeatDays.length === 0) return;

    const checkAlarm = () => {
      const now = new Date();
      if (Date.now() < alarm.snoozeUntil) return;
      if (!alarm.repeatDays.includes(now.getDay())) return;
      if (timeKey(now) !== alarm.time) return;

      const today = dateKey(now);
      if (alarm.lastTriggeredDate === today) return;

      setPlayerVolume(alarm.volume);
      if (setStream(alarm.streamId)) setStreamId(alarm.streamId);
      setPlaying(true);
      updateAlarm({ lastTriggeredDate: today, snoozeUntil: 0 });
    };

    checkAlarm();
    const interval = window.setInterval(checkAlarm, 30 * 1000);
    return () => window.clearInterval(interval);
  }, [alarm, updateAlarm]);

  const push = (view) => setStack(s => [...s, view]);
  const pop = () => setStack(s => s.slice(0, -1));
  const top = stack[stack.length - 1];

  const nav = (id) => {
    setMenuOpen(false);
    if (id === "more") { setMenuOpen(true); return; }
    setScreen(id);
    setStack([]);   // switching tabs clears any detail views
  };
  const openShow = (show) => push({ type: "show", show });

  // The mini player rides above the nav everywhere except the Live tab
  // itself (redundant there) and the episode player (two players on one
  // screen would fight over which audio you're controlling).
  const showMini = top?.type !== "episode" && !(screen === "live" && !top);

  const menuItems = [
    { label: "Settings", action: () => push({ type: "settings" }) },
    { label: "Alarm Clock", note: alarm.enabled ? "ON" : "", action: () => push({ type: "alarm" }) },
    { label: "XPN.org", note: "WEB", action: () => openExternal(LINKS.xpn) },
  ];

  const content = () => {
    if (top?.type === "settings") return <SettingsScreen />;
    if (top?.type === "alarm") return <AlarmScreen alarm={alarm} updateAlarm={updateAlarm} onPreview={startAlarmStream} />;
    if (top?.type === "episode") return <EpisodePlayer show={top.show} />;
    if (top?.type === "show") return <ShowDetail show={top.show} onEp={() => push({ type: "episode", show: top.show })} />;
    if (screen === "shows") return <ShowsScreen onShow={openShow} />;
    if (screen === "concerts") return <ConcertsScreen />;
    if (screen === "favorites") return <FavScreen onShows={() => nav("shows")} onConcerts={() => nav("concerts")} onShow={openShow} />;
    return <LiveScreen playing={playing} setPlaying={setPlaying} onShow={openShow} streamId={streamId} onPickStream={pickStream} />;
  };

  const phoneContent = (
    <>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <Header showBack={stack.length > 0} onBack={pop} />
      {content()}
      {showMini && <Mini onTap={() => nav("live")} playing={playing} setPlaying={setPlaying} streamId={streamId} />}
      <Nav active={screen} onNav={nav} />
    </>
  );

  // On real mobile: just the full-screen app, no outer wrapper
  if (isMobile) {
    return <Phone>{phoneContent}</Phone>;
  }

  // On desktop: centered mockup with screen-switcher debug buttons below
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px", background: "#EFE5D4",
    }}>
      <Phone>{phoneContent}</Phone>
      <div style={{ marginTop: 20, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 420 }}>
        {[
          { id: "live", label: "Live" },
          { id: "shows", label: "Shows" },
          { id: "concerts", label: "Concerts" },
          { id: "favorites", label: "Favorites" },
        ].map((s) => {
          const on = screen === s.id && !top;
          return (
            <button key={s.id} onClick={() => nav(s.id)} style={{
              padding: "7px 18px", borderRadius: 20, fontSize: 13, cursor: "pointer",
              fontFamily: F.body, fontWeight: 500,
              background: on ? C.accentDim : C.card,
              color: on ? C.white : C.textMut,
              border: `1px solid ${on ? "transparent" : C.divider}`,
              touchAction: "manipulation",
            }}>{s.label}</button>
          );
        })}
      </div>
    </div>
  );
}
