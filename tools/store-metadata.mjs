// Store metadata for fastlane, from store/listing.md (the one place the
// listing is written). Writes:
//
//   fastlane/metadata/            deliver (App Store): en-US/*.txt, categories,
//                                 review_information/notes.txt
//   fastlane/metadata/android/    supply (Google Play): en-US/*.txt, changelog
//   fastlane/app_privacy_details.json  App Privacy answers, for `ios privacy`
//
// and copies the screenshots from store/ to where each tool looks for them
// (fastlane/screenshots/en-US for deliver, metadata/android/en-US/images for
// supply). Those copies are git-ignored (fastlane/.gitignore): store/ holds
// the only committed images, and every fastlane lane runs this first.
//
//   node tools/store-metadata.mjs           write everything
//   node tools/store-metadata.mjs --check   fail if the committed text is stale
//
// Every store limit is checked, and anything over one stops it with an error,
// before a store would reject (or quietly cut) the text.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTING = join(ROOT, "store/listing.md");
const FASTLANE = join(ROOT, "fastlane");
const META = join(FASTLANE, "metadata");
const CHECK = process.argv.includes("--check");

const errors = [];
const fail = (msg) => errors.push(msg);

// ---- Reading the listing ------------------------------------------------

const md = readFileSync(LISTING, "utf8");

// Sections by their "## " heading, so a label is looked up where it belongs.
const sections = {};
{
  let name = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) name = h[1].trim();
    else (sections[name] ??= []).push(line);
  }
}
const section = (name) => {
  if (!sections[name]) throw new Error(`store/listing.md has no "## ${name}" section`);
  return sections[name];
};

// "**Label** (30): value" or "**Label:** value", several per line allowed
// ("**Support URL:** … · **Marketing URL:** …").
function fields(lines) {
  const out = {};
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(/\*\*([^*]+?)\*\*(?:\s*\((\d+)\))?:\s*([^·]*)/g)) {
      out[m[1].trim()] = { value: m[3].trim(), limit: m[2] && Number(m[2]), line: i };
    }
    for (const m of line.matchAll(/\*\*([^*]+?):\*\*\s*([^·]*)/g)) {
      out[m[1].trim()] = { value: m[2].trim(), line: i };
    }
  }
  return out;
}

function need(fieldsOf, label, where) {
  const f = fieldsOf[label];
  if (!f) throw new Error(`store/listing.md: no "**${label}**" in "## ${where}"`);
  return f;
}

// The multi-paragraph text that follows "**Label** (n):" up to the next field.
function block(lines, start) {
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\*\*[^*]+\*\*/.test(line)) break;
    body.push(line);
  }
  return body
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const url = (text, label) => {
  const m = text.match(/https:\/\/[^\s)]+/);
  if (!m) throw new Error(`store/listing.md: "${label}" has no https:// address`);
  return m[0];
};

const both = section("Both stores");
const ios = section("App Store");
const play = section("Google Play");
const bothF = fields(both);
const iosF = fields(ios);
const playF = fields(play);

const name = need(bothF, "Name", "Both stores").value;
const supportUrl = url(need(bothF, "Support URL", "Both stores").value, "Support URL");
const marketingUrl = url(need(bothF, "Marketing URL", "Both stores").value, "Marketing URL");
const privacyUrl = url(need(bothF, "Privacy policy", "Both stores").value, "Privacy policy");

// "Music (secondary on iOS: Entertainment)" → MUSIC, ENTERTAINMENT
const categoryText = need(bothF, "Category", "Both stores").value;
const APPLE_CATEGORIES = new Set(
  "BOOKS BUSINESS DEVELOPER_TOOLS EDUCATION ENTERTAINMENT FINANCE FOOD_AND_DRINK GAMES GRAPHICS_AND_DESIGN HEALTH_AND_FITNESS LIFESTYLE MAGAZINES_AND_NEWSPAPERS MEDICAL MUSIC NAVIGATION NEWS PHOTO_AND_VIDEO PRODUCTIVITY REFERENCE SHOPPING SOCIAL_NETWORKING SPORTS STICKERS TRAVEL UTILITIES WEATHER".split(
    " ",
  ),
);
const appleCategory = (text) => {
  const id = text
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z]+/g, "_");
  if (!APPLE_CATEGORIES.has(id)) fail(`Category "${text}" is not an App Store category`);
  return id;
};
const primaryCategory = appleCategory(categoryText.split("(")[0]);
const secondaryMatch = categoryText.match(/secondary on iOS:\s*([^)]+)\)/);
const secondaryCategory = secondaryMatch ? appleCategory(secondaryMatch[1]) : "";

const subtitle = need(iosF, "Subtitle", "App Store");
const promo = need(iosF, "Promotional text", "App Store");
const keywords = need(iosF, "Keywords", "App Store");
const descField = need(iosF, "Description", "App Store");
const description = block(ios, descField.line);
const whatsNewLabel = Object.keys(iosF).find((k) => /^What's new/.test(k));
if (!whatsNewLabel) throw new Error('store/listing.md: no "**What\'s new (x.y):**" in App Store');
const releaseNotes = iosF[whatsNewLabel].value;
const reviewNotes = need(iosF, "App Review notes", "App Store").value;

const shortDesc = need(playF, "Short description", "Google Play");
const fullDescText = need(playF, "Full description", "Google Play").value;
const fullDescription = /^as the App Store description\.?$/i.test(fullDescText)
  ? description
  : block(play, playF["Full description"].line) || fullDescText;

// ---- App Privacy (deliver's upload_app_privacy_details JSON) ------------

// Apple's "Category › Type" names as written in the table → API ids.
const DATA_TYPES = {
  "Contact Info › Name": "NAME",
  "Contact Info › Email Address": "EMAIL_ADDRESS",
  "Contact Info › Phone Number": "PHONE_NUMBER",
  "Location › Precise Location": "PRECISE_LOCATION",
  "Location › Coarse Location": "COARSE_LOCATION",
  "Identifiers › User ID": "USER_ID",
  "Identifiers › Device ID": "DEVICE_ID",
  "Usage Data › Product Interaction": "PRODUCT_INTERACTION",
  "Usage Data › Advertising Data": "ADVERTISING_DATA",
  "Usage Data › Other Usage Data": "OTHER_USAGE_DATA",
  "Diagnostics › Crash Data": "CRASH_DATA",
  "Diagnostics › Performance Data": "PERFORMANCE_DATA",
  "Diagnostics › Other Diagnostic Data": "OTHER_DIAGNOSTIC_DATA",
};
const PURPOSES = {
  "Third-Party Advertising": "THIRD_PARTY_ADVERTISING",
  "Developer's Advertising or Marketing": "DEVELOPERS_ADVERTISING",
  Analytics: "ANALYTICS",
  "Product Personalization": "PRODUCT_PERSONALIZATION",
  "App Functionality": "APP_FUNCTIONALITY",
  "Other Purposes": "OTHER_PURPOSES",
};

function appPrivacy() {
  const start = ios.findIndex((l) => l.startsWith("**App Privacy**"));
  if (start < 0) throw new Error('store/listing.md: no "**App Privacy**" in App Store');
  const lines = ios.slice(start);
  const tracking = lines.find((l) => /\*\*Tracking:\*\*/.test(l)) ?? "";
  if (!/\*\*Tracking:\*\*\s*No\b/.test(tracking))
    fail('App Privacy: Tracking isn\'t "No"; update tools/store-metadata.mjs for tracking');
  const collected = lines.find((l) => /\*\*Data collected/.test(l)) ?? "";
  if (!/none of it linked/i.test(collected))
    fail('App Privacy: expected "Data collected, none of it linked to the user\'s identity"');
  const rows = lines
    .filter((l) => /^\|/.test(l))
    .slice(2) // header and its --- line
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  if (!rows.length) fail("App Privacy: the data table has no rows");
  return rows
    .map(([type, , purposes]) => {
      const category = DATA_TYPES[type];
      if (!category) fail(`App Privacy: unknown data type "${type}" (add it to DATA_TYPES)`);
      const ids = purposes.split(",").map((p) => {
        const id = PURPOSES[p.trim()];
        if (!id) fail(`App Privacy: unknown purpose "${p.trim()}" for ${type}`);
        return id;
      });
      return {
        category,
        purposes: [...new Set(ids)].sort(),
        data_protections: ["DATA_NOT_LINKED_TO_YOU"],
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));
}
const privacy = appPrivacy();

// ---- Limits -------------------------------------------------------------

// Characters as the stores count them (code points, not UTF-16 units).
const len = (s) => [...s].length;
function limit(label, text, max, docLimit) {
  if (docLimit && docLimit !== max)
    fail(`${label}: listing.md says (${docLimit}) but the store limit is ${max}`);
  if (!text) fail(`${label} is empty`);
  else if (len(text) > max) fail(`${label} is ${len(text)} characters; the limit is ${max}`);
  if (/\*\*|`|\]\(/.test(text)) fail(`${label} still has Markdown in it: ${text.slice(0, 60)}…`);
}
limit("App Store name", name, 30, bothF.Name.limit);
limit("App Store subtitle", subtitle.value, 30, subtitle.limit);
limit("App Store promotional text", promo.value, 170, promo.limit);
limit("App Store keywords", keywords.value, 100, keywords.limit);
limit("App Store description", description, 4000, descField.limit);
limit("App Store release notes", releaseNotes, 4000);
limit("App Review notes", reviewNotes, 4000);
limit("Play title", name, 30);
limit("Play short description", shortDesc.value, 80, shortDesc.limit);
limit("Play full description", fullDescription, 4000);
limit("Play release notes", releaseNotes, 500);
for (const k of keywords.value.split(",")) {
  if (!k.trim()) fail("App Store keywords: an empty keyword (two commas, or a trailing one)");
}

// ---- Screenshots --------------------------------------------------------

// Width and height from a PNG's IHDR or a JPEG's SOF marker.
function size(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length;) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      const segment = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + segment;
    }
  }
  throw new Error(`${relative(ROOT, path)}: not a PNG or JPEG`);
}

const shots = (dir) =>
  existsSync(join(ROOT, "store", dir))
    ? readdirSync(join(ROOT, "store", dir))
        .filter((f) => /^\d\d-.+\.(jpe?g|png)$/i.test(f))
        .sort()
        .map((f) => join(ROOT, "store", dir, f))
    : [];

// App Store display types, by the exact pixel sizes App Store Connect takes.
// deliver tells them apart by size; the file name prefix only keeps the
// folder readable and the order (deliver uploads each type sorted by name).
const APPLE_SETS = [
  {
    dir: "ios",
    prefix: "iphone-6.9",
    type: 'iPhone 6.9" (APP_IPHONE_67)',
    sizes: ["1320x2868", "1290x2796", "1260x2736"],
  },
  {
    dir: "ipad",
    prefix: "ipad-13",
    type: 'iPad 13" (APP_IPAD_PRO_3GEN_129)',
    sizes: ["2064x2752", "2048x2732"],
  },
];

function plan() {
  const copies = [];
  for (const set of APPLE_SETS) {
    const files = shots(set.dir);
    if (set.dir === "ios" && !files.length)
      fail('store/ios has no screenshots (iPhone 6.9" is required)');
    if (files.length > 10)
      fail(`store/${set.dir}: ${files.length} screenshots; the App Store takes 10`);
    for (const f of files) {
      const [w, h] = size(f);
      const s = `${Math.min(w, h)}x${Math.max(w, h)}`;
      if (!set.sizes.includes(s))
        fail(`${relative(ROOT, f)} is ${w}×${h}; ${set.type} takes ${set.sizes.join(", ")}`);
      copies.push([f, join(FASTLANE, "screenshots/en-US", `${set.prefix}-${f.split("/").pop()}`)]);
    }
  }
  const phone = shots("android");
  if (phone.length < 2 || phone.length > 8)
    fail(`store/android: ${phone.length} phone screenshots; Play takes 2 to 8`);
  const playImages = join(META, "android/en-US/images");
  for (const f of phone) {
    const [w, h] = size(f);
    const ratio = Math.max(w, h) / Math.min(w, h);
    if (Math.min(w, h) < 320 || Math.max(w, h) > 3840 || ratio > 2 + 1e-9 || ratio < 16 / 9 - 1e-9)
      fail(
        `${relative(ROOT, f)} is ${w}×${h}; Play phone screenshots are 320–3840 px, 16:9 to 2:1`,
      );
    copies.push([f, join(playImages, "phoneScreenshots", f.split("/").pop())]);
  }
  const feature = join(ROOT, "store/android/feature-graphic.png");
  if (!existsSync(feature)) fail("store/android/feature-graphic.png is missing (Play requires it)");
  else {
    const [w, h] = size(feature);
    if (w !== 1024 || h !== 500)
      fail(`store/android/feature-graphic.png is ${w}×${h}, not 1024×500`);
    copies.push([feature, join(playImages, "featureGraphic.png")]);
  }
  return copies;
}
const copies = plan();

if (errors.length) {
  console.error(
    `store-metadata: store/listing.md doesn't fit the stores:\n  ${errors.join("\n  ")}`,
  );
  process.exit(1);
}

// ---- Output -------------------------------------------------------------

const text = {
  // deliver (App Store Connect)
  "en-US/name.txt": name,
  "en-US/subtitle.txt": subtitle.value,
  "en-US/description.txt": description,
  "en-US/keywords.txt": keywords.value,
  "en-US/promotional_text.txt": promo.value,
  "en-US/release_notes.txt": releaseNotes,
  "en-US/support_url.txt": supportUrl,
  "en-US/marketing_url.txt": marketingUrl,
  "en-US/privacy_url.txt": privacyUrl,
  "primary_category.txt": primaryCategory,
  "secondary_category.txt": secondaryCategory,
  "review_information/notes.txt": reviewNotes,
  // supply (Google Play)
  "android/en-US/title.txt": name,
  "android/en-US/short_description.txt": shortDesc.value,
  "android/en-US/full_description.txt": fullDescription,
  "android/en-US/changelogs/default.txt": releaseNotes,
};
const outputs = Object.entries(text).map(([p, t]) => [join(META, p), `${t}\n`]);
// Laid out as Prettier would, so `npm run format:check` passes on it.
const privacyJson = `[\n${privacy
  .map(
    (u) =>
      `  {\n${Object.entries(u)
        .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v).replace(/","/g, '", "')}`)
        .join(",\n")}\n  }`,
  )
  .join(",\n")}\n]\n`;
outputs.push([join(FASTLANE, "app_privacy_details.json"), privacyJson]);

if (CHECK) {
  const stale = outputs.filter(([p, t]) => !existsSync(p) || readFileSync(p, "utf8") !== t);
  if (stale.length) {
    console.error(
      `store-metadata: out of date with store/listing.md (run node tools/store-metadata.mjs):\n  ${stale
        .map(([p]) => relative(ROOT, p))
        .join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log(`store-metadata: ${outputs.length} files match store/listing.md`);
  process.exit(0);
}

for (const [p, t] of outputs) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, t);
}
// Screenshot copies start clean, so a shot removed from store/ goes from the stores too.
rmSync(join(FASTLANE, "screenshots"), { recursive: true, force: true });
rmSync(join(META, "android/en-US/images"), { recursive: true, force: true });
for (const [from, to] of copies) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log(
  `store-metadata: ${outputs.length} text files, ${copies.length} images (version ${
    whatsNewLabel.match(/\(([^)]+)\)/)?.[1] ?? "?"
  } notes)`,
);
