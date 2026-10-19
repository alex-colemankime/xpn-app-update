import { useEffect, useSyncExternalStore } from "react";
import { useFavoriteItems } from "../favorites.js";
import { easternToday } from "../concerts.js";
import { showToast } from "../toast.js";
import { nameList } from "../ui.jsx";
import {
  concertsByLikedArtists,
  showLikedConcerts,
  takeNewMatches,
  useConcertAlertSettings,
} from "../concert-alerts.js";

// Whether the app is in front. A calendar that arrives while it is in the
// background waits: recorded as announced then, its notice would time out
// unseen and never come back.
const watchVisibility = (listener) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isVisible = () => document.visibilityState !== "hidden";

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

// Announces, in the app, a concert on the calendar by an artist the
// listener has saved a song by, once per concert (concert-alerts.js): when
// the calendar loads or refreshes, and when a newly saved song's artist
// already has a show coming. View opens Concerts showing only artists they
// like.
export function useConcertAlerts({ concerts, source }, onNavigate) {
  const { enabled } = useConcertAlertSettings();
  const songs = useFavoriteItems("songs");
  const visible = useSyncExternalStore(watchVisibility, isVisible, () => true);
  useEffect(() => {
    if (!visible) return;
    if (!enabled || source !== "live" || !concerts.length || !songs.length) return;
    const today = easternToday();
    const upcoming = concerts.filter((c) => c.date >= today);
    const matches = concertsByLikedArtists(upcoming, songs);
    const { fresh, first } = takeNewMatches(matches, new Set(upcoming.map((c) => c.id)));
    if (!fresh.length) return;
    const view = {
      label: "View",
      onClick: () => {
        showLikedConcerts();
        onNavigate("concerts");
      },
    };
    if (fresh.length === 1) {
      const [{ concert, artist }] = fresh;
      showToast(
        {
          title: concert.venue ? `${artist} at ${concert.venue}` : `${artist} in concert`,
          text: `${DAY.format(new Date(`${concert.date}T12:00:00`))} · an artist you like`,
          icon: "navConcerts",
        },
        view,
      );
      return;
    }
    const artists = [...new Set(fresh.map((m) => m.artist))];
    showToast(
      {
        title: first
          ? `${fresh.length} concerts coming up by artists you like`
          : `${fresh.length} new concerts by artists you like`,
        text: nameList(artists),
        icon: "navConcerts",
      },
      view,
    );
  }, [visible, enabled, source, concerts, songs, onNavigate]);
}
