import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GROUNDS, contrast, pickTint, themeTints, washed } from "../art-tint.js";

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

// As styles/base.css and show-page.css draw a wash (art-tint.js, washed).
const washedRgb = (color, paper, share) => rgb(washed(color, paper, share));

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
      washedRgb(w.light, "#f7f3ea", 0.24),
      washedRgb(w.light, "#efeadf", 0.12),
      washedRgb(w.light, "#efeadf", 0.26),
      washedRgb(w.light, "#f7f3ea", 0.22),
    ],
    dark: [
      washedRgb(w.dark, "#202224", 0.22),
      washedRgb(w.dark, "#292c2f", 0.14),
      washedRgb(w.dark, "#292c2f", 0.24),
      washedRgb(w.dark, "#202224", 0.2),
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
