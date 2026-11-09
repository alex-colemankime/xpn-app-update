import { useEffect, useRef, useState } from "react";
import { CONCERTS_FRESH_MS, fetchConcertResult, saveCalendar, savedCalendar } from "../concerts.js";
import { adoptLegacyConcerts } from "../favorites.js";

// Listings older than this are fetched again, quietly, at launch and when
// the app returns to the front: in the phone apps a session can last days.
const STALE_MS = CONCERTS_FRESH_MS;

// The calendar kept from the last whole read (concerts.js), as a result.
function keptResult() {
  const saved = savedCalendar();
  return (
    saved && {
      concerts: saved.concerts,
      source: "live",
      partial: false,
      through: saved.through,
      attempt: 0,
      at: saved.at,
    }
  );
}

// Concert listings: the list kept on the device at once, read from the
// calendar when there is none or it has gone stale, again on retry (showing
// "loading"), and refreshed in place when stale or pulled down (keeping the
// list on screen meanwhile; if that read fails, the list says it may be out
// of date). Only one load runs at a time, however often the app comes to
// the front.
// `enabled` false (the build has no Concerts tab, or the station switched it
// off) loads nothing, and switching off stops a load under way.
export function useConcerts(enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(() => (enabled ? keptResult() : null));
  const loadedAt = useRef(result?.at || 0);
  const last = useRef(result);
  const reload = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = null;
    const load = (quiet) => {
      if (pending) return pending;
      pending = fetchConcertResult(controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          // A quiet refresh never replaces a good list with a failure, or a
          // complete one with a partial one. After a failure the list says
          // it may be out of date.
          if (quiet && (data.source !== "live" || (data.partial && !last.current?.partial))) {
            if (data.source !== "live") {
              setResult((shown) => (shown && !shown.stale ? { ...shown, stale: true } : shown));
            }
            return;
          }
          last.current = data;
          loadedAt.current = Date.now();
          if (data.source === "live" && !data.partial) saveCalendar(data, loadedAt.current);
          adoptLegacyConcerts(data.concerts);
          setResult({ ...data, attempt });
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    };
    reload.current = () => load(true);
    // A list already here (kept from an earlier launch, or read before the
    // tab was switched off and on) stays; it is read again, quietly, only
    // once it is stale. A retry always reads.
    const have = attempt === 0 && last.current?.source === "live";
    if (!have) load(false);
    else if (Date.now() - loadedAt.current > STALE_MS) load(true);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_MS)
        load(true);
    };
    document.addEventListener("visibilitychange", onVisible, { signal: controller.signal });
    return () => controller.abort();
  }, [attempt, enabled]);
  const loaded = result?.attempt === attempt;
  return {
    concerts: result?.concerts || [],
    source: loaded ? result.source : "loading",
    partial: loaded && Boolean(result.partial),
    // The calendar couldn't be read again, so the list may be out of date.
    stale: loaded && Boolean(result.stale),
    through: (loaded && result.through) || "",
    retry: () => setAttempt((n) => n + 1),
    // Quietly, keeping the list on screen (a pull down on Concerts).
    refresh: () => reload.current?.() || Promise.resolve(),
  };
}
