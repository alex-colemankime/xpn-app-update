// A saved heart takes its color from the item's artwork: the artwork's most
// prominent vivid color, adjusted per theme so the heart keeps at least 3:1
// contrast with the screen behind it (WCAG 1.4.11). Muted artwork gives its
// own muted tone, and black and white artwork a grey: never the app's
// orange, which is for actions.

import { useEffect, useState } from "react";

// Backgrounds a heart can sit on, per theme (styles/base.css): page, surface,
// alternate row and the player bar.
export const GROUNDS = {
  light: ["#f7f3ea", "#efeadf", "#ebe5da", "#fcf9f2"],
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

// For artwork with no vivid color of its own (a muted or black and white
// cover): its overall tone, the average of its mid-tone pixels (a grey, for
// grey art), so the heart and page still take a little of the cover. Art
// that is only black and white gives a middle grey.
const MIDDLE_GREY = [128, 128, 128];
export function averageTint(pixels) {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const [, , l] = toHsl(rgb);
    if (l < 0.12 || l > 0.92) continue;
    sum[0] += rgb[0];
    sum[1] += rgb[1];
    sum[2] += rgb[2];
    n++;
  }
  return n ? sum.map((v) => v / n) : MIDDLE_GREY;
}

// The color for each theme: lightness moved toward contrast, hue kept. A
// colorful cover's saturation is kept lively so the heart still reads as
// that color; a muted or grey one keeps its own, so a cream cover never
// turns peach.
const COLORFUL = 0.4;
export function themeTints(rgb) {
  if (!rgb) return null;
  const [h, s0, l0] = toHsl(rgb);
  const colorful = s0 >= COLORFUL;
  const s = Math.max(s0, 0.45);
  // A muted tone is lightened or darkened in OKLCH, which keeps how much
  // color it has; in HSL a darker cream would turn tan.
  const [L0, C, H] = oklch(rgb);
  const at = (l) => (colorful ? toRgb([h, s, l]) : fromOklch([l, C, H]));
  const fit = (grounds, step) => {
    let l = colorful ? l0 : L0;
    for (let i = 0; i < 60; i++) {
      const c = at(l);
      if (grounds.every((g) => contrast(c, parseHex(g)) >= MIN_CONTRAST)) return hex(c);
      l = Math.min(1, Math.max(0, l + step));
    }
    return null;
  };
  const light = fit(GROUNDS.light, -0.02);
  const dark = fit(GROUNDS.dark, 0.02);
  return light && dark ? { light, dark } : null;
}

// OKLCH from and to sRGB (Björn Ottosson's OKLab), for the page's wash.
const toLinear = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v) => {
  const c = Math.min(1, Math.max(0, v));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
};
function oklch(color) {
  const [r, g, b] = color.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function fromOklch([L, C, H]) {
  const [A, B] = [C * Math.cos(H), C * Math.sin(H)];
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear);
}

// A wash: `share` of `color` mixed into `paper` (sRGB), then set back to the
// paper's own lightness, so text and hearts keep their contrast on it. As a
// hex color, worked out here rather than with CSS relative colors, which
// some web views (WebKit) don't recompute when the color changes.
export function washed(color, paper, share) {
  const c0 = parseHex(color);
  const p = parseHex(paper);
  const [, c, h] = oklch(c0.map((v, i) => v * share + p[i] * (1 - share)));
  return hex(fromOklch([oklch(p)[0], c, h]));
}

// A wash in each theme, as CSS variables `--{name}-light` and
// `--{name}-dark`: `share` of the tint over the page (`ground` 0) or the
// raised paper (`ground` 1).
export const washVars = (name, tint, ground, [lightShare, darkShare]) => ({
  [`--${name}-light`]: washed(tint.light, GROUNDS.light[ground], lightShare),
  [`--${name}-dark`]: washed(tint.dark, GROUNDS.dark[ground], darkShare),
});

// Tints by artwork URL, shared by every heart showing the same art.
const cache = new Map();
const RETRY_UNREADABLE_MS = 60_000;
function sample(url) {
  if (cache.has(url)) return cache.get(url);
  // null: couldn't read it, so try a fresh copy; false: read, no color.
  const result = readTint(url)
    .then((tint) => (tint === null && /^https?:/.test(url) ? readTint(freshUrl(url)) : tint))
    .then((tint) => {
      // Couldn't read it at all (offline, or a server that won't allow it):
      // remembered only for a minute, so it's tried again later without
      // every heart and row re-downloading it meanwhile.
      if (tint === null) setTimeout(() => cache.delete(url), RETRY_UNREADABLE_MS);
      return tint || null;
    });
  cache.set(url, result);
  return result;
}
// The same image at an address the browser hasn't cached: Safari can hand a
// color-reading request the copy already on screen, loaded without
// permission to read it, and the read fails.
const freshUrl = (url) => `${url}${url.includes("?") ? "&" : "?"}tint=1`;
function readTint(url) {
  return new Promise((resolve) => {
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
        const pixels = ctx.getImageData(0, 0, size, size).data;
        resolve(themeTints(pickTint(pixels) || averageTint(pixels)) ?? false);
      } catch {
        resolve(null); // couldn't read it: try a fresh copy, then keep the accent
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
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
