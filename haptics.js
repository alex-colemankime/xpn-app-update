import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// The app's three haptics, each for one kind of moment, fired on the same
// frame as what it confirms:
//   "selection"  a tick: choosing a station, view or day; a sheet crossing
//                the point where it will close; a pull that will refresh
//   "light"      play, pause, a heart
//   "medium"     a press-and-hold menu opening
// Native builds use the platform's haptic engine. Android browsers get a
// very short vibration for taps (none for ticks, which would only buzz);
// everywhere else this does nothing. It must never throw into a handler.
export function tap(kind = "light") {
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === "selection") {
        Haptics.selectionStart()
          .then(() => Haptics.selectionChanged())
          .then(() => Haptics.selectionEnd())
          .catch(() => {});
        return;
      }
      Haptics.impact({
        style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
      }).catch(() => {});
    } else if (kind !== "selection") {
      navigator.vibrate?.(kind === "medium" ? 12 : 6);
    }
  } catch {
    /* no haptics available */
  }
}
