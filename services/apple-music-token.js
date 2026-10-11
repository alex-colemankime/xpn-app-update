// The Apple Music developer token endpoint (VITE_APPLE_MUSIC_TOKEN_URL): a
// Cloudflare Worker, or anything that runs a standard fetch handler, that
// answers { "token": "…" }, a MusicKit developer token signed with WXPN's
// MusicKit key. Tokens last six months at most, so the app asks for one
// rather than having one built in, and this makes a fresh one as needed.
//
// Setup (see README › Playlist sync): a MusicKit key from the Apple
// Developer account (Certificates, Identifiers & Profiles › Keys, with
// MusicKit), then
//   npx wrangler deploy services/apple-music-token.js --name wxpn-music-token \
//     --compatibility-date 2026-10-01
//   npx wrangler secret put MUSICKIT_KEY   (the .p8 file's contents)
//   npx wrangler secret put KEY_ID         (the key's 10-character id)
//   npx wrangler secret put TEAM_ID        (WXPN's Apple Team ID)
// and build the app with VITE_APPLE_MUSIC_TOKEN_URL set to the Worker's
// address. ALLOWED_ORIGINS (comma separated) replaces the app's own
// origins below.

// The phone apps (iOS, Android), the preview, and xpn.org.
const APP_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "https://alex-colemankime.github.io",
  "https://xpn.org",
  "https://www.xpn.org",
];
const LIFETIME_DAYS = 30;
// A token with less than this left is replaced.
const RENEW_DAYS = 7;

const encoder = new TextEncoder();
const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const jsonPart = (value) => base64url(encoder.encode(JSON.stringify(value)));

// The .p8 file (PEM, PKCS #8) as the key WebCrypto signs with.
function pemBytes(pem) {
  const body = String(pem)
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// A developer token: a JWT signed ES256 with the MusicKit key, issued by
// the team, for `days`. Pure but for the clock, so it can be tested.
export async function developerToken(
  { MUSICKIT_KEY, KEY_ID, TEAM_ID },
  { now = Date.now(), days = LIFETIME_DAYS } = {},
) {
  if (!MUSICKIT_KEY || !KEY_ID || !TEAM_ID) throw new Error("MUSICKIT_KEY, KEY_ID and TEAM_ID");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(MUSICKIT_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(now / 1000);
  const unsigned = `${jsonPart({ alg: "ES256", kid: KEY_ID })}.${jsonPart({
    iss: TEAM_ID,
    iat,
    exp: iat + days * 86400,
  })}`;
  // WebCrypto signs ECDSA as r and s side by side, which is what a JWT holds.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsigned),
  );
  return { token: `${unsigned}.${base64url(signature)}`, expires: (iat + days * 86400) * 1000 };
}

// The token made last, kept while it has long enough left.
let current = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : APP_ORIGINS;
    // Requests from a browser say where they're from; only the app's are
    // answered. (The token is no secret once the app has it, but nothing
    // else needs one from WXPN.)
    if (origin && !allowed.includes(origin)) return new Response("", { status: 403 });
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return new Response("", { status: 405, headers });
    try {
      if (!current || current.expires - Date.now() < RENEW_DAYS * 86400000) {
        current = await developerToken(env);
      }
      return new Response(JSON.stringify({ token: current.token }), { headers });
    } catch {
      return new Response(JSON.stringify({ error: "not set up" }), { status: 500, headers });
    }
  },
};
