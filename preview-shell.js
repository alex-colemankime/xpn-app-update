// The device preview, for the shared GitHub Pages link only (see README,
// VITE_DEVICE_PREVIEW). On a computer the link opens the app inside a phone,
// tablet or laptop frame, switched with three buttons. The app runs in an
// iframe at that size, so its own layout rules decide what each size shows;
// switching only resizes the frame, so the screen, scroll position and any
// audio carry on. The choice is kept in the address (?device=tablet#/shows),
// so a link can open a given size and screen.
import "./preview-shell.css";

const BASE = import.meta.env?.BASE_URL ?? "/";

const DEVICES = {
  phone: { label: "Phone", width: 390, height: 844, note: "390 × 844" },
  tablet: { label: "Tablet", width: 820, height: 1180, note: "820 × 1180" },
  laptop: { label: "Laptop", width: 1440, height: 900, note: "1440 × 900" },
};
// What each frame adds around the screen: bezel, or a browser window's bar.
const CHROME = {
  phone: { x: 12, top: 12, bottom: 12 },
  tablet: { x: 16, top: 16, bottom: 16 },
  laptop: { x: 1, top: 37, bottom: 1 },
};

const svg = (body, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  tablet: svg('<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  laptop: svg('<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>'),
  rotate: svg(
    '<rect x="4" y="9" width="11" height="12" rx="2"/><path d="M13 3a7 7 0 0 1 7 7"/><path d="m17.5 9.5 2.5.5.5-2.5"/>',
  ),
  open: svg('<path d="M7 17 17 7M8 7h9v9"/>', 16),
  grid: svg(
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  ),
};

function readChoice() {
  const asked = new URLSearchParams(window.location.search).get("device");
  if (DEVICES[asked]) return asked;
  try {
    const saved = window.localStorage.getItem("xpn.preview.device");
    if (DEVICES[saved]) return saved;
  } catch {
    /* storage unavailable: the default */
  }
  return "phone";
}

// The shell follows the app's theme: the listener's choice in the app's
// Settings, else the system's.
function applyTheme() {
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem("xpn.appearance"));
  } catch {
    /* ignore */
  }
  const dark =
    saved === "dark" ||
    (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function mountDevicePreview(root, { build = "" } = {}) {
  document.documentElement.classList.add("device-preview");
  document.title = "WXPN app preview";
  applyTheme();
  window.addEventListener("storage", (e) => e.key === "xpn.appearance" && applyTheme());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());

  let device = readChoice();
  let landscape = new URLSearchParams(window.location.search).get("orientation") === "landscape";

  root.innerHTML = `
    <div class="dp">
      <header class="dp-bar">
        <div class="dp-brand">
          <span class="dp-mark" aria-hidden="true"><span class="w">w</span>xpn<span class="dot">.</span></span>
          <span class="dp-title">App preview</span>
        </div>
        <div class="dp-switch" role="group" aria-label="Screen size">
          ${Object.entries(DEVICES)
            .map(
              ([id, d]) =>
                `<button type="button" data-device="${id}">${ICONS[id]}<span>${d.label}</span></button>`,
            )
            .join("")}
        </div>
        <div class="dp-tools">
          <button type="button" class="dp-tool dp-rotate" aria-pressed="false" aria-label="Landscape tablet">
            ${ICONS.rotate}<span>Rotate</span>
          </button>
          <a class="dp-tool" href="${BASE}screens/" aria-label="All screens">
            ${ICONS.grid}<span>All screens</span>
          </a>
          <a class="dp-tool dp-open" target="_blank" rel="noopener">
            Full window ${ICONS.open}
          </a>
        </div>
      </header>
      <main class="dp-stage">
        <div class="dp-device">
          <div class="dp-scaler">
            <div class="dp-frame">
              <div class="dp-window-bar" aria-hidden="true"><i></i><i></i><i></i><span>WXPN — Listen live</span></div>
              <iframe title="WXPN app" allow="autoplay; clipboard-write; web-share"></iframe>
            </div>
          </div>
        </div>
        <p class="dp-caption" aria-live="polite"></p>
      </main>
    </div>`;

  const stage = root.querySelector(".dp-stage");
  const box = root.querySelector(".dp-device");
  const scaler = root.querySelector(".dp-scaler");
  const frame = root.querySelector(".dp-frame");
  const iframe = root.querySelector("iframe");
  const caption = root.querySelector(".dp-caption");
  const rotate = root.querySelector(".dp-rotate");
  const open = root.querySelector(".dp-open");
  const windowTitle = root.querySelector(".dp-window-bar span");

  // The app's own screen, from the address the preview was opened with.
  // `build` keeps the frame on this release: GitHub Pages lets browsers
  // cache the page for a few minutes, which could pair a new preview with
  // an older app.
  const frameUrl = (hash) => `${BASE}?frame=1${build ? `&build=${build}` : ""}${hash}`;
  iframe.src = frameUrl(window.location.hash);

  const size = () => {
    const d = DEVICES[device];
    return device === "tablet" && landscape
      ? { width: d.height, height: d.width }
      : { width: d.width, height: d.height };
  };

  // The frame at its real size, scaled down to fit the window when needed.
  function fit() {
    const { width, height } = size();
    const c = CHROME[device];
    const outerW = width + c.x * 2;
    const outerH = height + c.top + c.bottom;
    const room = stage.getBoundingClientRect();
    const availW = room.width - 64;
    const availH = room.height - caption.offsetHeight - 56;
    const scale = Math.min(1, availW / outerW, availH / outerH);
    frame.style.width = `${outerW}px`;
    frame.style.height = `${outerH}px`;
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    scaler.style.transform = `scale(${scale})`;
    box.style.width = `${outerW * scale}px`;
    box.style.height = `${outerH * scale}px`;
    caption.textContent = `${DEVICES[device].label}${device === "tablet" ? (landscape ? ", landscape" : ", portrait") : ""} · ${width} × ${height}${scale < 0.999 ? ` · shown at ${Math.round(scale * 100)}%` : ""}`;
  }

  function syncAddress() {
    const params = new URLSearchParams(window.location.search);
    params.set("device", device);
    if (device === "tablet" && landscape) params.set("orientation", "landscape");
    else params.delete("orientation");
    let hash = window.location.hash;
    try {
      hash = iframe.contentWindow.location.hash || hash;
    } catch {
      /* not loaded yet */
    }
    const next = `?${params}${hash}`;
    if (`${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState(null, "", next);
    }
    open.href = frameUrl(hash);
  }

  // Phones and tablets draw no scrollbar; a laptop's browser does.
  function touchScrollbars() {
    try {
      iframe.contentDocument.documentElement.style.scrollbarWidth =
        device === "laptop" ? "" : "none";
    } catch {
      /* not loaded yet: done on load */
    }
  }

  function choose(next) {
    device = next;
    try {
      window.localStorage.setItem("xpn.preview.device", device);
    } catch {
      /* not remembered: fine */
    }
    root.querySelector(".dp").dataset.device = device;
    root.querySelectorAll(".dp-switch button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.device === device));
    });
    rotate.hidden = device !== "tablet";
    touchScrollbars();
    rotate.setAttribute("aria-pressed", String(landscape));
    fit();
    syncAddress();
  }

  root.querySelector(".dp-switch").addEventListener("click", (e) => {
    const button = e.target.closest("button[data-device]");
    if (button) choose(button.dataset.device);
  });
  rotate.addEventListener("click", () => {
    landscape = !landscape;
    choose(device);
  });
  // Number keys 1–3 switch sizes, unless typing (focus inside the app is in
  // the iframe, so its keys never reach here).
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea")) return;
    const id = { 1: "phone", 2: "tablet", 3: "laptop" }[e.key];
    if (id) choose(id);
  });

  new ResizeObserver(fit).observe(stage);
  // The app routes with the address hash; keep the preview's address in step
  // so it can be copied and shared as it stands.
  setInterval(syncAddress, 800);
  iframe.addEventListener("load", () => {
    syncAddress();
    touchScrollbars();
    try {
      windowTitle.textContent = iframe.contentDocument.title || "WXPN";
      new MutationObserver(() => {
        windowTitle.textContent = iframe.contentDocument.title || "WXPN";
      }).observe(iframe.contentDocument.querySelector("title"), { childList: true });
    } catch {
      /* ignore */
    }
  });
  choose(device);
}
