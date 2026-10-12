// Android's Back button. Capacitor's own handling steps back through the
// web view's history and then closes the app's activity, which takes the
// web view, and the station playing in it, down with it. Instead, as music
// apps do: Back closes a menu or sheet that is open, then a screen opened
// over another (a show, a video), then steps back through screens, and at
// the start puts the app in the background, still playing.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// What Back does now. Pure, so it can be tested.
export function backAction({ popoverOpen, dialogOpen, canGoBack }) {
  if (popoverOpen) return "close-menu";
  if (dialogOpen) return "close-sheet";
  return canGoBack ? "back" : "background";
}

const openPopover = () => {
  try {
    return document.querySelector(":popover-open");
  } catch {
    return null; // a web view without popovers: none can be open
  }
};

export function startBackButton() {
  if (Capacitor.getPlatform() !== "android") return;
  App.addListener("backButton", ({ canGoBack }) => {
    const popover = openPopover();
    const dialogs = document.querySelectorAll("dialog[open]");
    const dialog = dialogs[dialogs.length - 1];
    const action = backAction({
      popoverOpen: Boolean(popover),
      dialogOpen: Boolean(dialog),
      canGoBack,
    });
    if (action === "close-menu") popover.hidePopover();
    // As Escape would: each sheet decides how it closes (a show's goes back
    // in history; one that can't be dismissed stays).
    else if (action === "close-sheet")
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (action === "back") window.history.back();
    else App.minimizeApp().catch(() => {});
  }).catch(() => {}); // a build without the native side
}
