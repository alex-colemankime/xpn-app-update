import { useSyncExternalStore } from "react";
import { Icon } from "../ui.jsx";

const subscribe = (onChange) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};
const isOffline = () => navigator.onLine === false;

// A quiet line while the phone has no connection, so a stream that won't
// start or a list that won't load explains itself. Saved songs, shows and
// settings all still work; the radio reconnects on its own when the
// connection returns (player.js).
export function OfflineNotice() {
  const offline = useSyncExternalStore(subscribe, isOffline, () => false);
  if (!offline) return null;
  return (
    <p className="offline-notice" role="status">
      <Icon name="navLive" size={16} />
      You’re offline. The radio and new content come back when you reconnect.
    </p>
  );
}
