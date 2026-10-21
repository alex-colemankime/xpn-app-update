// The push sender's own logic, with no Cloudflare in it, so it can be tested
// in Node: what a registration and a notification may hold, the requests
// Google (FCM) and Apple (APNs) are sent, and the signed tokens (JWTs) that
// let the sender talk to them. worker.js does the storing and sending.

// The phone apps (iOS, Android) and the preview. ALLOWED_ORIGINS (comma
// separated) replaces these.
export const APP_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "https://alex-colemankime.github.io",
];

// "station" is every notice the station sends (what the app asks for now);
// "live" and "drives" are what the app's earlier version asked for, one
// switch per kind, and are still honored.
export const TOPICS = ["station", "live", "drives"];
// The kinds of notice staff can say a notification is; listeners who chose
// only some kinds (the earlier version) get just those.
export const KINDS = ["live", "drives", "other"];

// Bodies larger than these are refused before they are read as JSON.
export const MAX_REGISTER_BYTES = 2048;
export const MAX_SEND_BYTES = 4096;

const encoder = new TextEncoder();

const isText = (value, min, max) =>
  typeof value === "string" && value.length >= min && value.length <= max;
// A plain object, not an array or null.
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// An https address, as the app accepts one, or "".
export function httpsUrl(value) {
  if (!isText(value, 1, 2000)) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname ? url.href : "";
  } catch {
    return "";
  }
}

// The phone's token: an APNs device token (hex, which
// @capacitor/push-notifications sends upper case; 64 characters today, and
// Apple says it may grow), or an FCM token (letters, digits, - _ :). Android
// sends FCM tokens; iOS sends APNs tokens, or FCM ones once the app has
// Firebase Messaging on iOS and the sender is set to IOS_VIA="fcm".
const TOKEN_SHAPES = {
  apns: /^[0-9A-Fa-f]{64,200}$/,
  fcm: /^[A-Za-z0-9_:-]{32,500}$/,
};
const PLATFORMS = ["ios", "android"];

// How a phone's notifications go: Android's always through FCM, iOS's
// through APNs unless they were registered as FCM tokens. A record from
// before this was kept is an APNs one.
export const routeOf = (record) =>
  record.platform === "android" || record.via === "fcm" ? "fcm" : "apns";

const failure = (error) => ({ ok: false, error });

// What the app POSTs to /register:
//   { token, platform: "ios" | "android", topics: ["station"], app, version }
// The registration as stored, or why it was refused. Fields the app may add
// later are ignored rather than refused, so a new app version still
// registers. `iosVia` is the sender's IOS_VIA: "fcm" takes iOS's tokens as
// FCM tokens, and they're stored that way (`via`).
export function validateRegistration(body, { iosVia = "apns" } = {}) {
  if (!isRecord(body)) return failure("The body must be a JSON object.");
  const { token, platform, topics, app = "", version = "" } = body;
  if (!PLATFORMS.includes(platform)) {
    return failure('platform must be "ios" or "android".');
  }
  const via = platform === "android" || iosVia === "fcm" ? "fcm" : "apns";
  if (typeof token !== "string" || !TOKEN_SHAPES[via].test(token)) {
    return failure(`token isn't a${via === "apns" ? "n APNs" : "n FCM"} token.`);
  }
  if (!Array.isArray(topics) || topics.length > TOPICS.length) {
    return failure("topics must be a list.");
  }
  if (!topics.every((topic) => TOPICS.includes(topic))) {
    return failure(`topics may only be ${TOPICS.join(", ")}.`);
  }
  if (!isText(app, 0, 64) || !/^[\w.-]*$/.test(app)) return failure("app is a short id.");
  if (!isText(version, 0, 32) || !/^[\w.+-]*$/.test(version)) {
    return failure("version is a short version number.");
  }
  return {
    ok: true,
    value: {
      token,
      platform,
      ...(platform === "ios" ? { via } : {}),
      topics: [...new Set(topics)].sort(),
      app,
      version,
    },
  };
}

// What a tap opens, as push.js reads it (pushTarget):
//   { action: "watch", watch: "https://…", title: "…" }   a video, in the app
//   { action: "open", url: "https://…" }                   a page
//   { action: "listen", stream: "xpn" }                    a station, playing
// None at all just opens the app. The data as it will be sent, or why not.
export function validateData(data) {
  if (data === undefined || data === null) return { ok: true, value: null };
  if (!isRecord(data)) return failure("data must be an object.");
  if (data.action === "watch") {
    const watch = httpsUrl(data.watch);
    if (!watch) return failure("A video needs its https address.");
    const title = data.title ?? "";
    if (!isText(title, 0, 200)) return failure("The video's title is too long.");
    return { ok: true, value: { action: "watch", watch, title } };
  }
  if (data.action === "open") {
    const url = httpsUrl(data.url);
    if (!url) return failure("A link must be an https address.");
    return { ok: true, value: { action: "open", url } };
  }
  if (data.action === "listen") {
    const stream = data.stream ?? "xpn";
    if (typeof stream !== "string" || !/^[a-z0-9-]{1,32}$/.test(stream)) {
      return failure("stream is a station id, like xpn.");
    }
    return { ok: true, value: { action: "listen", stream } };
  }
  return failure('action must be "watch", "open" or "listen".');
}

// What staff POST to /send: { title, body, data, kind }. `kind` (optional)
// is "live", "drives" or "other"; `cursor` is where the last page left off.
export function validateMessage(input) {
  if (!isRecord(input)) return failure("The body must be a JSON object.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!isText(title, 1, 100)) return failure("A title is needed, at most 100 characters.");
  if (!isText(body, 1, 400)) return failure("A message is needed, at most 400 characters.");
  const kind = input.kind ?? "other";
  if (!KINDS.includes(kind)) return failure(`kind must be ${KINDS.join(", ")}.`);
  const cursor = input.cursor ?? null;
  if (cursor !== null && !isText(cursor, 1, 1000)) return failure("cursor isn't one of ours.");
  const data = validateData(input.data);
  if (!data.ok) return data;
  return { ok: true, value: { title, body, data: data.value, kind, cursor } };
}

// Whether a phone with these topics gets a notice of this kind.
export const wants = (topics, kind) =>
  topics.includes("station") || (kind !== "other" && topics.includes(kind));

// The CORS headers for a request from `origin`, or null when that origin
// may not ask. Requests with no Origin (curl, a server) aren't a browser's
// and need none.
export function corsHeaders(origin, allowed = APP_ORIGINS) {
  if (!origin) return {};
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// The allowed origins, from ALLOWED_ORIGINS when it is set.
export const allowedOrigins = (env) =>
  env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : APP_ORIGINS;

// Whether two strings match, taking as long whatever the difference, so the
// send key can't be guessed a character at a time.
export function sameSecret(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = encoder.encode(given);
  const b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

// --- Notifications as FCM and APNs take them -------------------------------

// The data as both services carry it: string values only (FCM's rule).
export function dataStrings(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) out[key] = String(value);
  return out;
}

// The body APNs is sent: the alert in `aps`, the tap's data beside it, which
// the app reads as the notification's data (iOS hands the plugin the whole
// payload).
export function apnsPayload({ title, body, data }) {
  return {
    aps: { alert: { title, body }, sound: "default" },
    ...dataStrings(data),
  };
}

// The headers APNs is sent with a notification.
export const apnsHeaders = (jwt, bundleId) => ({
  authorization: `bearer ${jwt}`,
  "apns-topic": bundleId,
  "apns-push-type": "alert",
  "apns-priority": "10",
  "content-type": "application/json",
});

// The body FCM's HTTP v1 API is sent for one token. Android shows the
// notification part itself and hands the data to the app on a tap. The
// `apns` part is used only for iOS tokens sent through FCM (IOS_VIA=fcm,
// once the app has the Firebase iOS SDK); FCM ignores it for Android.
export function fcmMessage(token, { title, body, data }) {
  return {
    message: {
      token,
      notification: { title, body },
      data: dataStrings(data),
      android: { priority: "HIGH", notification: { sound: "default" } },
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: { aps: { sound: "default" } },
      },
    },
  };
}

// Whether a service's answer says the token is dead, so it is forgotten:
// FCM: 404, or an error detail of UNREGISTERED.
export function fcmTokenGone(status, answer) {
  if (status === 404) return true;
  const details = answer?.error?.details;
  return Array.isArray(details) && details.some((d) => d && d.errorCode === "UNREGISTERED");
}
// APNs: 410 (the app was removed), or 400 BadDeviceToken.
export const apnsTokenGone = (status, answer) =>
  status === 410 || (status === 400 && answer?.reason === "BadDeviceToken");

// --- Signed tokens (JWTs) ---------------------------------------------------

export const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const jsonPart = (value) => base64url(encoder.encode(JSON.stringify(value)));

// A PEM private key (PKCS #8: Apple's .p8 file, a Google service account's
// private_key) as bytes WebCrypto can import.
export function pemBytes(pem) {
  const body = String(pem)
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

const ALGORITHMS = {
  // APNs: ECDSA P-256. WebCrypto signs it as r and s side by side, which
  // is what a JWT holds.
  ES256: {
    importAs: { name: "ECDSA", namedCurve: "P-256" },
    signAs: { name: "ECDSA", hash: "SHA-256" },
  },
  // Google: RSA with SHA-256.
  RS256: {
    importAs: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    signAs: { name: "RSASSA-PKCS1-v1_5" },
  },
};

// A JWT with these header fields and claims, signed with the PEM key.
export async function signJwt(header, claims, pem) {
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm) throw new Error(`Unknown JWT algorithm ${header.alg}`);
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(pem), algorithm.importAs, false, [
    "sign",
  ]);
  const unsigned = `${jsonPart({ typ: "JWT", ...header })}.${jsonPart(claims)}`;
  const signature = await crypto.subtle.sign(algorithm.signAs, key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

// The token APNs accepts in place of a certificate: ES256 with the .p8
// key, its id and the team. Apple takes one for up to an hour.
export async function apnsJwt({ APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID }, now = Date.now()) {
  if (!APNS_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID) {
    throw new Error("APNS_KEY_P8, APNS_KEY_ID and APNS_TEAM_ID are needed for iOS.");
  }
  return signJwt(
    { alg: "ES256", kid: APNS_KEY_ID },
    { iss: APNS_TEAM_ID, iat: Math.floor(now / 1000) },
    APNS_KEY_P8,
  );
}

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// The service account JSON (FCM_SERVICE_ACCOUNT), read and checked.
export function serviceAccount(json) {
  let account;
  try {
    account = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    throw new Error("FCM_SERVICE_ACCOUNT isn't JSON.");
  }
  if (!account?.client_email || !account?.private_key || !account?.project_id) {
    throw new Error("FCM_SERVICE_ACCOUNT needs client_email, private_key and project_id.");
  }
  return account;
}

// The signed request for a Google access token (OAuth 2.0's JWT bearer
// flow), good for an hour.
export async function googleAssertion(account, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  return signJwt(
    { alg: "RS256", kid: account.private_key_id },
    {
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: account.token_uri || GOOGLE_TOKEN_URL,
      iat,
      exp: iat + 3600,
    },
    account.private_key,
  );
}

// Run `work` on each item, at most `limit` at a time, in order of results.
export async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
