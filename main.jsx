import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./error-boundary.jsx";
// Bundled with the app rather than loaded from Google Fonts: no third-party
// request on launch, and text renders the same offline.
import "@fontsource-variable/figtree";
import "./global.css";

// Menus (song, sleep timer, calendar) use the Popover API, which Safari has
// from 17. Older iPhones (iOS 15–16) get a small polyfill, loaded only there.
if (typeof HTMLElement !== "undefined" && !("popover" in HTMLElement.prototype)) {
  await import("@oddbird/popover-polyfill").catch(() => {});
}

// The shared design preview (VITE_DEVICE_PREVIEW, GitHub Pages only): on a
// computer, the link opens the app inside a phone, tablet or laptop frame,
// and the app itself runs in that frame (?frame=1). Phones and tablets, and
// every other build, get the app directly.
const devicePreview =
  typeof __DEVICE_PREVIEW__ === "boolean" &&
  __DEVICE_PREVIEW__ &&
  window.self === window.top &&
  !new URLSearchParams(window.location.search).has("frame") &&
  window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)").matches;

if (devicePreview) {
  const { mountDevicePreview } = await import("./preview-shell.js");
  // This build's entry file name changes with every release, so the frame
  // asks for the same release as the page around it, never a cached older one.
  mountDevicePreview(document.getElementById("root"), {
    build: new URL(import.meta.url).pathname.split("/").pop(),
  });
} else {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
