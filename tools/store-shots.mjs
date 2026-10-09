// Store screenshots: frames raw app screenshots with a one-line caption, at
// the sizes the App Store and Google Play ask for, plus Play's feature
// graphic. Raw shots come from the screens harness (the app at store sizes,
// light theme); this only lays them out.
//
//   node tools/store-shots.mjs <raw dir> <out dir> <ios|android|ipad>
//   node tools/store-shots.mjs - store/android feature
//
// Sizes: iPhone 6.9" 1320×2868 (App Store scales it for smaller iPhones),
// iPad 13" 2064×2752, Android phone 1080×2160 (Play allows up to 2:1).
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [raw, out, kind] = process.argv.slice(2);
const ROOT = new URL("..", import.meta.url);
const font = readFileSync(
  new URL("node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2", ROOT),
).toString("base64");
const SIZES = {
  ios: { width: 1320, height: 2868 },
  ipad: { width: 2064, height: 2752 },
  android: { width: 1080, height: 2160 },
};
// One line each: what the screen is for, in the station's plain voice.
const CAPTIONS = {
  listen: "WXPN, XPN2 and Homegrown, live",
  sheet: "Follow your shows and get a reminder",
  favorites: "Heart a song to keep it",
  videos: "World Cafe sessions to watch",
  concerts: "Concerts around Philadelphia",
  alarm: "Wake up to WXPN",
};
const ORDER = Object.keys(CAPTIONS);

const page = (body, { width, height }) => `<!doctype html><html><head><style>
@font-face { font-family: Figtree; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 300 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
body { background: #faf8f3; color: #211f1c; font-family: Figtree, sans-serif; }
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
mkdirSync(out, { recursive: true });

if (kind === "feature") {
  // Google Play's 1024×500 feature graphic: the wordmark on the station's orange.
  const size = { width: 1024, height: 500 };
  const logo = readFileSync(new URL("brand/wxpn-logo-mono.png", ROOT)).toString("base64");
  const p = await browser.newPage({ viewport: size });
  await p.setContent(
    page(
      `<div style="height:100%;display:flex;align-items:center;gap:56px;padding:0 88px;background:#ef7149;color:#241710">
        <img src="data:image/png;base64,${logo}" style="height:130px;flex-shrink:0;filter:brightness(0) saturate(100%)">
        <div style="font-size:44px;font-weight:700;line-height:1.15;letter-spacing:-0.02em;white-space:nowrap">
          88.5 FM Philadelphia,<br>live and on demand</div></div>`,
      size,
    ),
  );
  await p.screenshot({ path: join(out, "feature-graphic.png") });
} else {
  const size = SIZES[kind];
  const pad = Math.round(size.width * 0.07);
  const files = readdirSync(raw).filter((f) => f.endsWith(".png"));
  let n = 0;
  for (const key of ORDER) {
    const file = files.find((f) => f.includes(`-${key}-`)) || (kind === "ipad" && files[n]);
    if (!file) continue;
    const shot = readFileSync(join(raw, file)).toString("base64");
    const p = await browser.newPage({ viewport: size });
    // The caption across the top; the screen below it, a little smaller,
    // with rounded corners, running off the bottom edge.
    await p.setContent(
      page(
        `<div style="padding:${pad * 1.6}px ${pad}px ${pad}px">
          <h1 style="font-size:${Math.round(size.width * 0.072)}px;font-weight:700;line-height:1.1;letter-spacing:-0.025em;max-width:16ch">${CAPTIONS[key]}</h1></div>
        <img src="data:image/png;base64,${shot}" style="display:block;width:${size.width - pad * 2}px;margin:0 auto;border-radius:${Math.round(size.width * 0.05)}px;box-shadow:0 0 0 2px rgb(33 31 28 / 0.08)">`,
        size,
      ),
    );
    n += 1;
    await p.screenshot({
      path: join(out, `${String(n).padStart(2, "0")}-${key}.jpg`),
      type: "jpeg",
      quality: 90,
    });
    await p.close();
    if (kind === "ipad") break; // one iPad screen for now: Listen
  }
}
await browser.close();
