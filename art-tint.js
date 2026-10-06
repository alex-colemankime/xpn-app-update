// A saved heart takes its color from the item's artwork: the artwork's most
// prominent vivid color, adjusted per theme so the heart keeps at least 3:1
// contrast with the screen behind it (WCAG 1.4.11). Artwork with no vivid
// color (black and white photos, grey logos) keeps the app's accent.

import { useEffect, useState } from "react";

// Backgrounds a heart can sit on, per theme (global.css): page, surface,
// alternate row, the player bar, and a saved row's pale wash of the heart's
// own color (close to the page, so the page stands in for it).
const GROUNDS = {
  light: ["#faf8f3", "#f2efe7", "#eeeae1", "#fffdf8"],
  dark: ["#202224", "#292c2f", "#2b2e30", "#32363a"],
};
const MIN_CONTRAST = 3.2;

const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const parseHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) / 6
      : max === G
        ? ((B - R) / d + 2) / 6
        : ((R - G) / d + 4) / 6;
  return [h, s, l];
}
function toRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// The artwork's prominent vivid color from RGBA pixels (a small downscale is
// plenty), or null when it has none. Pixels are grouped by hue, weighted by
// how vivid they are. A color in real artwork spreads across neighboring
// hues (a lawn is yellow-green to green), so each hue is scored together
// with its two neighbors, and the winning group's average is the color.
// It counts when it carries enough vivid weight, or covers enough of the
// artwork even if muted (a dusky blue sky); a few vivid pixels in grey art
// are neither.
const BINS = 24;
const MIN_WEIGHT = 0.04;
const MIN_SHARE = 0.08;
export function pickTint(pixels) {
  const weight = new Float64Array(BINS);
  const count = new Float64Array(BINS);
  const sums = Array.from({ length: BINS }, () => [0, 0, 0]);
  let counted = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const [h, s, l] = toHsl(rgb);
    counted++;
    if (s < 0.18 || l < 0.12 || l > 0.92) continue;
    const w = s * (1 - Math.abs(l - 0.5) * 1.4);
    const bin = Math.floor(h * BINS) % BINS;
    weight[bin] += w;
    count[bin]++;
    sums[bin][0] += rgb[0] * w;
    sums[bin][1] += rgb[1] * w;
    sums[bin][2] += rgb[2] * w;
  }
  if (!counted) return null;
  const near = (b) => [(b + BINS - 1) % BINS, b, (b + 1) % BINS];
  const total = (list, b) => near(b).reduce((sum, n) => sum + list[n], 0);
  let best = 0;
  for (let b = 1; b < BINS; b++) if (total(weight, b) > total(weight, best)) best = b;
  const w = total(weight, best);
  if (!w || (w < counted * MIN_WEIGHT && total(count, best) < counted * MIN_SHARE)) return null;
  return [0, 1, 2].map((k) => near(best).reduce((sum, n) => sum + sums[n][k], 0) / w);
}

// The color for each theme: lightness moved toward contrast, hue kept, and
// saturation kept lively so the heart still reads as a color.
export function themeTints(rgb) {
  if (!rgb) return null;
  const [h, s0, l0] = toHsl(rgb);
  const s = Math.max(s0, 0.45);
  const fit = (grounds, step) => {
    let l = l0;
    for (let i = 0; i < 60; i++) {
      const c = toRgb([h, s, l]);
      if (grounds.every((g) => contrast(c, parseHex(g)) >= MIN_CONTRAST)) return hex(c);
      l = Math.min(1, Math.max(0, l + step));
    }
    return null;
  };
  const light = fit(GROUNDS.light, -0.02);
  const dark = fit(GROUNDS.dark, 0.02);
  return light && dark ? { light, dark } : null;
}

// Tints by artwork URL, shared by every heart showing the same art.
const cache = new Map();
function sample(url) {
  if (cache.has(url)) return cache.get(url);
  const result = new Promise((resolve) => {
    if (typeof Image === "undefined" || typeof document === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous"; // only artwork served with CORS can be read
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        resolve(themeTints(pickTint(ctx.getImageData(0, 0, size, size).data)));
      } catch {
        resolve(null); // artwork without CORS: keep the accent
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, result);
  return result;
}

// { light, dark } for an artwork URL, or a precomputed tint ({ light, dark }
// from the show data); null until known, or when the art gives no color.
export function useArtTint(url, preset = null) {
  const [found, setFound] = useState({ url: null, tint: null });
  useEffect(() => {
    if (preset || !url) return;
    let live = true;
    sample(url).then((tint) => live && setFound({ url, tint }));
    return () => {
      live = false;
    };
  }, [url, preset]);
  return preset || (found.url === url ? found.tint : null);
}
