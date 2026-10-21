import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { createLocalStore, useLocalStore } from "../storage.js";

// Kept in step with --bg in styles/base.css and the inline script in index.html.
const BACKGROUND = { light: "#f5f5f3", dark: "#111111" };

const appearanceStore = createLocalStore("xpn.appearance", "system", (value) =>
  ["light", "dark", "system"].includes(value) ? value : "system",
);

export function useAppearance() {
  const appearance = useLocalStore(appearanceStore);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = appearance === "system" ? (media.matches ? "dark" : "light") : appearance;
      const root = document.documentElement;
      if (root.dataset.theme !== theme) {
        // A theme changes at once: nothing eases across it for the frame it
        // takes (styles/base.css, data-theme-switch).
        root.dataset.themeSwitch = "";
        root.dataset.theme = theme;
        requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitch));
      }
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", BACKGROUND[theme]);
      // In the phone apps the status bar text follows the app's theme, not
      // the phone's, so it stays readable when they differ.
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }).catch(() => {});
      }
      // On Android the page sits below the status bar, which takes the
      // page's color. Drawn under it (the plugin's default), Android 14 and
      // older with a WebView before 140 report no inset, and the header
      // went under the clock (seen in the smoke test). Android 15 and later
      // keep the page clear of it themselves either way.
      if (Capacitor.getPlatform() === "android") {
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        StatusBar.setBackgroundColor({ color: BACKGROUND[theme] }).catch(() => {});
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  return [appearance, appearanceStore.set];
}
