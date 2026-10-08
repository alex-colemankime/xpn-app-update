// The phone's text size (iPhone app). iOS's Settings › Display & Brightness
// › Text Size doesn't reach a web view on its own, so the app reads the
// listener's preferred size at launch and whenever it comes back to the
// front, and scales its text to match. (Android's font size already reaches
// the web view; browsers have their own zoom.)
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { TextZoom } from "@capacitor/text-zoom";

async function applyPreferred() {
  try {
    const { value } = await TextZoom.getPreferred();
    if (Number.isFinite(value) && value > 0) await TextZoom.set({ value });
  } catch {
    /* keep the default size */
  }
}

export function followTextSize() {
  if (Capacitor.getPlatform() !== "ios") return;
  applyPreferred();
  App.addListener("resume", applyPreferred);
}
