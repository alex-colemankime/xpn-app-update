// Playing on another device: AirPlay on Apple devices (the iPhone and iPad
// apps, Safari), Google Cast in Chrome. Both are the platform's own picker,
// opened from an <audio> element; the app streams the same URL either way.
// The Android app's WebView has neither, so no button shows there.

// What this device offers, from an audio element: "airplay", "cast" or null.
// Safari has both APIs; its picker is AirPlay, so that's checked first.
export function castKind(audio) {
  if (typeof audio?.webkitShowPlaybackTargetPicker === "function") return "airplay";
  if (typeof audio?.remote?.prompt === "function") return "cast";
  return null;
}

// The device's offer, once: every audio element on a device has the same.
export const CAST_KIND =
  typeof document === "undefined" ? null : castKind(document.createElement("audio"));

// The words for the button and its icon.
export const CAST_LABEL = { airplay: "AirPlay", cast: "Cast to a speaker or TV" };

// Opens the picker for this element. Rejects where there's none.
export async function promptCast(audio) {
  if (typeof audio?.webkitShowPlaybackTargetPicker === "function")
    return audio.webkitShowPlaybackTargetPicker();
  if (typeof audio?.remote?.prompt === "function") return audio.remote.prompt();
  throw new Error("Playing on another device isn't available here.");
}
