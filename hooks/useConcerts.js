import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchConcertResult } from "../concerts.js";
import { adoptLegacyConcerts } from "../favorites.js";

// Listings older than this are fetched again, quietly, when the app returns
// to the front: in the phone apps a session can last days.
const STALE_MS = 3 * 3600000;

// Concert listings: loaded once, again on retry (showing "loading"), and
// refreshed in place when stale (keeping the list on screen meanwhile).
export function useConcerts() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const loadedAt = useRef(0);
  const last = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = (quiet) =>
      fetchConcertResult(controller.signal).then((data) => {
        if (controller.signal.aborted) return;
        // A quiet refresh never replaces a good list with a failure, or a
        // complete one with a partial one.
        if (quiet && (data.source !== "live" || (data.partial && !last.current?.partial))) return;
        last.current = data;
        loadedAt.current = Date.now();
        adoptLegacyConcerts(data.concerts);
        setResult({ ...data, attempt });
      });
    load(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_MS)
        load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [attempt]);
  const loaded = result?.attempt === attempt;
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return useMemo(
    () => ({
      concerts: result?.concerts || [],
      source: loaded ? result.source : "loading",
      partial: loaded && Boolean(result.partial),
      through: (loaded && result.through) || "",
      retry,
    }),
    [result, loaded, retry],
  );
}
