// Draws the car screens on the screens page (design/screens): CarPlay's
// station list and Now Playing, and Android Auto's Now Playing, with
// Motion Sickness on WXPN as in the app's own shots. The cars draw these
// themselves from what the app gives them (CarPlaySceneDelegate.swift,
// WxpnCarService.kt): the stations with their tiles (tools/car-art.mjs), and
// the song, artist and artwork. These are drawings of those templates, not
// screenshots. Writes PNGs to SCREENS_OUT (screens-out/); they go into
// design/screens/img as WebP.
//
//   node tools/car-screens.mjs
//
// Needs Playwright's Chromium and the Inter font. The artwork comes from
// SCREENS_ART when set (motion-sickness.jpg), else Apple's catalog.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const OUT = process.env.SCREENS_OUT || "screens-out";
await mkdir(OUT, { recursive: true });
const W = 800;
const H = 480;

const data = async (path, type) =>
  `data:${type};base64,${(await readFile(new URL(path, import.meta.url))).toString("base64")}`;
const TILES = {
  xpn: await data("../android/app/src/main/res/drawable-nodpi/car_xpn.png", "image/png"),
  xpn2: await data("../android/app/src/main/res/drawable-nodpi/car_xpn2.png", "image/png"),
  homegrown: await data(
    "../android/app/src/main/res/drawable-nodpi/car_homegrown.png",
    "image/png",
  ),
};

async function artwork() {
  if (process.env.SCREENS_ART) {
    const file = await readFile(`${process.env.SCREENS_ART}/motion-sickness.jpg`).catch(() => null);
    if (file) return `data:image/jpeg;base64,${file.toString("base64")}`;
  }
  const response = await fetch(
    "https://itunes.apple.com/search?term=Phoebe%20Bridgers%20Motion%20Sickness&entity=song&limit=10&country=US",
  );
  const { results = [] } = await response.json();
  const hit = results.find((r) => r.artistName === "Phoebe Bridgers") || results[0];
  const image = await fetch(hit.artworkUrl100.replace("100x100bb", "600x600bb"));
  return `data:image/jpeg;base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
}
const ART = await artwork();

const STATIONS = [
  ["xpn", "WXPN", "88.5 FM · Public Radio"],
  ["xpn2", "XPN2", "XPoNential Radio"],
  ["homegrown", "Homegrown", "Philadelphia's local music"],
];
const bars = `<svg width="18" height="14" viewBox="0 0 18 14"><g fill="#4aa3ff"><rect x="0" y="5" width="3" height="9" rx="1"/><rect x="5" y="0" width="3" height="14" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="7" width="3" height="7" rx="1"/></g></svg>`;

// CarPlay's dock down the left: the time, the app and the system's icons.
const dock = (active) => `
  <div style="position:absolute;inset:0 auto 0 0;width:78px;background:#1c1c1e;display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:14px">
    <div style="font:600 15px Inter;color:#fff">2:42</div>
    ${["#3a3a3c", active, "#3a3a3c", "#3a3a3c"]
      .map(
        (bg, i) =>
          `<div style="width:48px;height:48px;border-radius:12px;background:${bg};${i === 1 ? "overflow:hidden" : ""}">${i === 1 ? `<img src="${TILES.xpn}" style="width:100%;height:100%">` : ""}</div>`,
      )
      .join("")}
  </div>`;

const carplayList = () => `
  <div style="position:absolute;inset:0;background:#000">${dock("#ef7149")}
    <div style="position:absolute;inset:0 0 0 78px;padding:16px 26px;color:#fff">
      <div style="font:700 22px Inter;text-align:center;margin-bottom:14px">WXPN</div>
      ${STATIONS.map(
        ([id, name, line], i) => `
        <div style="display:flex;align-items:center;gap:16px;padding:12px 14px;border-radius:12px;background:${i === 0 ? "#2c2c2e" : "transparent"}">
          <img src="${TILES[id]}" style="width:64px;height:64px;border-radius:8px">
          <div style="flex:1"><div style="font:600 21px Inter">${name}</div><div style="font:400 16px Inter;color:#98989f;margin-top:3px">${line}</div></div>
          ${i === 0 ? bars : ""}
        </div>`,
      ).join("")}
    </div>
  </div>`;

const carplayNowPlaying = () => `
  <div style="position:absolute;inset:0;background:#000">${dock("#ef7149")}
    <div style="position:absolute;inset:0 0 0 78px;padding:22px 34px;color:#fff;display:flex;gap:34px;align-items:center">
      <img src="${ART}" style="width:300px;height:300px;border-radius:10px;object-fit:cover">
      <div style="flex:1">
        <div style="font:700 28px Inter">Motion Sickness</div>
        <div style="font:400 20px Inter;color:#98989f;margin-top:6px">Phoebe Bridgers · WXPN</div>
        <div style="display:inline-block;margin-top:22px;padding:3px 8px;border-radius:5px;background:#3a3a3c;font:700 12px Inter;letter-spacing:.06em;color:#fff">LIVE</div>
        <div style="display:flex;justify-content:center;gap:56px;margin-top:40px;align-items:center">
          <svg width="40" height="22" viewBox="0 0 31 17" style="opacity:.3"><path d="M15 0v17L0 8.5zM31 0v17L16 8.5z" fill="#fff"/></svg>
          <svg width="34" height="44" viewBox="0 0 22 28"><rect x="1" width="7" height="28" rx="1.5" fill="#fff"/><rect x="14" width="7" height="28" rx="1.5" fill="#fff"/></svg>
          <svg width="40" height="22" viewBox="0 0 31 17" style="transform:scaleX(-1);opacity:.3"><path d="M15 0v17L0 8.5zM31 0v17L16 8.5z" fill="#fff"/></svg>
        </div>
      </div>
    </div>
  </div>`;

const autoNowPlaying = () => `
  <div style="position:absolute;inset:0;background:#202124;color:#e8eaed">
    <div style="position:absolute;inset:0 auto 0 0;width:84px;background:#171717;display:flex;flex-direction:column;align-items:center;gap:22px;padding-top:18px">
      <div style="font:500 15px Inter">2:42</div>
      ${[0, 1, 2]
        .map(
          (i) =>
            `<div style="width:46px;height:46px;border-radius:50%;background:#3c4043;${i === 1 ? "outline:2px solid #8ab4f8" : ""}"></div>`,
        )
        .join("")}
    </div>
    <div style="position:absolute;inset:0 0 0 84px;padding:26px 36px;display:flex;gap:32px;align-items:center">
      <img src="${ART}" style="width:290px;height:290px;border-radius:16px;object-fit:cover">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:10px;font:500 15px Inter;color:#9aa0a6"><img src="${TILES.xpn}" style="width:24px;height:24px;border-radius:5px">WXPN</div>
        <div style="font:500 28px Inter;margin-top:16px">Motion Sickness</div>
        <div style="font:400 19px Inter;color:#9aa0a6;margin-top:6px">Phoebe Bridgers · WXPN</div>
        <div style="margin-top:46px;width:76px;height:76px;border-radius:50%;background:#8ab4f8;display:grid;place-items:center">
          <svg width="26" height="32" viewBox="0 0 22 28"><rect x="1" width="7" height="28" rx="1.5" fill="#202124"/><rect x="14" width="7" height="28" rx="1.5" fill="#202124"/></svg>
        </div>
      </div>
    </div>
  </div>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (const [name, draw] of Object.entries({
  "car-carplay-list": carplayList,
  "car-carplay-playing": carplayNowPlaying,
  "car-auto-playing": autoNowPlaying,
})) {
  await page.setContent(
    `<!doctype html><style>*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;overflow:hidden}body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}</style><body>${draw()}</body>`,
  );
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  console.log(path);
}
await browser.close();
