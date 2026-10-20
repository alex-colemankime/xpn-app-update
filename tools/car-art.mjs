// Draws the stations' tiles for the car screens (CarPlay's list, Android
// Auto's list and Now Playing before a song's artwork arrives): each
// station's lettering on the station's orange, as the app's own tile on
// Listen (styles/listen.css, .station-art), the w of wxpn lighter as in the
// logo. Writes them into the iOS asset catalog (car-<id>.imageset) and
// Android's res/drawable-nodpi (car_<id>.png).
//
//   node tools/car-art.mjs
//
// Needs Playwright's Chromium and the Inter font.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const STATIONS = [
  { id: "xpn", mark: "wxpn" },
  { id: "xpn2", mark: "xpn2" },
  { id: "homegrown", mark: "homegrown" },
];
const SIDE = 360;
const IOS = new URL("../ios/App/App/Assets.xcassets/", import.meta.url);
const ANDROID = new URL("../android/app/src/main/res/drawable-nodpi/", import.meta.url);

const lettering = (mark) =>
  /^w(?=xpn)/.test(mark) ? `<span style="color:#fcd9c6">w</span>${mark.slice(1)}` : mark;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: SIDE, height: SIDE } });
await mkdir(ANDROID, { recursive: true });
for (const { id, mark } of STATIONS) {
  // Long names get smaller type, so every name fits with the same margin.
  const size = Math.min(110, Math.floor((SIDE * 0.8) / (mark.length * 0.52)));
  await page.setContent(
    `<!doctype html><body style="margin:0;width:${SIDE}px;height:${SIDE}px;display:grid;place-items:center;background:#ef7149;color:#241710;font:800 ${size}px Inter,system-ui,sans-serif;letter-spacing:-0.08em"><div>${lettering(mark)}</div></body>`,
  );
  const png = await page.screenshot();
  const set = new URL(`car-${id}.imageset/`, IOS);
  await mkdir(set, { recursive: true });
  await writeFile(new URL(`car-${id}.png`, set), png);
  await writeFile(
    new URL("Contents.json", set),
    `${JSON.stringify(
      {
        images: [{ filename: `car-${id}.png`, idiom: "universal" }],
        info: { author: "xcode", version: 1 },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(new URL(`car_${id}.png`, ANDROID), png);
  console.log(id);
}
await browser.close();
