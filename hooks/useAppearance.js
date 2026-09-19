import { useEffect } from "react";
import { createLocalStore, useLocalStore } from "../storage.js";

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
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#161719" : "#faf9f6");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  return [appearance, appearanceStore.set];
}
