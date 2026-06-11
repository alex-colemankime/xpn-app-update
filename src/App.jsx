import { useState, useRef, useEffect } from "react";
import { initPlayer, playStream, pauseStream } from "./player.js";
import { isMobile, C, F, ibtn } from "./theme.js";
import { ic } from "./icons.jsx";
import { ALBUMS, ART, ARTIST, TRACK, HOSTS, SHOWS } from "./data.js";
import { fetchConcerts, useSavedConcerts, monthLabel } from "./concerts.js";


/* ─── PHONE WRAPPER ───
   Mobile: full viewport (100vw × 100dvh) — no fake frame
   Desktop: 375×812 mockup with rounded corners + dynamic island
   100dvh = "dynamic viewport height" — the correct 2026 unit for mobile
   browsers (avoids the iOS Safari bottom bar overlap that 100vh causes) */
const Phone = ({ children }) => {
  const bg = `radial-gradient(120% 90% at 50% -10%, ${C.accentGlow} 0%, rgba(18,16,14,0) 60%), radial-gradient(80% 60% at 80% 100%, ${C.greenDim} 0%, transparent 70%), linear-gradient(180deg, ${C.bg} 0%, #0D0B09 100%)`;
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
      boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)",
      fontFamily: F.body, color: C.text,
    }}>
      {/* Dynamic Island notch */}
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
   paddingTop on mobile uses env(safe-area-inset-top) so the header
   content clears the Dynamic Island / notch on real devices. */
const Header = ({ showBack, onBack, onMenu }) => (
  <div style={{
    paddingTop: isMobile ? "calc(env(safe-area-inset-top, 44px) + 10px)" : "64px",
    paddingRight: 16, paddingBottom: 14, paddingLeft: 16,
    background: "rgba(18,16,14,0.92)",
    flexShrink: 0,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  }}>
    <div style={{
      position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      {/* Left: back + menu — both 44×44 tap targets */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, width: 92 }}>
        {showBack && (
          <button aria-label="Back" onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer",
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            touchAction: "manipulation",
          }}>
            {ic.back(22, C.accent)}
          </button>
        )}
        <button aria-label="Menu" onClick={onMenu} style={{
          background: "none", border: "none", cursor: "pointer",
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation",
        }}>
          {ic.menu(22, C.cream)}
        </button>
      </div>
      {/* Centered wordmark */}
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 23, fontWeight: 800, color: C.cream, letterSpacing: "0.16em", fontFamily: F.display, lineHeight: 1 }}>
          WXPN
        </div>
        <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.22em", fontFamily: F.mono, marginTop: 6 }}>
          88.5 FM  PHILADELPHIA
        </div>
        <div style={{ height: 2, width: 52, background: C.accentSoft, borderRadius: 2, margin: "8px auto 0", opacity: 0.5 }} />
      </div>
      <div style={{ width: 92 }} />
    </div>
  </div>
);

/* ─── BOTTOM NAV ───
   paddingBottom uses env(safe-area-inset-bottom) on mobile so the
   nav labels sit above the iPhone home indicator bar. */
const Nav = ({ active, onNav }) => {
  const tabs = [
    { id: "live", label: "Live", icon: ic.navLive },
    { id: "shows", label: "Shows", icon: ic.navShows },
    { id: "favorites", label: "Favorites", icon: ic.navFav },
  ];
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "center",
      paddingTop: 6,
      paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : "34px",
      paddingLeft: 10, paddingRight: 10,
      background: "linear-gradient(180deg, rgba(18,16,14,0.35) 0%, rgba(18,16,14,0.98) 100%)",
      borderTop: `1px solid ${C.accentLine}`,
      flexShrink: 0,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{
            background: on ? C.accentGlow : "none",
            border: on ? `1.5px solid ${C.accentBorder}` : "1.5px solid transparent",
            borderRadius: 24, cursor: "pointer", display: "flex",
            alignItems: "center", gap: 6,
            padding: "10px 18px",
            minHeight: 48,  // WCAG 2.5.8 minimum target size
            touchAction: "manipulation",
          }}>
            {t.icon(22, on ? C.accent : C.textDim)}
            <span style={{ fontSize: 14, fontWeight: on ? 600 : 400, color: on ? C.accent : C.textDim }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── HAMBURGER MENU ───
   useEffect locks body scroll while drawer is open — critical on
   full-screen mobile to prevent background content scrolling through. */
const MenuDrawer = ({ open, onClose, items }) => {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      pointerEvents: open ? "auto" : "none",
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(14,12,10,0.65)",
          opacity: open ? 1 : 0,
          transition: "opacity 0.25s ease",
          backdropFilter: open ? "blur(2px)" : "none",
          WebkitBackdropFilter: open ? "blur(2px)" : "none",
        }}
      />
      {/* Drawer panel */}
      <div style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: 288,
        background: C.card,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        boxShadow: "16px 0 40px rgba(0,0,0,0.5)",
        borderRight: `1px solid ${C.divider}`,
        display: "flex", flexDirection: "column",
        willChange: "transform",
      }}>
        {/* Drawer header — respects safe area on mobile */}
        <div style={{
          paddingTop: isMobile ? "calc(env(safe-area-inset-top, 44px) + 14px)" : "22px",
          paddingRight: 18, paddingBottom: 16, paddingLeft: 18,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${C.divider}`,
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.textDim, letterSpacing: "0.14em", fontWeight: 700, fontFamily: F.display }}>MENU</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.cream, marginTop: 2, fontFamily: F.display }}>WXPN</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            touchAction: "manipulation",
          }}>
            {ic.close(22, C.cream)}
          </button>
        </div>
        {/* Menu items — 56px min height each for easy tapping */}
        <div style={{ padding: "6px 0", overflow: "auto", overscrollBehaviorY: "contain", flex: 1 }}>
          {items.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              onClick={() => { item.action?.(); onClose(); }}
              style={{
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: "0 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                color: C.cream, fontSize: 18, fontWeight: 500, textAlign: "left", fontFamily: F.display,
                borderBottom: `1px solid ${C.divider}`,
                minHeight: 58,
                touchAction: "manipulation",
              }}
            >
              <span>{item.label}</span>
              {item.note && <span style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.14em", fontFamily: F.mono }}>{item.note}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── MINI PLAYER ─── */
const Mini = ({ onTap, playing }) => (
  <div style={{
    margin: "0 8px 4px",
    borderRadius: 16,
    background: C.surface,
    border: `1px solid ${C.accentLine}`,
    flexShrink: 0,
    overflow: "hidden",
    boxShadow: "0 -2px 16px rgba(0,0,0,0.2)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 8px" }}>
      <img
        onClick={onTap}
        src={ART} alt=""
        style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover", cursor: "pointer", flexShrink: 0 }}
        loading="lazy"
        decoding="async"
      />
      <div onClick={onTap} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        {/* Live dot + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: C.accent, flexShrink: 0, boxShadow: "0 0 5px rgba(213,78,27,0.6)" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accentSoft, letterSpacing: "0.08em", fontFamily: F.display }}>LIVE</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.cream, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Returning to Myself</div>
        <div style={{ fontSize: 13, color: C.textMut }}>Brandi Carlile</div>
      </div>
      <button style={{ ...ibtn, border: `1px solid ${C.divider}`, background: C.card }}>
        {ic.cast(20, C.textMut)}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); }}
        style={{
          width: 48, height: 48, borderRadius: 24, border: "none", cursor: "pointer",
          background: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(217,64,0,0.3)", touchAction: "manipulation", flexShrink: 0,
        }}
      >
        {playing ? ic.pause(22, C.bg) : ic.play(22, C.bg)}
      </button>
    </div>
  </div>
);

/* ═══════════════ LIVE SCREEN ═══════════════ */
const LiveScreen = ({ playing, setPlaying, onExpand }) => {
  const tracks = [
    { title: "Returning to Myself", artist: "Brandi Carlile", time: "2:34 PM", img: ALBUMS.returning },
    { title: "Right Back to It", artist: "Waxahatchee", time: "2:30 PM", img: ALBUMS.tigersBlood },
    { title: "Favourite", artist: "Fontaines D.C.", time: "2:26 PM", img: ALBUMS.romance },
    { title: "Oceans of Darkness", artist: "The War on Drugs", time: "2:22 PM", img: ALBUMS.idlha },
    { title: "Coast", artist: "Kim Deal", time: "2:17 PM", img: ALBUMS.nobody },
  ];
  const onAir = SHOWS.middays;
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* ── Donate banner ── */}
      <div style={{ padding: "10px 12px 0" }}>
        <button style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 14, cursor: "pointer",
          background: "linear-gradient(135deg, rgba(213,78,27,0.14) 0%, rgba(58,90,58,0.08) 100%)",
          border: `1px solid rgba(213,78,27,0.25)`,
          minHeight: 50, touchAction: "manipulation",
        }}>
          {ic.heartF(16, C.accent)}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: "0.1em", fontFamily: F.display }}>SUPPORT WXPN</span>
          <span style={{ fontSize: 13, color: C.textDim }}>—</span>
          <span style={{ fontSize: 13, color: C.cream, fontWeight: 500 }}>Donate Now</span>
          {ic.chev(16, C.accentDim)}
        </button>
      </div>

      {/* ── On Air card ── */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.heroA} 0%, ${C.heroB} 100%)`,
          padding: "14px",
          borderRadius: 16,
          display: "flex", alignItems: "center", gap: 12,
          border: `1px solid rgba(255,255,255,0.05)`,
        }}>
          <img src={onAir.img} alt="" loading="lazy" decoding="async" style={{
            width: 60, height: 60, borderRadius: 12, objectFit: "cover",
            border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.accentSoft, letterSpacing: "0.18em", fontFamily: F.display }}>ON AIR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.cream, lineHeight: 1.2, fontFamily: F.display }}>{onAir.name}</div>
            <div style={{ fontSize: 14, color: "rgba(242,237,230,0.82)" }}>{onAir.host}</div>
            <div style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginTop: 4 }}>{onAir.time}</div>
          </div>
          <button style={{
            ...ibtn,
            background: "rgba(0,0,0,0.25)",
            border: `1px solid rgba(255,255,255,0.12)`,
          }}>
            {ic.chat(20, C.cream)}
          </button>
        </div>
      </div>

      {/* ── Now Playing card ── */}
      <div style={{ padding: "12px" }}>
        <div style={{
          borderRadius: 16, overflow: "hidden",
          background: C.card, border: `1px solid ${C.divider}`,
          padding: "12px",
        }}>
          <div onClick={onExpand} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <img src={ART} alt="" loading="eager" style={{ width: 90, height: 90, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accentSoft, letterSpacing: "0.18em", fontFamily: F.display, marginBottom: 6 }}>NOW PLAYING</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.cream, lineHeight: 1.15, fontFamily: F.display }}>Returning to Myself</div>
              <div style={{ fontSize: 15, color: C.peach, marginTop: 2 }}>Brandi Carlile</div>
              <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>Returning to Myself — 2025</div>
            </div>
          </div>
          {/* Action bar — full-width 3-button row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 12, paddingTop: 10,
            borderTop: `1px solid ${C.divider}`,
          }}>
            {[
              { icon: ic.heart, label: "Save" },
              { icon: ic.share, label: "Share" },
              { icon: ic.chev, label: "Details" },
            ].map(({ icon, label }) => (
              <button key={label} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                minHeight: 44, borderRadius: 10,
                border: `1px solid ${C.divider}`, background: C.surface,
                cursor: "pointer", touchAction: "manipulation",
              }}>
                {icon(16, C.accent)}
                <span style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Listen Live controls ── */}
      <div style={{ padding: "0 12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button aria-label={playing ? "Pause live stream" : "Play live stream"} onClick={() => setPlaying(!playing)} style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            background: C.accent,
            border: "none", borderRadius: 26,
            padding: "13px 18px", cursor: "pointer",
            minHeight: 52,
            boxShadow: "0 6px 20px rgba(217,64,0,0.32)",
            touchAction: "manipulation",
          }}>
            {playing ? ic.pause(22, C.bg) : ic.play(22, C.bg)}
            <span style={{ fontSize: 17, fontWeight: 700, color: C.bg, fontFamily: F.display, letterSpacing: "0.01em" }}>
              {playing ? "Listening" : "Listen Live"}
            </span>
          </button>
          <button style={{
            ...ibtn,
            width: 52, height: 52, borderRadius: 26,
            border: `1px solid ${C.divider}`, background: C.card,
          }}>
            {ic.cast(22, C.textMut)}
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />

      {/* ── Recently Played ── */}
      <div style={{ padding: "18px 16px 6px" }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.cream, fontFamily: F.display }}>Recently Played</div>
      </div>
      {tracks.map((t, i) => (
        <div key={i} style={{
          margin: "6px 12px", padding: "12px",
          borderRadius: 12, background: C.card, border: `1px solid ${C.divider}`,
          display: "flex", alignItems: "center", gap: 12,
          minHeight: 64,
        }}>
          <img src={t.img || TRACK} alt="" loading="lazy" decoding="async"
            style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.cream, lineHeight: 1.3, fontFamily: F.display }}>{t.title}</div>
            <div style={{ fontSize: 14, color: C.textMut, fontWeight: 400 }}>{t.artist}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginBottom: 2 }}>{t.time}</span>
            <div style={{ display: "flex" }}>
              <button style={ibtn}>{ic.heart(20, C.accent)}</button>
              <button style={ibtn}>{ic.chev(20, C.accent)}</button>
            </div>
          </div>
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SHOWS ═══════════════ */
const ShowsScreen = ({ onShow }) => {
  const [tab, setTab] = useState("archive");
  const tabs = ["Archive", "Hosts", "Schedule"];
  const shows = [
    { ...SHOWS.morning, meta: SHOWS.morning.time },
    { ...SHOWS.middays, meta: SHOWS.middays.time },
    { ...SHOWS.worldcafe, meta: SHOWS.worldcafe.time },
    { ...SHOWS.afternoons, meta: SHOWS.afternoons.time },
  ];
  const sched = [
    { time: "6–10a", show: SHOWS.morning },
    { time: "10a–2p", show: SHOWS.middays, on: true },
    { time: "2–4p", show: SHOWS.worldcafe },
    { time: "4–7p", show: SHOWS.afternoons },
    { time: "8–11p", show: SHOWS.funky, note: "Fri" },
  ];
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* Sub-tabs — 48px tall for easy tap */}
      <div style={{ display: "flex", borderBottom: `2px solid ${C.divider}`, flexShrink: 0 }}>
        {tabs.map(t => {
          const k = t.toLowerCase();
          const on = tab === k;
          return (
            <button key={t} onClick={() => setTab(k)} style={{
              flex: 1, padding: "14px 0", fontSize: 15, fontWeight: on ? 600 : 400,
              cursor: "pointer", background: "none", fontFamily: F.body, textAlign: "center",
              color: on ? C.cream : C.textMut,
              borderBottom: on ? `3px solid ${C.accent}` : "3px solid transparent",
              borderTop: "none", borderLeft: "none", borderRight: "none", marginBottom: -2,
              minHeight: 50, touchAction: "manipulation",
            }}>{t}</button>
          );
        })}
      </div>

      {tab === "schedule" ? (
        <div style={{ padding: "6px 0" }}>
          {sched.map((s, i) => (
            <div key={i} onClick={() => s.on && onShow?.(s.show)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              borderBottom: `1px solid ${C.divider}`, cursor: s.on ? "pointer" : "default",
              background: s.on ? C.accentGlow : "transparent",
              minHeight: 64,
            }}>
              <div style={{ width: 68, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontFamily: F.mono, color: s.on ? C.accent : C.textDim }}>{s.time}</span>
                {s.note && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{s.note}</div>}
              </div>
              <img src={s.show.img} alt="" loading="lazy" decoding="async"
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: s.on ? C.cream : C.text, fontFamily: F.display }}>{s.show.name}</div>
                <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>{s.show.host}</div>
              </div>
            </div>
          ))}
        </div>
      ) : tab === "hosts" ? (
        <div style={{ padding: "8px 0" }}>
          {HOSTS.map((h, i) => h.group ? (
            <div key={i} style={{
              margin: "8px 12px", borderRadius: 14, background: C.card,
              border: `1px solid ${C.divider}`,
            }}>
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.accent }}>{h.show}</div>
                    {h.time && <div style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginTop: 3 }}>{h.time}</div>}
                  </div>
                  <button style={ibtn}>{ic.chev(20, C.accent)}</button>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  {h.hosts.map((co, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={co.img} alt="" loading="lazy" decoding="async"
                        style={{ width: 48, height: 48, borderRadius: 24, objectFit: "cover", border: `2px solid ${C.divider}` }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.cream, fontFamily: F.display }}>{co.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div key={i} style={{
              margin: "8px 12px", borderRadius: 14, background: C.card,
              border: `1px solid ${C.divider}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px", minHeight: 72 }}>
                <img src={h.img} alt="" loading="lazy" decoding="async"
                  style={{ width: 56, height: 56, borderRadius: 28, objectFit: "cover", flexShrink: 0, border: `2px solid ${C.divider}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: C.cream, fontFamily: F.display }}>{h.name}</div>
                  <div style={{ fontSize: 14, color: C.accent }}>{h.show}</div>
                  {h.time && <div style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginTop: 3 }}>{h.time}</div>}
                </div>
                <button style={ibtn}>{ic.chev(20, C.accent)}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Sort dropdown */}
          <div style={{
            margin: "12px 12px 6px", padding: "13px 14px", borderRadius: 10,
            background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-between",
            minHeight: 50,
          }}>
            <span style={{ fontSize: 15, color: C.textMut }}>Alphabetical by show (A-Z)</span>
            {ic.chevD(18, C.textMut)}
          </div>

          {/* Show list */}
          {shows.map((s, i) => (
            <div key={i} style={{
              margin: "8px 12px", borderRadius: 14, background: C.card,
              border: `1px solid ${C.divider}`,
            }}>
              <div onClick={() => onShow?.(s)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px",
                cursor: "pointer", minHeight: 80,
              }}>
                <img src={s.img} alt="" loading="lazy" decoding="async"
                  style={{ width: 68, height: 68, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: C.cream, marginBottom: 4, fontFamily: F.display }}>{s.name}</div>
                  <div style={{ fontSize: 14, color: C.textMut }}>{s.host}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 5, fontFamily: F.mono }}>{s.meta}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0, flexShrink: 0 }}>
                  <button style={ibtn} onClick={(e) => e.stopPropagation()}>{ic.heart(22, C.accent)}</button>
                  <button style={ibtn}>{ic.chev(22, C.accent)}</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SHOW DETAIL ═══════════════ */
const ShowDetail = ({ show, onBack, onEp }) => {
  const s = show || SHOWS.worldcafe;
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* Hero image */}
      <div style={{ position: "relative", height: 170, overflow: "hidden", flexShrink: 0 }}>
        <img src={s.img} alt="" loading="eager" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35)" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 20%, ${C.bg})` }} />
        <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 14, alignItems: "flex-end" }}>
          <img src={s.img} alt="" style={{ width: 78, height: 78, borderRadius: 10, objectFit: "cover", border: `2px solid ${C.bg}` }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.cream, fontFamily: F.display, letterSpacing: "0.01em" }}>{s.name}</div>
            <div style={{ fontSize: 15, color: C.accent }}>{s.host}</div>
            <div style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginTop: 4 }}>{s.time}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 16, color: C.textMut, lineHeight: 1.65, margin: 0 }}>
          {s.desc}
        </p>
      </div>
      {/* Action buttons — 52px tall, full pill */}
      <div style={{ display: "flex", gap: 10, padding: "0 16px 14px" }}>
        <button onClick={() => onEp?.()} style={{
          flex: 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: C.accent, border: "none", borderRadius: 26,
          padding: "12px 16px", cursor: "pointer", minHeight: 50,
          boxShadow: "0 4px 14px rgba(217,64,0,0.28)",
          touchAction: "manipulation",
        }}>
          {ic.play(18, C.bg)}
          <span style={{ fontSize: 15, fontWeight: 700, color: C.bg, fontFamily: F.display }}>Play Latest</span>
        </button>
        <button style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "none",
          border: `1.5px solid ${C.accent}`,
          borderRadius: 26,
          padding: "12px 22px", cursor: "pointer", minHeight: 50,
          touchAction: "manipulation",
        }}>
          {ic.heart(18, C.accent)}
          <span style={{ fontSize: 15, fontWeight: 600, color: C.accent, fontFamily: F.display }}>Follow</span>
        </button>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      {/* Episode list */}
      {(s.episodes || []).map((ep, i) => (
        <div key={i} style={{ margin: "8px 12px", borderRadius: 12, background: C.card, border: `1px solid ${C.divider}` }}>
          <div onClick={() => onEp?.()} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px", cursor: "pointer", minHeight: 68,
          }}>
            <img src={ep.img || s.img} alt="" loading="lazy" decoding="async"
              style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.cream }}>{ep.title}</div>
              <div style={{ fontSize: 13, color: C.textMut, marginTop: 3 }}>{ep.date} — {ep.dur}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <button style={ibtn} onClick={(e) => e.stopPropagation()}>{ic.heart(20, C.accent)}</button>
              <button style={ibtn}>{ic.chev(20, C.accent)}</button>
            </div>
          </div>
        </div>
      ))}
      <div style={{ height: 16 }} />
    </div>
  );
};

/* ═══════════════ ARCHIVE PLAYER ═══════════════ */
const ArchivePlayer = ({ show }) => {
  const s = show || SHOWS.worldcafe;
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* Album art */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 16px 20px" }}>
        <div style={{ width: 220, height: 220, borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.55)" }}>
          <img src={ARTIST} alt="" loading="eager" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      {/* Track metadata */}
      <div style={{ textAlign: "center", padding: "0 24px 18px" }}>
        <div style={{ fontSize: 23, fontWeight: 600, color: C.cream, fontFamily: F.display, lineHeight: 1.2 }}>Adia Victoria Session</div>
        <div style={{ fontSize: 16, color: C.peach, marginTop: 6 }}>{s.name}</div>
        <div style={{ fontSize: 14, color: C.textMut, marginTop: 3 }}>Feb 9, 2026 — 52 min</div>
      </div>
      {/* Progress scrubber — 36px tall hit area so it's easy to grab */}
      <div style={{ padding: "0 28px 8px" }}>
        <div style={{ height: 36, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
          <div style={{ flex: 1, height: 5, borderRadius: 2.5, background: C.surface, position: "relative" }}>
            <div style={{ width: "35%", height: "100%", borderRadius: 2.5, background: C.accent }} />
            <div style={{
              width: 18, height: 18, borderRadius: 9, background: C.cream,
              position: "absolute", top: "50%", left: "35%",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 13, color: C.textMut, fontFamily: F.mono }}>18:12</span>
          <span style={{ fontSize: 13, color: C.textMut, fontFamily: F.mono }}>52:00</span>
        </div>
      </div>
      {/* Playback controls */}
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
          background: C.accent, border: "none", borderRadius: 30,
          padding: "12px 28px", cursor: "pointer", minHeight: 56,
          boxShadow: "0 6px 18px rgba(217,64,0,0.3)",
          touchAction: "manipulation",
        }}>
          {ic.pause(26, C.bg)}
          <span style={{ fontSize: 17, fontWeight: 700, color: C.bg, fontFamily: F.display }}>Playing</span>
        </button>
        <button style={{
          width: 52, height: 52, borderRadius: 26,
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation",
        }}>
          {ic.skipFwd(30, C.textSec)}
        </button>
        <button style={{
          ...ibtn,
          background: C.card, border: `1px solid ${C.divider}`,
        }}>
          {ic.cast(22, C.textMut)}
        </button>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      <div style={{ padding: "16px 16px 6px" }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: C.cream, fontFamily: F.display }}>In This Episode</div>
      </div>
      {[
        { song: "Mean", artist: "Adia Victoria", at: "2:15" },
        { song: "Magnolia Blues", artist: "Adia Victoria", at: "12:30" },
        { song: "Different Kind of Love", artist: "Adia Victoria", at: "24:45" },
      ].map((t, i) => (
        <div key={i} style={{
          margin: "6px 12px", borderRadius: 12, background: C.card,
          border: `1px solid ${C.divider}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", minHeight: 62 }}>
            <img src={ARTIST} alt="" loading="lazy" decoding="async"
              style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.cream }}>{t.song}</div>
              <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>{t.artist}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginRight: 2 }}>{t.at}</span>
              <button style={ibtn}>{ic.heart(20, C.accent)}</button>
              <button style={ibtn}>{ic.chev(20, C.accent)}</button>
            </div>
          </div>
        </div>
      ))}
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
    <div style={{
      margin: "6px 12px", borderRadius: 12, background: C.card,
      border: `1px solid ${saved ? C.accentBorder : C.divider}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px 12px 12px", minHeight: 72 }}>
        {/* Date block */}
        <div style={{ width: 46, textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: C.textMut, fontFamily: F.mono, letterSpacing: "0.08em" }}>{c.day}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.cream, fontFamily: F.display, lineHeight: 1.15 }}>{d.getDate()}</div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: C.divider, flexShrink: 0 }} />
        {/* Artist / venue / badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.cream, fontFamily: F.display, lineHeight: 1.25 }}>{c.artist}</div>
          <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.venue}{c.region ? ` · ${c.region}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            {c.xpnWelcomes && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.accentSoft, fontFamily: F.mono,
                letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 4,
                border: `1px solid ${C.accentBorder}`, background: C.accentGlow,
              }}>XPN WELCOMES</span>
            )}
            {c.age && <span style={{ fontSize: 11, color: C.textDim, fontFamily: F.mono }}>{c.age}</span>}
          </div>
        </div>
        {/* Heart */}
        <button
          aria-label={saved ? `Remove ${c.artist} from saved concerts` : `Save ${c.artist} concert`}
          onClick={() => onToggle(c.id)}
          style={ibtn}
        >
          {saved ? ic.heartF(22, C.accent) : ic.heart(22, C.textMut)}
        </button>
      </div>
    </div>
  );
};

const ConcertsScreen = () => {
  const [concerts, setConcerts] = useState(null);
  const [filter, setFilter] = useState("all");
  const [saved, toggleSaved] = useSavedConcerts();
  useEffect(() => { fetchConcerts().then(setConcerts); }, []);

  const chips = [
    { id: "all", label: "All" },
    { id: "welcomes", label: "XPN Welcomes" },
    { id: "saved", label: "Saved" },
  ];
  const list = (concerts || []).filter(c =>
    filter === "welcomes" ? c.xpnWelcomes :
    filter === "saved" ? saved.has(c.id) : true
  );

  // Group by month, preserving date order
  const groups = [];
  for (const c of list) {
    const label = monthLabel(c.date);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(c);
    else groups.push({ label, items: [c] });
  }

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "16px 16px 4px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.cream, fontFamily: F.display }}>Concert Calendar</div>
        <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 4, lineHeight: 1.45 }}>
          Shows coming through Philly and beyond, curated by WXPN. Tap the heart to save one.
        </div>
      </div>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 6px", flexWrap: "wrap" }}>
        {chips.map(ch => {
          const on = filter === ch.id;
          return (
            <button key={ch.id} onClick={() => setFilter(ch.id)} style={{
              padding: "8px 16px", minHeight: 38, borderRadius: 20, cursor: "pointer",
              fontSize: 13.5, fontWeight: on ? 600 : 400, fontFamily: F.body,
              color: on ? C.cream : C.textMut,
              background: on ? C.accentGlow : "none",
              border: on ? `1.5px solid ${C.accentBorder}` : `1.5px solid ${C.divider}`,
              touchAction: "manipulation",
            }}>
              {ch.label}{ch.id === "saved" && saved.size > 0 ? ` (${saved.size})` : ""}
            </button>
          );
        })}
      </div>
      {/* List */}
      {concerts === null ? (
        <div style={{ padding: "40px 16px", textAlign: "center", color: C.textMut, fontSize: 14 }}>
          Loading shows…
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: "44px 32px", textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}>{ic.heart(28, C.textDim)}</div>
          <div style={{ fontSize: 15, color: C.textSec, fontFamily: F.display, fontWeight: 600 }}>
            {filter === "saved" ? "No saved concerts yet" : "No shows found"}
          </div>
          {filter === "saved" && (
            <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 6, lineHeight: 1.5 }}>
              Heart a show on the calendar and it'll be waiting here and in Favorites.
            </div>
          )}
        </div>
      ) : groups.map(g => (
        <div key={g.label}>
          <div style={{
            padding: "14px 16px 6px", fontSize: 12, fontWeight: 700, color: C.peach,
            fontFamily: F.mono, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>{g.label}</div>
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
const FavScreen = ({ onShow, onConcerts }) => {
  const [tab, setTab] = useState("songs");
  const [saved, toggleSaved] = useSavedConcerts();
  const [concerts, setConcerts] = useState([]);
  useEffect(() => { fetchConcerts().then(setConcerts); }, []);
  const savedConcerts = concerts.filter(c => saved.has(c.id));
  const songs = [
    { title: "Right Back to It", artist: "Waxahatchee", date: "Feb 9", img: ALBUMS.tigersBlood },
    { title: "Favourite", artist: "Fontaines D.C.", date: "Feb 8", img: ALBUMS.romance },
    { title: "Oceans of Darkness", artist: "The War on Drugs", date: "Feb 7", img: ALBUMS.idlha },
    { title: "Coast", artist: "Kim Deal", date: "Feb 6", img: ALBUMS.nobody },
    { title: "Savage Good Boy", artist: "Japanese Breakfast", date: "Feb 5", img: ALBUMS.jubilee },
  ];
  const favShows = [SHOWS.worldcafe, SHOWS.funky, SHOWS.morning];
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `2px solid ${C.divider}`, flexShrink: 0 }}>
        {["Songs", "Shows", "Concerts"].map(t => {
          const on = tab === t.toLowerCase();
          return (
            <button key={t} onClick={() => setTab(t.toLowerCase())} style={{
              flex: 1, padding: "14px 0", fontSize: 15, fontWeight: on ? 600 : 400, cursor: "pointer",
              background: "none", fontFamily: F.body, textAlign: "center",
              color: on ? C.cream : C.textMut,
              borderBottom: on ? `3px solid ${C.accent}` : "3px solid transparent",
              borderTop: "none", borderLeft: "none", borderRight: "none", marginBottom: -2,
              minHeight: 50, touchAction: "manipulation",
            }}>{t}</button>
          );
        })}
      </div>
      {tab === "songs" ? songs.map((t, i) => (
        <div key={i} style={{
          margin: "6px 12px", borderRadius: 12, background: C.card,
          border: `1px solid ${C.divider}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", minHeight: 64 }}>
            <img src={t.img || TRACK} alt="" loading="lazy" decoding="async"
              style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.cream, fontFamily: F.display }}>{t.title}</div>
              <div style={{ fontSize: 14, color: C.textMut, marginTop: 2 }}>{t.artist}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: F.mono, marginBottom: 2 }}>{t.date}</span>
              <div style={{ display: "flex" }}>
                <button style={ibtn}>{ic.heartF(20, C.accent)}</button>
                <button style={ibtn}>{ic.chev(20, C.accent)}</button>
              </div>
            </div>
          </div>
        </div>
      )) : tab === "shows" ? favShows.map((s, i) => (
        <div key={i} style={{
          margin: "8px 12px", borderRadius: 14, background: C.card,
          border: `1px solid ${C.divider}`,
        }}>
          <div onClick={() => onShow?.(s)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px", cursor: "pointer", minHeight: 76 }}>
            <img src={s.img} alt="" loading="lazy" decoding="async"
              style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: C.cream, fontFamily: F.display }}>{s.name}</div>
              <div style={{ fontSize: 14, color: C.textMut, marginTop: 3 }}>{s.host}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0, flexShrink: 0 }}>
              <button style={ibtn} onClick={(e) => e.stopPropagation()}>{ic.heartF(22, C.accent)}</button>
              <button style={ibtn}>{ic.chev(22, C.accent)}</button>
            </div>
          </div>
        </div>
      )) : savedConcerts.length === 0 ? (
        <div style={{ padding: "44px 32px", textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}>{ic.heart(28, C.textDim)}</div>
          <div style={{ fontSize: 15, color: C.textSec, fontFamily: F.display, fontWeight: 600 }}>No saved concerts yet</div>
          <div style={{ fontSize: 13.5, color: C.textMut, marginTop: 6, lineHeight: 1.5 }}>
            Browse the Concert Calendar and heart the shows you want to catch.
          </div>
          <button onClick={() => onConcerts?.()} style={{
            marginTop: 16, padding: "10px 20px", minHeight: 44, borderRadius: 22,
            background: C.accentGlow, border: `1.5px solid ${C.accentBorder}`,
            color: C.cream, fontSize: 14, fontWeight: 600, fontFamily: F.body,
            cursor: "pointer", touchAction: "manipulation",
          }}>Open Concert Calendar</button>
        </div>
      ) : savedConcerts.map(c => (
        <ConcertRow key={c.id} c={c} saved={true} onToggle={toggleSaved} />
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
};

/* ═══════════════ SETTINGS ═══════════════ */
const SettingsScreen = () => {
  const [q, setQ] = useState("high");
  const [cp, setCp] = useState(false);
  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 18, color: C.cream, fontFamily: F.display }}>Bit Rate</span>
          <div style={{ width: 22, height: 22, borderRadius: 11, border: `1.5px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>i</span>
          </div>
        </div>
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.divider}` }}>
          {[{ id: "low", l: "64kbps", s: "Lower Quality" }, { id: "high", l: "160kbps", s: "Higher Quality" }].map(x => (
            <button key={x.id} onClick={() => setQ(x.id)} style={{
              flex: 1, padding: "16px 0", cursor: "pointer", border: "none",
              background: q === x.id ? C.surfaceHi : "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: F.body,
              minHeight: 70, touchAction: "manipulation",
            }}>
              <span style={{ fontSize: 17, fontWeight: q === x.id ? 600 : 400, color: q === x.id ? C.cream : C.textMut }}>
                {q === x.id ? "✓ " : ""}{x.l}
              </span>
              <span style={{ fontSize: 13, color: C.textDim }}>{x.s}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 18, color: C.cream, marginBottom: 14, fontFamily: F.display }}>Favorites</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}`,
          minHeight: 64,
        }}>
          <div>
            <div style={{ fontSize: 16, color: C.accent }}>Share Favorites</div>
            <div style={{ fontSize: 14, color: C.textMut, marginTop: 3 }}>Share all Favorites in a text or csv file</div>
          </div>
          {ic.shareAlt(22, C.textMut)}
        </div>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 18, color: C.cream, marginBottom: 14, fontFamily: F.display }}>CarPlay Settings</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 0", borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}`,
          minHeight: 68,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 16, color: C.cream }}>Time Skip Controls</div>
              <div style={{ fontSize: 13, color: C.textMut, marginTop: 2 }}>Make visible in CarPlay</div>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `1.5px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>i</span>
            </div>
          </div>
          {/* Toggle — 54×32 pill with extended tap wrapper for accessibility */}
          <button
            onClick={() => setCp(!cp)}
            style={{
              padding: "8px 0 8px 12px",  // enlarged tap area
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
              <div style={{ width: 28, height: 28, borderRadius: 14, background: cp ? C.bg : C.textDim, transition: "all 0.2s" }} />
            </div>
          </button>
        </div>
      </div>
      <div style={{ height: 1, background: C.divider, margin: "0 16px" }} />
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 18, color: C.cream, marginBottom: 10, fontFamily: F.display }}>Contact</div>
        {["Technical Support", "Contact WXPN"].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0", borderBottom: `1px solid ${C.divider}`,
            minHeight: 58,
          }}>
            <span style={{ fontSize: 16, color: C.textSec }}>{item}</span>
            {ic.chev(20, C.textDim)}
          </div>
        ))}
      </div>
      <div style={{ height: 6, background: C.divider, margin: "8px 0" }} />
      <div style={{ padding: "12px 16px" }}>
        {["About WXPN", "Terms of Use", "Privacy Policy"].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0", borderBottom: `1px solid ${C.divider}`,
            minHeight: 58,
          }}>
            <span style={{ fontSize: 16, color: C.textSec }}>{item}</span>
            {ic.chev(20, C.textDim)}
          </div>
        ))}
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
};

/* ═══════════════ EXPANDED NOW PLAYING ═══════════════
   Swipe-down-to-dismiss: track touch start Y, compute delta,
   visually translate the sheet, dismiss if delta > 90px.
   willChange: "transform" hints the browser to promote to its own
   compositing layer so the animation stays on the GPU.
   Safe-area-inset is applied top + bottom on real mobile devices. */
const NowPlaying = ({ open, onClose, playing, setPlaying }) => {
  const touchStartY = useRef(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      touchStartY.current = null;
    }
  }, [open]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > 90) {
      onClose();
    } else {
      setDragY(0);
    }
    touchStartY.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "absolute", inset: 0, zIndex: 300,
        background: `linear-gradient(180deg, ${C.card} 0%, ${C.bg} 50%)`,
        transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
        transition: dragY > 0 ? "none" : "transform 0.36s cubic-bezier(0.32, 0.72, 0, 1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        willChange: "transform",
      }}
    >
      {/* Drag handle + collapse button */}
      <div style={{
        paddingTop: isMobile ? "calc(env(safe-area-inset-top, 44px) + 10px)" : "14px",
        paddingBottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        flexShrink: 0,
      }}>
        {/* Wider pill = easier to see as a grab target */}
        <div style={{ width: 48, height: 5, borderRadius: 2.5, background: C.textDim, opacity: 0.45, marginBottom: 8 }} />
        <button aria-label="Close" onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "manipulation",
        }}>
          {ic.chevD(28, C.textMut)}
        </button>
      </div>

      {/* Center: art, track info, controls */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 32px", gap: 24,
      }}>
        {/* Album art — responsive size on mobile */}
        <div style={{
          width: isMobile ? "min(260px, 72vw)" : 240,
          height: isMobile ? "min(260px, 72vw)" : 240,
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 20px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}>
          <img src={ART} alt="Album art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Track info */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <div style={{ fontSize: isMobile ? 26 : 24, fontWeight: 700, color: C.cream, fontFamily: F.display, lineHeight: 1.2 }}>
            Returning to Myself
          </div>
          <div style={{ fontSize: 18, color: C.peach, marginTop: 8 }}>Brandi Carlile</div>
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>Returning to Myself — 2025</div>
        </div>

        {/* Live badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, boxShadow: "0 0 8px rgba(213,78,27,0.6)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.accentSoft, letterSpacing: "0.18em", fontFamily: F.display }}>
            LIVE ON 88.5
          </span>
        </div>

        {/* Playback controls — heart | play | cast */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button style={{
            ...ibtn, width: 52, height: 52, borderRadius: 26,
            background: C.card, border: `1px solid ${C.divider}`,
          }}>
            {ic.heart(24, C.accent)}
          </button>
          <button aria-label={playing ? "Pause live stream" : "Play live stream"} onClick={() => setPlaying(!playing)} style={{
            width: 76, height: 76, borderRadius: 38,
            background: C.accent, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 28px rgba(213,78,27,0.42)",
            touchAction: "manipulation",
          }}>
            {playing ? ic.pause(34, C.bg) : ic.play(34, C.bg)}
          </button>
          <button style={{
            ...ibtn, width: 52, height: 52, borderRadius: 26,
            background: C.card, border: `1px solid ${C.divider}`,
          }}>
            {ic.cast(24, C.textMut)}
          </button>
        </div>
      </div>

      {/* Donate banner — bottom safe area on mobile */}
      <div style={{
        padding: `12px 20px`,
        paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 24px)" : "44px",
        flexShrink: 0,
      }}>
        <button style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 14, cursor: "pointer",
          background: "linear-gradient(135deg, rgba(213,78,27,0.14) 0%, rgba(58,90,58,0.08) 100%)",
          border: `1px solid rgba(213,78,27,0.25)`,
          minHeight: 50, touchAction: "manipulation",
        }}>
          {ic.heartF(16, C.accent)}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: "0.1em", fontFamily: F.display }}>SUPPORT WXPN</span>
          <span style={{ fontSize: 13, color: C.textDim }}>—</span>
          <span style={{ fontSize: 13, color: C.cream, fontWeight: 500 }}>Donate Now</span>
          {ic.chev(16, C.accentDim)}
        </button>
      </div>
    </div>
  );
};

/* ═══════════════ MAIN APP ═══════════════ */
export default function WXPNApp() {
  const [screen, setScreen] = useState("live");
  const [sub, setSub] = useState(null);
  const [settings, setSettings] = useState(false);
  const [selectedShow, setSelectedShow] = useState(SHOWS.worldcafe);
  const [menuOpen, setMenuOpen] = useState(false);
  // Start paused — browsers block autoplay with sound, and on first launch
  // the user should tap play deliberately anyway.
  const [playing, setPlaying] = useState(false);
  const [npOpen, setNpOpen] = useState(false);

  // Real audio. initPlayer wires up the <audio> element and Media Session
  // (lock screen / control center play-pause) once on mount. The Media Session
  // handlers call setPlaying so hardware/lock-screen controls stay in sync
  // with the UI.
  useEffect(() => { initPlayer(setPlaying); }, []);
  useEffect(() => { playing ? playStream() : pauseStream(); }, [playing]);

  const nav = id => { setScreen(id); setSub(null); setSettings(false); setNpOpen(false); };
  const showBack = settings || !!sub;
  const showMini = screen !== "live" && sub !== "archive" && !settings;
  const menuItems = [
    { label: "Home", action: () => nav("live") },
    { label: "Playlist", action: () => nav("live") },
    { label: "XPN.org", note: "WEB" },
    { label: "Donate", note: "WEB" },
    { label: "Connect", note: "WEB" },
    { label: "Alarm Clock" },
    { label: "Festival", note: "WEB" },
    { label: "Music News", note: "WEB" },
    { label: "Concert Calendar", action: () => nav("concerts") },
    {
      label: "World Cafe",
      action: () => {
        setSettings(false);
        setSelectedShow(SHOWS.worldcafe);
        setScreen("shows");
        setSub("show");
      },
    },
    { label: "Settings", action: () => { setSettings(true); setSub(null); } },
    { label: "Privacy Policy", note: "WEB" },
  ];

  const content = () => {
    if (settings) return <SettingsScreen />;
    if (sub === "show") return <ShowDetail show={selectedShow} onBack={() => setSub(null)} onEp={() => setSub("archive")} />;
    if (sub === "archive") return <ArchivePlayer show={selectedShow} />;
    if (screen === "shows") return <ShowsScreen onShow={(show) => { setSelectedShow(show); setSub("show"); }} />;
    if (screen === "concerts") return <ConcertsScreen />;
    if (screen === "favorites") return <FavScreen onConcerts={() => nav("concerts")} onShow={(show) => { setSelectedShow(show); setScreen("shows"); setSub("show"); }} />;
    return <LiveScreen playing={playing} setPlaying={setPlaying} onExpand={() => setNpOpen(true)} />;
  };

  const phoneContent = (
    <>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <Header
        showBack={showBack}
        onBack={() => {
          if (settings) setSettings(false);
          else if (sub === "archive") setSub("show");
          else setSub(null);
        }}
        onMenu={() => setMenuOpen(true)}
      />
      {content()}
      {showMini && <Mini onTap={() => setNpOpen(true)} playing={playing} />}
      <Nav active={screen} onNav={nav} />
      <NowPlaying open={npOpen} onClose={() => setNpOpen(false)} playing={playing} setPlaying={setPlaying} />
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
      justifyContent: "center", padding: "40px 20px", background: "#0D0B09",
    }}>
      <Phone>{phoneContent}</Phone>
      <div style={{ marginTop: 20, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 420 }}>
        {[
          { id: "live", label: "Live" },
          { id: "shows", label: "Shows" },
          { id: "favorites", label: "Favorites" },
          { id: "_s", label: "Settings" },
        ].map((s, i) => {
          const on = s.id === "_s" ? settings : (screen === s.id && !sub && !settings);
          return (
            <button key={i} onClick={() => {
              if (s.id === "_s") { setSettings(true); setSub(null); } else nav(s.id);
            }} style={{
              padding: "7px 18px", borderRadius: 20, fontSize: 13, cursor: "pointer",
              fontFamily: F.body, fontWeight: 500,
              background: on ? C.accent : "rgba(18,16,14,0.92)",
              color: on ? C.bg : C.textMut,
              border: `1px solid ${on ? "transparent" : C.divider}`,
              touchAction: "manipulation",
            }}>{s.label}</button>
          );
        })}
      </div>
    </div>
  );
}
