import suppliedHosts from "./hosts.json" with { type: "json" };
import { publicAsset } from "./assets.js";

// WXPN's hosts, from xpn.org's own host pages (tools/fetch-hosts.mjs): who
// they are, the line under their name there ("Sleepy Hollow"), their bio, a
// square portrait and the shows (shows.json ids) they host. By name.
export const HOSTS = Object.values(suppliedHosts).map((host) => ({
  ...host,
  img: host.img ? publicAsset(host.img) : null,
}));
const BY_SLUG = new Map(HOSTS.map((h) => [h.slug, h]));
export const hostBySlug = (slug) => BY_SLUG.get(slug) || null;

// A show's hosts, in the order its host line names them ("Kristen Kurtis &
// Bob Bumbera"); a host it doesn't name, after. Pure.
export function hostsOfShow(show, hosts = HOSTS) {
  const line = String(show?.host || "").toLowerCase();
  const at = (h) => {
    const i = line.indexOf(h.name.toLowerCase());
    return i < 0 ? Infinity : i;
  };
  return hosts.filter((h) => h.shows.includes(show?.id)).sort((a, b) => at(a) - at(b));
}
