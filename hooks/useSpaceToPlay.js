import { useEffect } from "react";
import { togglePlayback } from "../player.js";

// Space plays and pauses the station, unless focus is somewhere Space
// already means something (a button, a field, a link) or a sheet is open.
export function useSpaceToPlay() {
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.code !== "Space" ||
        e.defaultPrevented ||
        e.repeat ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.target.closest?.("button, a, input, select, textarea, summary, [contenteditable]"))
        return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
