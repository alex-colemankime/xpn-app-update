// theme.js — design tokens shared by every component.

// Detect real mobile device once at startup (not reactive — window width won't change)
export const isMobile = window.innerWidth <= 430;

export const C = {
  bg: "#12100E",
  card: "#1A1714",
  surface: "#201D19",
  surfaceHi: "#2A2520",
  accent: "#D54E1B",
  accentDim: "#E7732F",
  accentSoft: "#E8C9A0",
  accentGlow: "rgba(213,78,27,0.10)",
  accentBorder: "rgba(213,78,27,0.35)",
  accentLine: "rgba(213,78,27,0.15)",
  heroA: "#1A1C16",
  heroB: "#252118",
  cream: "#F0EAE0",
  peach: "#E8C9A0",
  text: "#E5DED4",
  textSec: "#CFC5B8",
  textMut: "#9C9285",
  textDim: "#6B6258",
  divider: "#2A2520",
  donate: "#C8962E",
  green: "#3A5A3A",
  greenDim: "rgba(58,90,58,0.18)",
  greenLine: "rgba(58,90,58,0.25)",
  white: "#fff",
};
/* Figtree — the same face xpn.org uses, so the app and site feel like
   one brand. Mono stays platform-native for small data accents. */
export const F = {
  body: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace",
};


// Apple HIG minimum touch target: 44×44pt
export const ibtn = {
  width: 44, height: 44, borderRadius: 22,
  border: "none", background: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, touchAction: "manipulation", flexShrink: 0,
};

/* ── Program-guide list system ──
   Lists are flat, edge-to-edge rows separated by hairline rules — like a
   printed program — instead of floating card bubbles. Surfaces and
   borders are reserved for true objects (mini player, on-air, primary
   actions), which is what keeps the design from feeling templated. */
export const row = {
  display: "flex", alignItems: "center", gap: 13,
  padding: "13px 16px",
  borderBottom: `1px solid ${C.divider}`,
};

// Mono eyebrow that opens a section — the "broadcast data" voice.
export const kicker = {
  fontSize: 11, fontWeight: 700, color: C.accentSoft,
  letterSpacing: "0.18em", fontFamily: F.mono, textTransform: "uppercase",
};
