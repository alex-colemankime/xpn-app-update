import { useState, useEffect } from "react";
import { fetchConcertResult } from "../concerts.js";

export function useConcerts() {
  const [result, setResult] = useState({ concerts: [], source: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult((r) => ({ ...r, source: "loading" }));
    fetchConcertResult().then((data) => {
      if (active) setResult(data);
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { ...result, retry: () => setAttempt((n) => n + 1) };
}
