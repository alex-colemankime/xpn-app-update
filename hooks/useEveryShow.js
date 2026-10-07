import { useEffect } from "react";

// Runs `run` now, and again each time the app comes back to the front (a
// phone unlocked, the tab returned to), so anything planned ahead, such as
// scheduled notifications or a cached list, catches up with the clock. Like
// useEffect, it starts over when `deps` change.
export function useEveryShow(run, deps) {
  useEffect(() => {
    run();
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // The caller's deps, checked at the call site (see eslint.config.js).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
