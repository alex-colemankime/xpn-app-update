// WXPN's push sender: a Cloudflare Worker that keeps the phones' push tokens
// and sends the station's notifications to them, through Google (FCM) for
// Android and Apple (APNs) for iOS. No npm packages; signing is WebCrypto.
//
//   POST /register   the app's registration (push.js; VITE_PUSH_REGISTER_URL)
//   POST /send       staff only (the send key): one notification to everyone
//   GET  /           the sending page for staff
//
// Setup is in README.md beside this file. The rules (what a registration and
// a notification may hold, the requests to Google and Apple) are in core.js.

import {
  MAX_REGISTER_BYTES,
  MAX_SEND_BYTES,
  allowedOrigins,
  apnsHeaders,
  apnsJwt,
  apnsPayload,
  apnsTokenGone,
  corsHeaders,
  fcmMessage,
  fcmTokenGone,
  googleAssertion,
  GOOGLE_TOKEN_URL,
  mapLimit,
  sameSecret,
  serviceAccount,
  validateMessage,
  validateRegistration,
  wants,
} from "./core.js";
import { sendPage } from "./page.js";

// Tokens are kept in KV under this prefix, each with its record as metadata
// too, so a send reads a page of them in one list.
const PREFIX = "token:";
// How many tokens one /send request handles. Cloudflare's free plan allows
// 50 outside requests per request (the paid plan, 1,000), and the sending
// page asks for the next page until all are done. PAGE_SIZE changes it.
const PAGE_SIZE = 40;
// How many notifications are under way at once. CONCURRENCY changes it.
const CONCURRENCY = 6;
// When every one of at least this many tokens on a platform comes back
// "gone", the setup is more likely wrong than the tokens (a sandbox build's
// tokens sent to production, another Firebase project), so none are removed.
const SUSPICIOUS = 5;

const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

// The request's body as JSON, refusing any larger than `max` bytes.
async function readJson(request, max) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > max) return { error: "Too large.", status: 413 };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > max) return { error: "Too large.", status: 413 };
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "The body isn't JSON.", status: 400 };
  }
}

const sameList = (a = [], b = []) => a.join(",") === b.join(",");

// --- /register ---------------------------------------------------------------

async function register(request, env) {
  const cors = corsHeaders(request.headers.get("Origin"), allowedOrigins(env));
  if (!cors) return json({ error: "Not from the app." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "POST only." }, 405, cors);

  const body = await readJson(request, MAX_REGISTER_BYTES);
  if (body.error) return json({ error: body.error }, body.status, cors);
  const checked = validateRegistration(body.value);
  if (!checked.ok) return json({ error: checked.error }, 400, cors);
  const { token, platform, topics, version } = checked.value;
  const key = PREFIX + token;

  // No topics: the listener turned notifications off, so the token goes.
  if (!topics.length) {
    await env.TOKENS.delete(key);
    return json({ ok: true, subscribed: false }, 200, cors);
  }
  // The same again (a reinstall, a retry) isn't written twice: KV's free
  // plan allows 1,000 writes a day, and 100,000 reads.
  const known = await env.TOKENS.get(key, "json");
  if (known?.platform === platform && sameList(known.topics, topics) && known.version === version) {
    return json({ ok: true, subscribed: true }, 200, cors);
  }
  const record = { platform, topics, version, updatedAt: new Date().toISOString() };
  await env.TOKENS.put(key, JSON.stringify(record), { metadata: record });
  return json({ ok: true, subscribed: true }, 200, cors);
}

// --- Credentials, kept between requests while they're good -------------------

let google = null; // { email, token, expires }
let apple = null; // { keyId, jwt, made }

// For tests: forget the access tokens made so far.
export function forgetCredentials() {
  google = null;
  apple = null;
}

// A Google access token for FCM, from the service account (an hour each;
// a new one five minutes before that).
async function googleToken(account) {
  if (google?.email === account.client_email && google.expires > Date.now()) return google.token;
  const response = await fetch(account.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await googleAssertion(account),
    }),
  });
  const answer = await response.json().catch(() => ({}));
  if (!response.ok || !answer.access_token) {
    throw new Error(`Google refused the service account (${answer.error || response.status}).`);
  }
  const lifetime = Number(answer.expires_in) || 3600;
  google = {
    email: account.client_email,
    token: answer.access_token,
    expires: Date.now() + (lifetime - 300) * 1000,
  };
  return google.token;
}

// The APNs token, made again after 40 minutes (Apple takes one for an hour
// and asks that it not be made more often than every 20 minutes).
async function appleToken(env) {
  if (apple?.keyId === env.APNS_KEY_ID && Date.now() - apple.made < 40 * 60000) return apple.jwt;
  apple = { keyId: env.APNS_KEY_ID, jwt: await apnsJwt(env), made: Date.now() };
  return apple.jwt;
}

const apnsHost = (env) =>
  env.APNS_SANDBOX === "true"
    ? "api.sandbox.push.apple.com"
    : env.APNS_HOST || "api.push.apple.com";

// --- Sending one ---------------------------------------------------------------

// "sent", "gone" (the token is dead) or an Error (anything else).
async function sendFcm(token, message, { account, accessToken }) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(fcmMessage(token, message)),
    },
  );
  if (response.ok) return "sent";
  const answer = await response.json().catch(() => ({}));
  if (fcmTokenGone(response.status, answer)) return "gone";
  if (response.status === 401) google = null;
  return new Error(`FCM ${response.status} ${answer?.error?.status || ""}`.trim());
}

async function sendApns(token, message, { env, jwt }) {
  const response = await fetch(`https://${apnsHost(env)}/3/device/${token}`, {
    method: "POST",
    headers: apnsHeaders(jwt, env.APNS_BUNDLE_ID || "org.xpn.wxpn"),
    body: JSON.stringify(apnsPayload(message)),
  });
  if (response.ok) return "sent";
  const answer = await response.json().catch(() => ({}));
  if (apnsTokenGone(response.status, answer)) return "gone";
  if (answer?.reason === "ExpiredProviderToken" || answer?.reason === "InvalidProviderToken") {
    apple = null;
  }
  return new Error(`APNs ${response.status} ${answer?.reason || ""}`.trim());
}

// How each platform's tokens are sent, set up once per request: a function
// per platform, or the Error that stopped it being set up.
async function senders(env, platforms) {
  const out = {};
  const viaFcm = (platform) => platform === "android" || env.IOS_VIA === "fcm";
  if (platforms.some(viaFcm)) {
    let fcm;
    try {
      const account = serviceAccount(env.FCM_SERVICE_ACCOUNT);
      const accessToken = await googleToken(account);
      fcm = (token, message) => sendFcm(token, message, { account, accessToken });
    } catch (error) {
      fcm = error;
    }
    for (const platform of platforms.filter(viaFcm)) out[platform] = fcm;
  }
  if (platforms.includes("ios") && !viaFcm("ios")) {
    try {
      const jwt = await appleToken(env);
      out.ios = (token, message) => sendApns(token, message, { env, jwt });
    } catch (error) {
      out.ios = error;
    }
  }
  return out;
}

// The tokens on one page of KV, with their records.
async function tokenPage(env, cursor, limit) {
  const page = await env.TOKENS.list({ prefix: PREFIX, limit, ...(cursor ? { cursor } : {}) });
  const tokens = await Promise.all(
    page.keys.map(async ({ name, metadata }) => ({
      token: name.slice(PREFIX.length),
      record: metadata?.platform ? metadata : await env.TOKENS.get(name, "json"),
    })),
  );
  return {
    tokens: tokens.filter((t) => t.record?.platform),
    cursor: page.list_complete ? null : page.cursor,
  };
}

// --- /send -----------------------------------------------------------------------

async function send(request, env) {
  if (request.method !== "POST") return json({ error: "POST only." }, 405);
  if (!env.SEND_KEY) return json({ error: "SEND_KEY isn't set on the Worker." }, 503);
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!sameSecret(given, env.SEND_KEY)) {
    return json({ error: "The send key isn't right." }, 401, { "WWW-Authenticate": "Bearer" });
  }
  const body = await readJson(request, MAX_SEND_BYTES);
  if (body.error) return json({ error: body.error }, body.status);
  const checked = validateMessage(body.value);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const message = checked.value;

  const pageSize = Math.min(Number(env.PAGE_SIZE) || PAGE_SIZE, 1000);
  const page = await tokenPage(env, message.cursor, pageSize);
  const targets = page.tokens.filter((t) => wants(t.record.topics || [], message.kind));
  const how = await senders(env, [...new Set(targets.map((t) => t.record.platform))]);

  const outcomes = await mapLimit(
    targets,
    Number(env.CONCURRENCY) || CONCURRENCY,
    async ({ token, record }) => {
      const sender = how[record.platform];
      if (typeof sender !== "function") return sender || new Error("Unknown platform");
      try {
        return await sender(token, message);
      } catch (error) {
        return error;
      }
    },
  );

  // Dead tokens are forgotten, unless every one on a platform came back dead.
  const counts = { sent: 0, failed: 0, removed: 0 };
  const errors = new Set();
  const warnings = [];
  const gone = { ios: [], android: [] };
  const tried = { ios: 0, android: 0 };
  outcomes.forEach((outcome, i) => {
    const { token, record } = targets[i];
    tried[record.platform]++;
    if (outcome === "sent") counts.sent++;
    else if (outcome === "gone") gone[record.platform].push(token);
    else {
      counts.failed++;
      errors.add(outcome.message);
    }
  });
  const removing = [];
  for (const platform of Object.keys(gone)) {
    const dead = gone[platform];
    if (dead.length >= SUSPICIOUS && dead.length === tried[platform]) {
      counts.failed += dead.length;
      warnings.push(
        `Every ${platform} token was refused as unknown, so none were removed. ` +
          (platform === "ios"
            ? "Check APNS_SANDBOX / APNS_HOST and APNS_BUNDLE_ID."
            : "Check that FCM_SERVICE_ACCOUNT is the app's Firebase project."),
      );
    } else {
      counts.removed += dead.length;
      removing.push(...dead);
    }
  }
  await Promise.all(removing.map((token) => env.TOKENS.delete(PREFIX + token)));

  return json({
    ...counts,
    skipped: page.tokens.length - targets.length,
    cursor: page.cursor,
    errors: [...errors].slice(0, 5),
    warnings,
  });
}

// --- The sending page ----------------------------------------------------------------

function page() {
  const nonce = base64Nonce();
  return new Response(sendPage(nonce), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        `style-src 'nonce-${nonce}'`,
        "connect-src 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join("; "),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const base64Nonce = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/register") return await register(request, env);
      if (pathname === "/send") return await send(request, env);
      if (pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
        return page();
      }
      return json({ error: "Not here." }, 404);
    } catch (error) {
      // KV or a service being down; the app tries again later.
      console.error(error);
      return json({ error: "Something went wrong; try again." }, 500);
    }
  },
};
