// Files in public/ resolve against the deploy base, because GitHub Pages
// serves the app from a subpath rather than the domain root.
const BASE = import.meta.env?.BASE_URL ?? "/";
export const publicAsset = (path) => `${BASE}${path.replace(/^\/+/, "")}`;

// Shown wherever a song or show has no artwork of its own.
export const STATION_ART = publicAsset("icons/icon-512.png");
