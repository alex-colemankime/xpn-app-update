// Design tokens shared by every component.

export const isMobile =
  typeof window !== "undefined" &&
  window.matchMedia?.("(max-width: 430px)").matches;

export const C = {
  bg: "#FAF2E7",
  bgTop: "#FCF7EF",
  card: "#FFFCF6",
  surface: "#F1E6D4",
  surfaceHi: "#EADCC6",
  divider: "#E9DDC9",

  accent: "#D54E1B",
  accentDim: "#A93B0D",
  accentGlow: "rgba(213,78,27,0.10)",
  accentBorder: "rgba(213,78,27,0.40)",

  ink: "#28201A",
  text: "#3C322A",
  textSec: "#5E5245",
  textMut: "#6E6253",
  textDim: "#857764",
  white: "#fff",
};

export const F = {
  body: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace",
};

export const ibtn = {
  width: 44,
  height: 44,
  borderRadius: 22,
  border: "none",
  background: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  touchAction: "manipulation",
  flexShrink: 0,
};

export const row = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  padding: "13px 16px",
  borderBottom: `1px solid ${C.divider}`,
};

export const kicker = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMut,
  letterSpacing: "0.18em",
  fontFamily: F.mono,
  textTransform: "uppercase",
};

export const screenTitle = {
  fontSize: 26,
  fontWeight: 800,
  color: C.ink,
  fontFamily: F.display,
  letterSpacing: "-0.01em",
};
