// Bundles WXPN's hosts with the app, from xpn.org's own "host" post type:
// each host's name, the line saying when they're on ("Thursday Evening &
// Sunday Afternoon Mix"), their bio, a square portrait (public/hosts/<slug>,
// 400px), their page, and the shows (shows.json) they host: the programs
// their page links to, or a show whose host line names them or that their
// own line names. Writes
// hosts.json.
//
// Run by .github/workflows/fetch-assets.yml (it needs `sharp`, installed
// there for this step only). Locally: npm i --no-save sharp && node tools/fetch-hosts.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const API = "https://xpn.org/wp-json/wp/v2/host?per_page=100&_embed=1";
const SHOWS = JSON.parse(await readFile(new URL("../shows.json", import.meta.url), "utf8"));
const OUT = new URL("../public/hosts/", import.meta.url);
const SIZE = 400;
await mkdir(OUT, { recursive: true });

const decode = (html) =>
  String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
// A bio as its paragraphs, in plain text.
const paragraphs = (html) =>
  String(html || "")
    .split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>/i)
    .map(decode)
    .filter((p) => p.length > 1);

// Show ids by their program page's slug, and a host line's names.
const byProgram = new Map(
  Object.values(SHOWS)
    .filter((s) => s.page)
    .map((s) => [s.page.replace(/\/$/, "").split("/").pop(), s.id]),
);
const plain = (name) => name.toLowerCase().replace(/^the /, "");
const names = (line) =>
  String(line || "")
    .split(/\s*(?:,|&|\band\b)\s*/)
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

const response = await fetch(API, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Hosts: HTTP ${response.status}`);
const hosts = {};
for (const post of await response.json()) {
  const slug = post.slug;
  const name = decode(post.title?.rendered);
  if (!slug || !name) continue;
  // The programs the host's page links to.
  const shows = new Set();
  try {
    // Not the sidebar's "On-Air Now", which names whatever is on as the
    // page is read.
    const response = await fetch(post.link, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const page = (await response.text()).replace(
      /<section[^>]*sidebar-card--onair[\s\S]*?<\/section>/g,
      "",
    );
    for (const [, program] of page.matchAll(/xpn\.org\/program\/([a-z0-9-]+)/g)) {
      if (byProgram.has(program)) shows.add(byProgram.get(program));
    }
  } catch (error) {
    console.warn(`${slug}: page not read (${error.message})`);
  }
  // And a show whose host line names them, or that their own line does
  // ("Sleepy Hollow").
  const when = decode(post.acf?.host_subtitle);
  const named = Object.values(SHOWS).filter((s) => when.toLowerCase().includes(plain(s.name)));
  for (const show of Object.values(SHOWS)) {
    if (names(show.host).includes(name.toLowerCase())) shows.add(show.id);
  }
  // Not "Sleepy Hollow" in "Post Sleepy Hollow Experience".
  for (const show of named) {
    if (!named.some((o) => o !== show && plain(o.name).includes(plain(show.name))))
      shows.add(show.id);
  }
  // The portrait, square, faces kept in (attention cropping).
  let img = null;
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const source =
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.large?.source_url ||
    media?.source_url;
  if (source) {
    try {
      const data = await (
        await fetch(source, { signal: AbortSignal.timeout(20000) })
      ).arrayBuffer();
      const jpeg = await sharp(Buffer.from(data))
        .resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      await writeFile(new URL(`${slug}.jpg`, OUT), jpeg);
      img = `hosts/${slug}.jpg`;
    } catch (error) {
      console.warn(`${slug}: no portrait (${error.message})`);
    }
  }
  hosts[slug] = {
    slug,
    name,
    when,
    bio: paragraphs(post.acf?.description || post.content?.rendered),
    img,
    page: post.link,
    shows: [...shows],
  };
  console.log(
    `${slug}: ${hosts[slug].shows.join(", ") || "no shows"}${img ? "" : ", no portrait"}`,
  );
}
const sorted = Object.fromEntries(
  Object.values(hosts)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h) => [h.slug, h]),
);
await writeFile(new URL("../hosts.json", import.meta.url), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} hosts`);
