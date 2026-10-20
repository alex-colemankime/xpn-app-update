// Draws the home screen widget on the screens page (design/screens): an
// iPhone's home screen with the medium and small widgets, and an Android
// phone's with the 4 by 2 block, light and dark, Motion Sickness on WXPN
// during World Cafe, as in the app's own shots. They are drawings of the
// widgets as WXPNWidget.swift and res/layout/wxpn_widget.xml lay them out,
// in the app's colors, on plain home screens (the other icons are blank
// tiles). Writes PNGs to SCREENS_OUT (screens-out/); they go into
// design/screens/img as WebP. Nothing here ships in the app.
//
//   node tools/widget-screens.mjs
//
// Needs Playwright's Chromium and the Inter font. The artwork comes from
// SCREENS_ART when set, else from Apple's catalog, as the lock screens' does.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const OUT = process.env.SCREENS_OUT || "screens-out";
await mkdir(OUT, { recursive: true });

const NOW = {
  station: "WXPN",
  detail: "88.5 FM · Public Radio",
  title: "Motion Sickness",
  artist: "Phoebe Bridgers",
  show: "World Cafe",
};
const SONG = { title: NOW.title, artist: NOW.artist };

// From SCREENS_ART (a folder of <title slug>.jpg, as for capture-screens.mjs),
// else Apple's catalog.
async function artwork() {
  if (process.env.SCREENS_ART) {
    const file = await readFile(`${process.env.SCREENS_ART}/motion-sickness.jpg`).catch(() => null);
    if (file) return `data:image/jpeg;base64,${file.toString("base64")}`;
  }
  const term = encodeURIComponent(`${SONG.artist} ${SONG.title}`);
  const response = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=song&limit=10&country=US`,
  );
  const { results = [] } = await response.json();
  const hit = results.find((r) => r.artistName === SONG.artist) || results[0];
  const image = await fetch(hit.artworkUrl100.replace("100x100bb", "600x600bb"));
  return `data:image/jpeg;base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
}
const ART = await artwork();

// The widget's colors, as in both widgets' code (the app's, styles/base.css).
const C = {
  light: { surface: "#ffffff", ink: "#111111", muted: "#5c5c59", fill: "#f4d8ce", key: "#983012" },
  dark: { surface: "#1d1d1d", ink: "#f0f0ed", muted: "#a2a29f", fill: "#4b2a20", key: "#ffa585" },
};
const WALL = {
  ios: {
    light: "linear-gradient(160deg,#fde8da 0%,#f3ebe4 35%,#efd5c8 75%,#f2c4ad 100%)",
    dark: "radial-gradient(120% 60% at 90% 95%,#8a3a20 0%,transparent 60%),linear-gradient(180deg,#3a2c55 0%,#241b33 45%,#2a1d2a 100%)",
  },
  android: {
    light: "linear-gradient(180deg,#eef1ee 0%,#e4ebe7 100%)",
    dark: "radial-gradient(90% 40% at 70% 0%,#2f4544 0%,transparent 70%),linear-gradient(180deg,#1c2624 0%,#191e1d 100%)",
  },
};
const TILE = { light: "rgba(255,255,255,.55)", dark: "rgba(255,255,255,.12)" };
const pause = (color) =>
  `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="${color}" d="M7 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></svg>`;

const stream = (c) =>
  `<div style="display:flex;gap:6px;align-items:baseline;white-space:nowrap;overflow:hidden"><b style="font-size:13px;color:${c.ink}">${NOW.station}</b><span style="font-size:12px;color:${c.muted};overflow:hidden;text-overflow:ellipsis">${NOW.detail}</span></div>`;
const song = (c, size = 17) =>
  `<div><div style="font-size:${size}px;font-weight:700;color:${c.ink};line-height:1.2">${NOW.title}</div><div style="font-size:14px;color:${c.muted};margin-top:2px">${NOW.artist}</div></div>`;
const key = (c, radius = 12, side = 44) =>
  `<div style="width:${side}px;height:${side}px;border-radius:${radius}px;background:${c.fill};display:grid;place-items:center;flex:none">${pause(c.key)}</div>`;

// The block: artwork beside the stream, the song, the show and play.
const block = (c, { height, radius, pad, art }) => `
  <div style="height:${height}px;border-radius:${radius}px;background:${c.surface};padding:${pad}px;display:flex;gap:14px;box-shadow:0 8px 24px rgb(0 0 0 / .12)">
    <img src="${ART}" style="height:100%;aspect-ratio:1;object-fit:cover;border-radius:${art}px;flex:none">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between">
      ${stream(c)}
      ${song(c)}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:12px;color:${c.muted}">${NOW.show}</span>${key(c, radius === 22 ? 12 : 14, radius === 22 ? 44 : 48)}
      </div>
    </div>
  </div>`;

const tiles = (theme, n, size, gap, radius) =>
  `<div style="display:grid;grid-template-columns:repeat(4,${size}px);gap:${gap}px;justify-content:space-between">${Array.from(
    { length: n },
    () =>
      `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${TILE[theme]}"></div>`,
  ).join("")}</div>`;

function ios(theme) {
  const c = C[theme];
  const ink = theme === "dark" ? "#fff" : "#1e1c1a";
  const small = `
    <div style="width:158px;height:158px;border-radius:22px;background:${c.surface};padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgb(0 0 0 / .12)">
      <img src="${ART}" style="flex:1;min-height:0;width:100%;object-fit:cover;border-radius:12px">
      <div style="line-height:1.25;white-space:nowrap;overflow:hidden"><b style="font-size:13px;color:${c.ink}">${NOW.station}</b><div style="font-size:12px;color:${c.muted}">${NOW.title}</div></div>
    </div>`;
  return `
    <div style="position:absolute;inset:0;background:${WALL.ios[theme]}"></div>
    <div style="position:absolute;top:18px;left:44px;font:600 17px Inter;color:${ink}">2:42</div>
    <div style="position:absolute;top:11px;left:50%;translate:-50% 0;width:124px;height:36px;border-radius:20px;background:#000"></div>
    <div style="position:absolute;top:70px;left:24px;right:24px;display:grid;gap:22px">
      ${block(c, { height: 158, radius: 22, pad: 16, art: 14 })}
      <div style="display:flex;gap:26px;align-items:start">
        ${small}
        <div style="display:grid;grid-template-columns:repeat(2,64px);gap:26px 30px">${Array.from(
          { length: 4 },
          () =>
            `<div style="width:64px;height:64px;border-radius:15px;background:${TILE[theme]}"></div>`,
        ).join("")}</div>
      </div>
      ${tiles(theme, 8, 64, 26, 15)}
    </div>
    <div style="position:absolute;bottom:20px;left:18px;right:18px;height:92px;border-radius:32px;background:${TILE[theme]};display:flex;justify-content:space-around;align-items:center">${Array.from(
      { length: 4 },
      () =>
        `<div style="width:62px;height:62px;border-radius:15px;background:${TILE[theme]}"></div>`,
    ).join("")}</div>`;
}

function android(theme) {
  const c = C[theme];
  const ink = theme === "dark" ? "#f2f2f0" : "#1b1d1c";
  return `
    <div style="position:absolute;inset:0;background:${WALL.android[theme]}"></div>
    <div style="position:absolute;top:14px;left:24px;font:500 15px Inter;color:${ink}">2:42</div>
    <div style="position:absolute;top:58px;left:16px;right:16px;font:400 46px Inter;color:${ink};letter-spacing:-1px">Tue, Oct 20</div>
    <div style="position:absolute;top:150px;left:16px;right:16px;display:grid;gap:28px">
      ${block(c, { height: 176, radius: 24, pad: 12, art: 14 })}
      ${tiles(theme, 8, 60, 28, 30)}
    </div>
    <div style="position:absolute;bottom:96px;left:16px;right:16px;height:56px;border-radius:28px;background:${TILE[theme]}"></div>
    <div style="position:absolute;bottom:22px;left:16px;right:16px">${tiles(theme, 4, 60, 0, 30)}</div>`;
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [name, draw] of Object.entries({ ios, android })) {
  for (const theme of ["light", "dark"]) {
    await page.setContent(
      `<!doctype html><style>*{box-sizing:border-box;margin:0}html,body{width:390px;height:844px;overflow:hidden}body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}</style><body>${draw(theme)}</body>`,
    );
    await page.waitForLoadState("networkidle");
    const path = `${OUT}/widget-${name}-${theme}.png`;
    await page.screenshot({ path });
    console.log(path);
  }
}
await browser.close();
