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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
