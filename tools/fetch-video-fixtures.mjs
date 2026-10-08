// For the screens page (design/screens): the real titles, lengths and
// thumbnails of the newest videos in the app's Brightcove collections, so
// screenshots show each session's own thumbnail rather than a stand-in.
// Writes fixtures/videos.json and fixtures/<video id>.jpg in the current
// directory; .github/workflows/fetch-assets.yml publishes them on the
// screens-fixtures branch. Nothing here ships in the app.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ACCOUNT = "6416366397001";
const PLAYLISTS = (process.env.PLAYLISTS || "").split(",").filter(Boolean);
const LIMIT = 16;

const get = async (url, init) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
};

const config = await (
  await get(`https://players.brightcove.net/${ACCOUNT}/default_default/config.json`)
).json();
const key = config.video_cloud.policy_key;
await mkdir("fixtures", { recursive: true });
const out = {};
for (const playlist of PLAYLISTS) {
  const data = await (
    await get(
      `https://edge.api.brightcove.com/playback/v1/accounts/${ACCOUNT}/playlists/${playlist}?limit=${LIMIT}`,
      { headers: { Accept: `application/json;pk=${key}` } },
    )
  ).json();
  out[playlist] = [];
  for (const v of data.videos) {
    const { id, name, duration, published_at, tags, custom_fields, long_description } = v;
    out[playlist].push({ id, name, duration, published_at, tags, custom_fields, long_description });
    const src = v.poster || v.thumbnail;
    if (!src) continue;
    const image = Buffer.from(await (await get(src)).arrayBuffer());
    await writeFile(
      `fixtures/${id}.jpg`,
      await sharp(image).resize(960, 540, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer(),
    );
  }
  console.log(`${playlist}: ${out[playlist].length} videos`);
}
await writeFile("fixtures/videos.json", `${JSON.stringify(out, null, 2)}\n`);
