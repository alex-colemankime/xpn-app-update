// Draws the lock screens on the screens page (design/screens): an iPhone and
// an Android phone, light and dark, each with WXPN playing, the radio alarm
// going off and the station's notifications, at the same moments as the
// app's own shots (tools/capture-screens.mjs). They are drawings of the
// systems' own lock screens, not screenshots: the app can't capture those.
// Writes PNGs to SCREENS_OUT (screens-out/); they go into
// design/screens/img as WebP. Nothing here ships in the app.
//
//   node tools/lock-screens.mjs
//
// Needs Playwright's Chromium and the Inter font installed. The song's
// artwork comes from Apple's catalog, as the app's shots' does.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const OUT = process.env.SCREENS_OUT || "screens-out";
await mkdir(OUT, { recursive: true });

// The moments, as in capture-screens.mjs: the song on the air on Tuesday
// afternoon; the alarm Wednesday at 7; the Free at Noon video's
// notification (samples.js) Friday just before noon, under the member
// drive's from that morning.
const SONG = { title: "Motion Sickness", artist: "Phoebe Bridgers" };
const PLAYING = { long: "Tuesday, October 20", short: "Tue, Oct 20", time: "2:42" };
const ALARM = { long: "Wednesday, October 21", short: "Wed, Oct 21", time: "7:00" };
const ALERTS = { long: "Friday, October 23", short: "Fri, Oct 23", time: "11:50" };
const NOTICES = {
  alarm: [{ title: "Radio alarm", text: "Good morning. Tap to wake up to WXPN.", ago: "now" }],
  alerts: [
    {
      title: "Free at Noon: Sam & Louise Sullivan",
      text: "The live video starts in 10 minutes. Tap to watch.",
      ago: "now",
    },
    {
      title: "One week left in the Fall Member Drive",
      text: "Keep WXPN listener-supported. Tap to donate.",
      ago: "4h ago",
      short: "4h",
    },
  ],
};

async function artwork() {
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
const ICON = `data:image/png;base64,${(
  await readFile(new URL("../public/icons/icon-192.png", import.meta.url))
).toString("base64")}`;

// Glyphs, drawn in currentColor.
const svg = (body, size = 24, extra = "") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
const G = {
  lock: `<svg width="17" height="20" viewBox="0 0 17 20"><rect x="1" y="8" width="15" height="12" rx="3" fill="currentColor"/><path d="M4 9V5.5a4.5 4.5 0 0 1 9 0V9" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>`,
  lockLine: svg(
    `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
    34,
  ),
  torch: svg(`<path d="M7 3h10v4l-2 3v11H9V10L7 7z"/><path d="M7 7h10"/><path d="M12 13v2"/>`, 30),
  camera: svg(
    `<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>`,
    30,
  ),
  phone: svg(
    `<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2"/>`,
    30,
  ),
  chev: svg(`<path d="m6 9 6 6 6-6"/>`, 22),
  airplay: svg(
    `<circle cx="12" cy="11" r="2"/><path d="M8.5 15a5 5 0 1 1 7 0"/><path d="M6 18a8.5 8.5 0 1 1 12 0"/>`,
    30,
  ),
  speaker: svg(
    `<rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M12 6h.01"/>`,
    22,
  ),
  pause: `<svg width="30" height="38" viewBox="0 0 22 28"><rect x="1" y="0" width="7" height="28" rx="1.5" fill="currentColor"/><rect x="14" y="0" width="7" height="28" rx="1.5" fill="currentColor"/></svg>`,
  skip: (flip) =>
    `<svg width="44" height="24" viewBox="0 0 31 17" ${flip ? 'style="transform:scaleX(-1)"' : ""}><path d="M15 0v17L0 8.5zM31 0v17L16 8.5z" fill="currentColor"/></svg>`,
  status: `<svg width="78" height="16" viewBox="0 0 75 15"><g fill="currentColor"><rect x="0" y="9" width="3" height="5" rx=".8"/><rect x="5" y="6.5" width="3" height="7.5" rx=".8"/><rect x="10" y="4" width="3" height="10" rx=".8"/><rect x="15" y="1.5" width="3" height="12.5" rx=".8"/><path d="M33 13.5l-2.2-2.6a3.4 3.4 0 0 1 4.4 0zM27.8 7.6a8 8 0 0 1 10.4 0l-1.6 1.9a5.6 5.6 0 0 0-7.2 0zM24.8 4.3a12.5 12.5 0 0 1 16.4 0l-1.6 1.9a10 10 0 0 0-13.2 0z"/><rect x="47" y="2" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.1"/><rect x="49" y="4" width="16.5" height="7" rx="1.8"/><path d="M70.5 6v3.2a1.7 1.7 0 0 0 0-3.2z" fill-opacity=".45"/></g></svg>`,
};

const THEMES = {
  ios: {
    light: {
      wall: "linear-gradient(160deg,#fde8da 0%,#f3ebe4 35%,#efd5c8 75%,#f2c4ad 100%)",
      ink: "#1e1c1a",
      soft: "#6c655f",
      card: "rgba(255,250,245,.72)",
      round: "rgba(255,245,238,.75)",
    },
    dark: {
      wall: "radial-gradient(120% 60% at 90% 95%,#8a3a20 0%,transparent 60%),linear-gradient(180deg,#3a2c55 0%,#241b33 45%,#2a1d2a 100%)",
      ink: "#ffffff",
      soft: "rgba(255,255,255,.62)",
      card: "rgba(40,32,52,.72)",
      round: "rgba(30,24,36,.7)",
    },
  },
  android: {
    light: {
      wall: "linear-gradient(180deg,#eef1ee 0%,#e4ebe7 100%)",
      ink: "#1b1d1c",
      soft: "#5c625f",
      card: "#f6f3ec",
      round: "#f6f3ec",
    },
    dark: {
      wall: "radial-gradient(90% 40% at 70% 0%,#2f4544 0%,transparent 70%),linear-gradient(180deg,#1c2624 0%,#191e1d 100%)",
      ink: "#f2f2f0",
      soft: "#a6aba9",
      card: "#262b2a",
      round: "#2a2f2e",
    },
  },
};

const BASE_CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:390px;height:844px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.abs{position:absolute}
`;

function ios(theme, kind) {
  const t = THEMES.ios[theme];
  const when = kind === "player" ? PLAYING : kind === "alarm" ? ALARM : ALERTS;
  const notice = (n) => `
    <div style="display:flex;gap:12px;padding:13px 14px;border-radius:22px;background:${t.card};backdrop-filter:blur(20px);margin-bottom:8px">
      <img src="${ICON}" style="width:38px;height:38px;border-radius:9px;flex:none">
      <div style="flex:1;min-width:0;font-size:15px;line-height:1.35;color:${t.ink}">
        <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-weight:600">${n.title}</b><span style="color:${t.soft};font-size:13px;flex:none">${n.ago}</span></div>
        <div>${n.text}</div>
      </div>
    </div>`;
  const player = `
    <div class="abs" style="left:14px;right:14px;top:300px;border-radius:30px;background:${t.card};padding:16px 18px 18px;color:${t.ink}">
      <div style="display:flex;align-items:center;gap:13px">
        <img src="${ART}" style="width:54px;height:54px;border-radius:8px">
        <div style="flex:1"><div style="font-size:16px;font-weight:600">${SONG.title}</div><div style="font-size:16px;color:${t.soft}">${SONG.artist}</div></div>
        <span style="color:${t.soft}">${G.airplay}</span>
      </div>
      <div style="display:flex;justify-content:space-around;align-items:center;margin:20px 0 18px">
        <span style="color:${t.soft};opacity:.55">${G.skip(false)}</span>
        <span>${G.pause}</span>
        <span style="color:${t.soft};opacity:.55">${G.skip(true)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;color:${t.soft};font-size:11px">◂<div style="flex:1;height:5px;border-radius:3px;background:${theme === "dark" ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.15)"}"><div style="width:65%;height:100%;border-radius:3px;background:${t.ink}"></div></div>◂))</div>
    </div>`;
  const content =
    kind === "player"
      ? player
      : `<div class="abs" style="left:6px;right:6px;bottom:${kind === "alarm" ? 226 : 188}px">${NOTICES[kind].map(notice).join("")}</div>`;
  return `
  <body style="background:${t.wall};color:${t.ink}">
    <div class="abs" style="left:133px;top:11px;width:124px;height:36px;border-radius:20px;background:#000"></div>
    <div class="abs" style="right:30px;top:22px">${G.status}</div>
    <div class="abs" style="left:0;right:0;top:60px;text-align:center">${G.lock}</div>
    <div class="abs" style="left:0;right:0;top:94px;text-align:center;font-size:20px;font-weight:600">${when.long}</div>
    <div class="abs" style="left:0;right:0;top:112px;text-align:center;font-size:96px;font-weight:700;letter-spacing:-2px;font-family:'Inter Display',Inter">${when.time}</div>
    ${content}
    <div class="abs" style="left:46px;bottom:52px;width:50px;height:50px;border-radius:50%;background:${t.round};display:grid;place-items:center">${G.torch}</div>
    <div class="abs" style="right:46px;bottom:52px;width:50px;height:50px;border-radius:50%;background:${t.round};display:grid;place-items:center">${G.camera}</div>
    <div class="abs" style="left:128px;bottom:9px;width:134px;height:5px;border-radius:3px;background:${t.ink}"></div>
  </body>`;
}

function android(theme, kind) {
  const t = THEMES.android[theme];
  const when = kind === "player" ? PLAYING : kind === "alarm" ? ALARM : ALERTS;
  const badge = (size) =>
    `<span style="width:${size}px;height:${size}px;border-radius:50%;background:#ef7149;color:#241710;display:grid;place-items:center;font-weight:800;font-size:${size * 0.36}px;letter-spacing:-.5px;flex:none">xpn</span>`;
  const notice = (n) => `
    <div style="display:flex;gap:14px;padding:16px;border-radius:24px;background:${t.card};margin-bottom:10px;color:${t.ink}">
      ${badge(40)}
      <div style="flex:1;font-size:15px;line-height:1.4">
        <div style="color:${t.soft};font-size:14px">WXPN · ${n.short || n.ago}</div>
        <div style="font-weight:600;font-size:17px">${n.title}</div>
        <div style="color:${t.soft}">${n.text}</div>
      </div>
      <span style="color:${t.soft}">${G.chev}</span>
    </div>`;
  const player = `
    <div class="abs" style="left:14px;right:14px;top:200px;height:186px;border-radius:30px;overflow:hidden;color:#fff">
      <img src="${ART}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.9)">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55))"></div>
      <div style="position:absolute;left:18px;top:18px">${badge(26)}</div>
      <div style="position:absolute;right:16px;top:16px;display:flex;gap:6px;align-items:center;padding:6px 12px;border-radius:16px;background:rgba(255,255,255,.2);font-size:13px">${G.speaker}This phone</div>
      <div style="position:absolute;left:18px;bottom:22px;right:120px"><div style="font-size:19px;font-weight:600">${SONG.title}</div><div style="font-size:15px;opacity:.85">${SONG.artist}</div></div>
      <div style="position:absolute;right:16px;bottom:18px;width:64px;height:64px;border-radius:22px;background:#ef7149;color:#241710;display:grid;place-items:center"><span style="transform:scale(.7);display:block;line-height:0">${G.pause}</span></div>
    </div>`;
  const content =
    kind === "player"
      ? player
      : `<div class="abs" style="left:8px;right:8px;top:200px">${NOTICES[kind].map(notice).join("")}</div>`;
  return `
  <body style="background:${t.wall};color:${t.ink}">
    <div class="abs" style="left:183px;top:13px;width:24px;height:24px;border-radius:50%;background:#000"></div>
    <div class="abs" style="right:22px;top:17px">${G.status}</div>
    <div class="abs" style="left:26px;top:66px;font-size:72px;font-weight:400;letter-spacing:-1px">${when.time}</div>
    <div class="abs" style="left:28px;top:150px;font-size:18px;color:${t.soft}">${when.short}</div>
    ${content}
    <div class="abs" style="left:0;right:0;bottom:110px;text-align:center;color:${t.soft};font-size:15px"><div style="color:${t.ink};line-height:0;margin-bottom:12px">${G.lockLine}</div>Swipe up to open</div>
    <div class="abs" style="left:28px;bottom:42px;width:58px;height:58px;border-radius:50%;background:${t.round};display:grid;place-items:center">${G.phone}</div>
    <div class="abs" style="right:28px;bottom:42px;width:58px;height:58px;border-radius:50%;background:${t.round};display:grid;place-items:center">${G.camera}</div>
    <div class="abs" style="left:141px;bottom:10px;width:108px;height:4px;border-radius:2px;background:${t.ink};opacity:.7"></div>
  </body>`;
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [system, draw] of [
  ["ios", ios],
  ["android", android],
]) {
  for (const kind of ["player", "alarm", "alerts"]) {
    for (const theme of ["light", "dark"]) {
      await page.setContent(`<!doctype html><style>${BASE_CSS}</style>${draw(theme, kind)}`);
      await page.evaluate(() => globalThis.document.fonts.ready);
      const file = `${OUT}/lock-${system}-${kind}-${theme}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
  }
}
await browser.close();
