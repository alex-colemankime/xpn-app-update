// Bundles each show's artwork with the app: downloads every image shows.json
// still points at on xpn.org, saves a 600px copy in public/shows/<id>, and
// points the show at it. Bundled art loads offline and without a request to
// another site, and art-tint.js can read its colors (a cross-site image
// without CORS headers can't be read).
//
// Run by .github/workflows/fetch-assets.yml (it needs `sharp`, installed
// there for this step only). Locally: npm i --no-save sharp && node tools/fetch-show-art.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SHOWS_FILE = new URL("../shows.json", import.meta.url);
const OUT = new URL("../public/shows/", import.meta.url);
const SIZE = 600;

const shows = JSON.parse(await readFile(SHOWS_FILE, "utf8"));
let changed = 0;
for (const [id, show] of Object.entries(shows)) {
  if (!/^https?:/.test(show.img || "")) continue;
  try {
    const response = await fetch(show.img, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const image = sharp(Buffer.from(await response.arrayBuffer())).resize(SIZE, SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    });
    // Logos drawn on a transparent ground stay PNG; everything else, PNGs
    // that are opaque throughout included, is JPEG.
    const { isOpaque } = await image.stats();
    const ext = isOpaque ? "jpg" : "png";
    const data = !isOpaque
      ? await image.png({ compressionLevel: 9 }).toBuffer()
      : await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    await writeFile(new URL(`${id}.${ext}`, OUT), data);
    show.img = `shows/${id}.${ext}`;
    changed++;
    console.log(`${id}: ${ext}, ${Math.round(data.length / 1024)} KB`);
  } catch (error) {
    // Left pointing at xpn.org, which still works where the site is reachable.
    console.warn(`${id}: kept ${show.img} (${error.message})`);
  }
}
if (changed) await writeFile(SHOWS_FILE, `${JSON.stringify(shows, null, 2)}\n`);
console.log(`${changed} images bundled`);
