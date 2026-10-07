import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrast, pickTint, themeTints } from "../art-tint.js";

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
  // The app's backgrounds (styles/base.css): page, surface, alternate row, player.
  const LIGHT = ["#faf8f3", "#f2efe7", "#eeeae1", "#fffdf8"];
  const DARK = ["#202224", "#292c2f", "#2b2e30", "#32363a"];
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
