import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { createLocalStore, useLocalStore } from "../storage.js";

// Kept in step with --bg in global.css and the inline script in index.html.
const BACKGROUND = { light: "#faf8f3", dark: "#202224" };

const appearanceStore = createLocalStore("xpn.appearance", "system", (value) =>
  ["light", "dark", "system"].includes(value) ? value : "system",
);

export function useAppearance() {
  const appearance = useLocalStore(appearanceStore);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = appearance === "system" ? (media.matches ? "dark" : "light") : appearance;
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", BACKGROUND[theme]);
      // In the phone apps the status bar text follows the app's theme, not
      // the phone's, so it stays readable when they differ.
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }).catch(() => {});
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  return [appearance, appearanceStore.set];
}
