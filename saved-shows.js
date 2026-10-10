// Favorites › Shows: each show the listener follows or has saved episodes
// of, as a short list with the show at its head. A show whose episodes are
// saved but which isn't followed still gets a group, its heart empty, so
// following it is one tap from the episodes that show the interest.

const lower = (value) => String(value || "").toLowerCase();

// Groups, most recently saved first. A group's place comes from its newest
// saved episode (or, with none, from when the show was followed), so
// following or unfollowing from the list never moves the group under the
// listener's finger. Pure, so it can be tested.
export function savedShowGroups({ followed = [], episodes = [], catalog = {}, query = "" }) {
  const groups = new Map();
  const group = (id) => {
    if (!groups.has(id)) groups.set(id, { id, show: null, followed: false, episodes: [], at: 0 });
    return groups.get(id);
  };
  for (const show of followed) {
    const g = group(show.id);
    g.followed = true;
    g.show = catalog[show.id] || show;
    g.followedAt = show.savedAt || 0;
  }
  for (const episode of episodes) {
    const id = episode.show || episode.showId;
    if (!id) continue;
    const g = group(id);
    g.episodes.push(episode);
    g.at = Math.max(g.at, episode.savedAt || 0);
    g.show ||= catalog[id] || {
      id,
      name: episode.showName || "WXPN",
      img: episode.image || episode.img,
    };
  }
  const q = lower(query).trim();
  const list = [];
  for (const g of groups.values()) {
    // Within a show, newest broadcast first, like the archive.
    g.episodes.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    if (!g.episodes.length) g.at = g.followedAt || 0;
    delete g.followedAt;
    if (q && !lower(g.show.name).includes(q)) {
      // A search that misses the show's name keeps only the episodes it hits.
      g.episodes = g.episodes.filter((e) =>
        `${lower(e.title)} ${lower(e.feature)} ${lower(e.summary)}`.includes(q),
      );
      if (!g.episodes.length) continue;
    }
    list.push(g);
  }
  return list.sort((a, b) => b.at - a.at);
}
