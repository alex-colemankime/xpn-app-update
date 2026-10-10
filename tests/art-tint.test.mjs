import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GROUNDS, contrast, pickTint, themeTints } from "../art-tint.js";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const image = (pixels) => Uint8ClampedArray.from(pixels.flatMap((p) => [...p, 255]));

test("artwork color: the prominent vivid hue, or none for grey art", () => {
  const mostlyRed = image([...Array(60).fill([200, 40, 40]), ...Array(40).fill([240, 240, 240])]);
  const [r, g, b] = pickTint(mostlyRed);
  assert.ok(r > 150 && g < 80 && b < 80);
  const grey = image([...Array(97).fill([120, 120, 120]), ...Array(3).fill([0, 0, 255])]);
  assert.equal(pickTint(grey), null, "a few blue pixels do not make grey art blue");
  // A color spread over neighboring hues (a lawn, yellow-green to green) is
  // one color, even when no single hue of it is large.
  const lawn = image([
    ...Array(4).fill([110, 140, 20]),
    ...Array(4).fill([80, 140, 30]),
    ...Array(4).fill([50, 140, 40]),
    ...Array(88).fill([235, 235, 235]),
  ]);
  const [lr, lg, lb] = pickTint(lawn);
  assert.ok(lg > lr && lg > lb, "the lawn is green");
  // A muted color that fills a good part of the art (a dusky sky) counts.
  const dusk = image([...Array(12).fill([100, 120, 175]), ...Array(88).fill([245, 245, 245])]);
  const [dr, , db] = pickTint(dusk);
  assert.ok(db > dr, "the sky is blue");
  assert.equal(themeTints(null), null);
});

test("hearts keep 3:1 contrast in both themes, even for pale or dark art", () => {
  const { light: LIGHT, dark: DARK } = GROUNDS;
  for (const art of [
    [250, 240, 120],
    [20, 30, 90],
    [200, 40, 40],
    [80, 200, 200],
  ]) {
    const t = themeTints(art);
    for (const g of LIGHT) assert.ok(contrast(rgb(t.light), rgb(g)) >= 3, `${t.light} on ${g}`);
    for (const g of DARK) assert.ok(contrast(rgb(t.dark), rgb(g)) >= 3, `${t.dark} on ${g}`);
  }
  // The same check for every show's stored tint.
  const shows = JSON.parse(readFileSync(new URL("../shows.json", import.meta.url)));
  for (const show of Object.values(shows).filter((s) => s.tint)) {
    for (const g of LIGHT) assert.ok(contrast(rgb(show.tint.light), rgb(g)) >= 3, show.id);
    for (const g of DARK) assert.ok(contrast(rgb(show.tint.dark), rgb(g)) >= 3, show.id);
  }
});

// OKLCH from and to sRGB (Björn Ottosson's OKLab), to model the CSS washes.
const toLinear = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
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
  ].map((v) => Math.min(255, Math.max(0, fromLinear(v))));
}
// As styles/base.css and show-page.css draw a wash: `share` of the color
// mixed into the paper in sRGB, then set back to the paper's lightness.
const washed = (color, paper, share) => {
  const [, c, h] = oklch(rgb(color).map((v, i) => v * share + rgb(paper)[i] * (1 - share)));
  return fromOklch([oklch(rgb(paper))[0], c, h]);
};

test("hearts keep 3:1 on a page, show sheet or player bar washed in any artwork's color", () => {
  const arts = [];
  for (let h = 0; h < 360; h += 20) {
    for (const [s, l] of [
      [0.9, 0.5],
      [0.6, 0.35],
      [0.8, 0.75],
      [1, 0.15],
    ]) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const [r, g, b] = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
      ][Math.floor(h / 60)];
      arts.push([r, g, b].map((v) => (v + l - c / 2) * 255));
    }
  }
  const shows = JSON.parse(readFileSync(new URL("../shows.json", import.meta.url)));
  const tints = [...arts.map(themeTints), ...Object.values(shows).map((s) => s.tint)].filter(
    Boolean,
  );
  // The Listen page (24% / 22%), a show's sheet (12% / 14%), the player
  // bar (26% / 24%) and a saved song's row (22% / 20%), light / dark.
  const grounds = (w) => ({
    light: [
      washed(w.light, "#faf8f3", 0.24),
      washed(w.light, "#f2efe7", 0.12),
      washed(w.light, "#f2efe7", 0.26),
      washed(w.light, "#faf8f3", 0.22),
    ],
    dark: [
      washed(w.dark, "#202224", 0.22),
      washed(w.dark, "#292c2f", 0.14),
      washed(w.dark, "#292c2f", 0.24),
      washed(w.dark, "#202224", 0.2),
    ],
  });
  for (const wash of tints) {
    const g = grounds(wash);
    for (const heart of tints) {
      for (const ground of g.light) assert.ok(contrast(rgb(heart.light), ground) >= 3, heart.light);
      for (const ground of g.dark) assert.ok(contrast(rgb(heart.dark), ground) >= 3, heart.dark);
    }
  }
});

test("a muted cover still gives its overall tone; a grey one gives none", async () => {
  const { averageTint, pickTint } = await import("../art-tint.js");
  const fill = (rgb, n = 64) =>
    Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4]));
  // Dusky olive: too muted for pickTint, still a tone.
  const olive = fill([92, 96, 78]);
  assert.equal(pickTint(olive), null);
  assert.ok(averageTint(olive));
  assert.equal(averageTint(fill([120, 120, 120])), null);
});
