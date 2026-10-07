// Text and links that come from outside the app (feeds, WordPress, the
// station's updates file, Brightcove), made safe and tidy in one place.

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

// Entities decoded as characters, never as HTML. Unknown or invalid entities
// stay readable instead of throwing or injecting markup into the page.
export function decodeEntities(value) {
  return String(value ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

// HTML as one line of plain text: tags stripped first, then entities
// decoded, so a decoded "<" can never be mistaken for markup.
export function plainText(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// A string field as one tidy line, at most `max` characters; anything that
// isn't text (a damaged file) is empty.
export function oneLine(value, max = Infinity) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

// A link the app may open or load: https only, or http too where a site may
// still use it (`http: true`, for ticket links). Anything else (javascript:,
// data:, relative paths from a misconfigured feed) is dropped at the source.
export function webUrl(value, { http = false } = {}) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" || (http && url.protocol === "http:") ? url.href : "";
  } catch {
    return "";
  }
}
