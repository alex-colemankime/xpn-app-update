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
  assert.equal(themeTints(null), null);
});

test("hearts keep 3:1 contrast in both themes, even for pale or dark art", () => {
  const LIGHT = ["#faf6ee", "#f3eee3", "#efe9dd"];
  const DARK = ["#161719", "#202123", "#202223"];
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
