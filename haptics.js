import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// A light tap under the finger for actions that change something: play,
// pause, save, switch station. Native builds use the platform's haptic
// engine; Android browsers get a very short vibration; everywhere else this
// does nothing. It must never throw into a click handler.
export function tap(strength = "light") {
  try {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({
        style: strength === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
      }).catch(() => {});
    } else {
      navigator.vibrate?.(strength === "medium" ? 12 : 6);
    }
  } catch {
    /* no haptics available */
  }
}
