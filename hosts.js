import suppliedHosts from "./hosts.json" with { type: "json" };
import suppliedShows from "./shows.json" with { type: "json" };
import { publicAsset } from "./assets.js";

// WXPN's hosts, from xpn.org's own host pages (tools/fetch-hosts.mjs): who
// they are, the line under their name there ("Sleepy Hollow"), their bio, a
// square portrait and the shows (shows.json ids) they host. By name.
// A host with no page of their own there (a syndicated show's, or one not on
// staff) is still listed, from the show they host: its art and its page.
const WITHOUT_PAGES = [
  ["ben-vaughn", "Ben Vaughn", "benvaughn"],
  ["nick-spitzer", "Nick Spitzer", "americanroutes"],
];
export const HOSTS = [
  ...Object.values(suppliedHosts),
  ...WITHOUT_PAGES.filter(([slug]) => !suppliedHosts[slug]).map(([slug, name, show]) => ({
    slug,
    name,
    when: suppliedShows[show].name,
    bio: [],
    img: suppliedShows[show].img,
    page: suppliedShows[show].page,
    shows: [show],
  })),
]
  .map((host) => ({ ...host, img: host.img ? publicAsset(host.img) : null }))
  .sort((a, b) => a.name.localeCompare(b.name));
const BY_SLUG = new Map(HOSTS.map((h) => [h.slug, h]));
export const hostBySlug = (slug) => BY_SLUG.get(slug) || null;

// A name as compared: case and apostrophes folded ("D'Alessandro" in the
// schedule is "D’Alessandro" on her page). One character for one, so a
// position found in the folded text is the same in the original.
export const foldName = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`]/g, "'");

// A show's hosts, in the order its host line names them ("Kristen Kurtis &
// Bob Bumbera"); a host it doesn't name, after. Pure.
export function hostsOfShow(show, hosts = HOSTS) {
  const line = foldName(show?.host);
  const at = (h) => {
    const i = line.indexOf(foldName(h.name));
    return i < 0 ? Infinity : i;
  };
  return hosts.filter((h) => h.shows.includes(show?.id)).sort((a, b) => at(a) - at(b));
}
