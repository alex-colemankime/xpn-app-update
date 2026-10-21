// The push sender (services/push-sender): what a registration and a
// notification may hold, the app's origins only, tokens kept and forgotten
// in KV, staff-only sending, the requests Google and Apple are sent (signed
// as they expect), and dead tokens cleaned up. Google and Apple are
// stand-ins here (fetch is replaced); the real services are untested.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { forgetCredentials } from "../services/push-sender/worker.js";
import {
  apnsPayload,
  corsHeaders,
  fcmMessage,
  fcmTokenGone,
  apnsTokenGone,
  googleAssertion,
  apnsJwt,
  mapLimit,
  sameSecret,
  validateData,
  validateMessage,
  validateRegistration,
  wants,
} from "../services/push-sender/core.js";

// --- Stand-in keys, as Google's service account and Apple's .p8 hold them ---

const pemOf = (der) =>
  `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der)
    .toString("base64")
    .replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
const rsa = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const ec = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const account = {
  type: "service_account",
  project_id: "wxpn-test",
  private_key_id: "kid123",
  // As the JSON file has it: newlines escaped.
  private_key: pemOf(await crypto.subtle.exportKey("pkcs8", rsa.privateKey)),
  client_email: "push@wxpn-test.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
};
const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());
const verifies = (algorithm, key, jwt) => {
  const [h, p, s] = jwt.split(".");
  return crypto.subtle.verify(
    algorithm,
    key,
    Buffer.from(s, "base64url"),
    new TextEncoder().encode(`${h}.${p}`),
  );
};

// --- A KV namespace in memory ---------------------------------------------------

function fakeKv() {
  const map = new Map();
  return {
    map,
    writes: 0,
    async get(key, type) {
      const entry = map.get(key);
      if (!entry) return null;
      return type === "json" ? JSON.parse(entry.value) : entry.value;
    },
    async put(key, value, { metadata } = {}) {
      this.writes++;
      map.set(key, { value, metadata });
    },
    async delete(key) {
      map.delete(key);
    },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const names = [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = names.slice(start, start + limit);
      const done = start + limit >= names.length;
      return {
        keys: slice.map((name) => ({ name, metadata: map.get(name).metadata })),
        list_complete: done,
        ...(done ? {} : { cursor: String(start + limit) }),
      };
    },
  };
}

// --- Google and Apple, stood in for ---------------------------------------------

const IOS = "A1B2C3D4".repeat(8); // 64 hex characters, as the plugin sends
const ANDROID = `fcm${"x".repeat(20)}:APA91b${"Q_r-9".repeat(28)}`;
const iosToken = (n) => n.toString(16).toUpperCase().padStart(64, "0");
const androidToken = (n) => `${ANDROID.slice(0, -4)}${String(n).padStart(4, "0")}`;

let calls;
let dead; // tokens the services say are gone
let realFetch;
beforeEach(() => {
  calls = [];
  dead = new Set();
  forgetCredentials();
  realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const body = typeof init.body === "string" ? init.body : String(init.body ?? "");
    calls.push({ url, headers: init.headers || {}, body });
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(body).get("assertion");
      const ok = await verifies({ name: "RSASSA-PKCS1-v1_5" }, rsa.publicKey, assertion);
      return ok
        ? Response.json({ access_token: "ya29.test", expires_in: 3600 })
        : Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (url.startsWith("https://fcm.googleapis.com/v1/projects/wxpn-test/messages:send")) {
      const { token } = JSON.parse(body).message;
      if (dead.has(token)) {
        return Response.json(
          {
            error: {
              code: 404,
              status: "NOT_FOUND",
              details: [
                {
                  "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                  errorCode: "UNREGISTERED",
                },
              ],
            },
          },
          { status: 404 },
        );
      }
      return Response.json({ name: "projects/wxpn-test/messages/1" });
    }
    const apns = url.match(/^https:\/\/api(\.sandbox)?\.push\.apple\.com\/3\/device\/(\w+)$/);
    if (apns) {
      if (dead.has(apns[2])) return Response.json({ reason: "Unregistered" }, { status: 410 });
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const env = (extra = {}) => ({
  TOKENS: fakeKv(),
  SEND_KEY: "correct horse battery staple",
  FCM_SERVICE_ACCOUNT: JSON.stringify(account),
  APNS_KEY_ID: "KEY1234567",
  APNS_TEAM_ID: "TEAM123456",
  APNS_BUNDLE_ID: "org.xpn.wxpn",
  ...extra,
});
const apnsKey = pemOf(await crypto.subtle.exportKey("pkcs8", ec.privateKey));
const setup = (extra) => env({ APNS_KEY_P8: apnsKey, ...extra });

const call = (e, path, { method = "POST", body, headers = {} } = {}) =>
  worker.fetch(
    new Request(`https://push.test${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    e,
  );
const registration = (token, platform, topics = ["station"]) => ({
  token,
  platform,
  topics,
  app: "org.xpn.wxpn",
  version: "1.0.0",
});
const fromApp = { Origin: "capacitor://localhost" };
const staff = (e) => ({ Authorization: `Bearer ${e.SEND_KEY}` });

// --- Validation -----------------------------------------------------------------------

test("a registration as push.js sends it is accepted", () => {
  for (const [token, platform] of [
    [IOS, "ios"],
    [ANDROID, "android"],
  ]) {
    const checked = validateRegistration(registration(token, platform));
    assert.ok(checked.ok, checked.error);
    assert.deepEqual(checked.value.topics, ["station"]);
  }
  // The earlier version's topics, and none (turned off), and no version.
  assert.ok(validateRegistration(registration(IOS, "ios", ["live", "drives"])).ok);
  assert.ok(validateRegistration(registration(IOS, "ios", [])).ok);
  assert.ok(validateRegistration({ token: IOS, platform: "ios", topics: [], version: "" }).ok);
});

test("anything else isn't", () => {
  const bad = [
    null,
    [],
    "token",
    { ...registration(IOS, "ios"), platform: "web" },
    { ...registration(IOS, "ios"), token: "abc" },
    { ...registration(IOS, "ios"), token: "Z".repeat(64) },
    { ...registration(IOS, "ios"), token: 12345 },
    { ...registration(ANDROID, "ios") }, // an FCM token claiming to be iOS
    { ...registration("a".repeat(501), "android") },
    { ...registration(ANDROID, "android"), token: `${ANDROID} ` },
    { ...registration(IOS, "ios"), topics: "station" },
    { ...registration(IOS, "ios"), topics: ["everything"] },
    { ...registration(IOS, "ios"), topics: [1] },
    { ...registration(IOS, "ios"), topics: ["station", "live", "drives", "station"] },
    { ...registration(IOS, "ios"), app: "x".repeat(65) },
    { ...registration(IOS, "ios"), app: "<script>" },
    { ...registration(IOS, "ios"), version: "1".repeat(33) },
    { ...registration(IOS, "ios"), version: 1 },
  ];
  for (const body of bad) {
    assert.equal(validateRegistration(body).ok, false, JSON.stringify(body)?.slice(0, 80));
  }
});

test("a tap's data takes the three shapes push.js reads, https only", () => {
  assert.deepEqual(validateData({ action: "listen", stream: "xpn2" }).value, {
    action: "listen",
    stream: "xpn2",
  });
  assert.deepEqual(validateData({ action: "listen" }).value, { action: "listen", stream: "xpn" });
  assert.deepEqual(validateData({ action: "open", url: "https://xpn.org/donate/" }).value, {
    action: "open",
    url: "https://xpn.org/donate/",
  });
  assert.deepEqual(
    validateData({ action: "watch", watch: "https://youtu.be/abc", title: "Free at Noon" }).value,
    { action: "watch", watch: "https://youtu.be/abc", title: "Free at Noon" },
  );
  assert.equal(validateData(undefined).value, null, "none just opens the app");
  for (const data of [
    { action: "open", url: "http://xpn.org/" },
    { action: "open", url: "javascript:alert(1)" },
    { action: "open" },
    { action: "watch", watch: "ftp://x.test/v" },
    { action: "watch", watch: "https://youtu.be/a", title: "t".repeat(201) },
    { action: "listen", stream: "../etc" },
    { action: "launch" },
    [],
    "open",
  ]) {
    assert.equal(validateData(data).ok, false, JSON.stringify(data));
  }
});

test("a notification needs a title and a message of reasonable length", () => {
  const ok = validateMessage({ title: " Live now ", body: "Dawes, from the Free at Noon stage" });
  assert.deepEqual(ok.value, {
    title: "Live now",
    body: "Dawes, from the Free at Noon stage",
    data: null,
    kind: "other",
    cursor: null,
  });
  for (const input of [
    {},
    { title: "", body: "x" },
    { title: "x", body: "   " },
    { title: "x".repeat(101), body: "x" },
    { title: "x", body: "x".repeat(401) },
    { title: "x", body: "x", kind: "spam" },
    { title: "x", body: "x", data: { action: "open", url: "http://x.test" } },
  ]) {
    assert.equal(validateMessage(input).ok, false, JSON.stringify(input));
  }
});

test("everyone on the station's topic gets every kind; the earlier version's, only theirs", () => {
  assert.ok(wants(["station"], "other"));
  assert.ok(wants(["station"], "live"));
  assert.ok(wants(["drives", "live"], "live"));
  assert.equal(wants(["drives"], "live"), false);
  assert.equal(wants(["live", "drives"], "other"), false);
});

test("the send key comparison", () => {
  assert.ok(sameSecret("abc", "abc"));
  assert.equal(sameSecret("abd", "abc"), false);
  assert.equal(sameSecret("ab", "abc"), false);
  assert.equal(sameSecret("abcd", "abc"), false);
  assert.equal(sameSecret("", ""), false, "no key set never matches");
  assert.equal(sameSecret(undefined, "abc"), false);
});

test("CORS: only the app's origins", () => {
  for (const origin of [
    "capacitor://localhost",
    "https://localhost",
    "https://alex-colemankime.github.io",
  ]) {
    assert.equal(corsHeaders(origin)["Access-Control-Allow-Origin"], origin);
  }
  assert.equal(corsHeaders("https://evil.example"), null);
  assert.deepEqual(corsHeaders(""), {}, "not a browser");
});

// --- What Google and Apple are sent ---------------------------------------------------

const notice = {
  title: "Live now",
  body: "Dawes at Free at Noon",
  data: { action: "watch", watch: "https://youtu.be/abc", title: "Dawes" },
};

test("FCM's message: the notification, the data as strings, high priority", () => {
  const { message } = fcmMessage(ANDROID, notice);
  assert.equal(message.token, ANDROID);
  assert.deepEqual(message.notification, { title: "Live now", body: "Dawes at Free at Noon" });
  assert.deepEqual(message.data, notice.data);
  assert.equal(message.android.priority, "HIGH");
  assert.deepEqual(fcmMessage(ANDROID, { ...notice, data: null }).message.data, {});
  const listen = fcmMessage(ANDROID, { ...notice, data: { action: "listen", stream: "xpn" } });
  assert.ok(Object.values(listen.message.data).every((v) => typeof v === "string"));
});

test("APNs's payload: the alert in aps, the data beside it where the app looks", () => {
  assert.deepEqual(apnsPayload(notice), {
    aps: { alert: { title: "Live now", body: "Dawes at Free at Noon" }, sound: "default" },
    action: "watch",
    watch: "https://youtu.be/abc",
    title: "Dawes",
  });
});

test("which answers mean the token is gone", () => {
  assert.ok(fcmTokenGone(404, {}));
  assert.ok(fcmTokenGone(400, { error: { details: [{ errorCode: "UNREGISTERED" }] } }));
  assert.equal(
    fcmTokenGone(400, { error: { details: [{ errorCode: "INVALID_ARGUMENT" }] } }),
    false,
  );
  assert.equal(fcmTokenGone(500, {}), false);
  assert.ok(apnsTokenGone(410, { reason: "Unregistered" }));
  assert.ok(apnsTokenGone(400, { reason: "BadDeviceToken" }));
  assert.equal(apnsTokenGone(400, { reason: "PayloadTooLarge" }), false);
  assert.equal(apnsTokenGone(403, { reason: "ExpiredProviderToken" }), false);
});

test("Google's assertion: RS256 by the service account, for FCM, an hour", async () => {
  const now = Date.UTC(2026, 9, 21);
  const jwt = await googleAssertion(
    { ...account, private_key: account.private_key.replace(/\n/g, "\\n") },
    now,
  );
  const [header, claims] = jwt.split(".").slice(0, 2).map(decode);
  assert.deepEqual(header, { typ: "JWT", alg: "RS256", kid: "kid123" });
  assert.deepEqual(claims, {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now / 1000,
    exp: now / 1000 + 3600,
  });
  assert.ok(await verifies({ name: "RSASSA-PKCS1-v1_5" }, rsa.publicKey, jwt));
});

test("Apple's token: ES256 with the key id, issued by the team", async () => {
  const now = Date.UTC(2026, 9, 21);
  const jwt = await apnsJwt(setup(), now);
  const [header, claims] = jwt.split(".").slice(0, 2).map(decode);
  assert.deepEqual(header, { typ: "JWT", alg: "ES256", kid: "KEY1234567" });
  assert.deepEqual(claims, { iss: "TEAM123456", iat: now / 1000 });
  assert.ok(await verifies({ name: "ECDSA", hash: "SHA-256" }, ec.publicKey, jwt));
  await assert.rejects(() => apnsJwt({}), /APNS_KEY_P8/);
});

test("mapLimit keeps to its limit and the order", async () => {
  let running = 0;
  let most = 0;
  const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
    most = Math.max(most, ++running);
    await new Promise((r) => setTimeout(r, n));
    running--;
    return n * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
  assert.equal(most, 2);
});

// --- The Worker -------------------------------------------------------------------------

test("register, re-register (no second write), unregister", async () => {
  const e = setup();
  const first = await call(e, "/register", { body: registration(IOS, "ios"), headers: fromApp });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  const stored = await e.TOKENS.get(`token:${IOS}`, "json");
  assert.equal(stored.platform, "ios");
  assert.deepEqual(stored.topics, ["station"]);
  assert.equal(stored.version, "1.0.0");
  assert.match(stored.updatedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(e.TOKENS.map.get(`token:${IOS}`).metadata, stored, "listable in one go");

  await call(e, "/register", { body: registration(IOS, "ios"), headers: fromApp });
  assert.equal(e.TOKENS.writes, 1, "the same again isn't written");

  const off = await call(e, "/register", { body: registration(IOS, "ios", []), headers: fromApp });
  assert.equal(off.status, 200);
  assert.equal(await e.TOKENS.get(`token:${IOS}`), null, "empty topics forgets the token");
});

test("register: preflight, other sites, bad and oversized bodies", async () => {
  const e = setup();
  const preflight = await call(e, "/register", {
    method: "OPTIONS",
    headers: { ...fromApp, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
  assert.match(preflight.headers.get("Access-Control-Allow-Methods"), /POST/);

  const elsewhere = await call(e, "/register", {
    body: registration(IOS, "ios"),
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(elsewhere.status, 403);

  const bad = await call(e, "/register", {
    body: { ...registration(IOS, "ios"), platform: "web" },
    headers: fromApp,
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  assert.equal((await call(e, "/register", { body: "{not json", headers: fromApp })).status, 400);

  const huge = { ...registration(IOS, "ios"), padding: "x".repeat(3000) };
  assert.equal((await call(e, "/register", { body: huge, headers: fromApp })).status, 413);
  assert.equal(
    (await call(e, "/register", { method: "GET", headers: fromApp })).status,
    405,
    "POST only",
  );
  assert.equal(e.TOKENS.map.size, 0);
  assert.equal(calls.length, 0, "registering never reaches Google or Apple");
});

test("send needs the send key, and the Worker to have one", async () => {
  const e = setup();
  const message = { title: "Hi", body: "There" };
  assert.equal((await call(e, "/send", { body: message })).status, 401);
  const wrong = await call(e, "/send", { body: message, headers: { Authorization: "Bearer no" } });
  assert.equal(wrong.status, 401);
  assert.equal(
    (await call(setup({ SEND_KEY: "" }), "/send", { body: message, headers: staff(e) })).status,
    503,
  );
  assert.equal(
    (await call(e, "/send", { body: { title: "Hi" }, headers: staff(e) })).status,
    400,
    "a message is needed",
  );
  assert.equal(calls.length, 0);
});

async function registered(e, list) {
  for (const [token, platform, topics] of list) {
    const r = await call(e, "/register", {
      body: registration(token, platform, topics),
      headers: fromApp,
    });
    assert.equal(r.status, 200);
  }
}

test("send reaches every phone, through FCM and APNs, and forgets dead tokens", async () => {
  const e = setup();
  const deadIos = iosToken(2);
  const deadAndroid = androidToken(2);
  await registered(e, [
    [iosToken(1), "ios"],
    [deadIos, "ios"],
    [androidToken(1), "android"],
    [deadAndroid, "android"],
    [androidToken(3), "android", ["drives"]], // the earlier version, drives only
  ]);
  dead.add(deadIos).add(deadAndroid);

  const response = await call(e, "/send", { body: notice, headers: staff(e) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(
    { sent: result.sent, failed: result.failed, removed: result.removed, skipped: result.skipped },
    { sent: 2, failed: 0, removed: 2, skipped: 1 },
  );
  assert.equal(result.cursor, null);
  assert.equal(await e.TOKENS.get(`token:${deadIos}`), null);
  assert.equal(await e.TOKENS.get(`token:${deadAndroid}`), null);
  assert.ok(await e.TOKENS.get(`token:${iosToken(1)}`), "live tokens stay");

  // One Google access token, then each phone.
  assert.equal(calls.filter((c) => c.url.includes("oauth2")).length, 1);
  const fcm = calls.find((c) => c.url.includes("fcm.googleapis.com"));
  assert.equal(fcm.headers.Authorization, "Bearer ya29.test");
  assert.deepEqual(JSON.parse(fcm.body).message.data, notice.data);
  const apns = calls.find((c) => c.url.startsWith(`https://api.push.apple.com/3/device/`));
  assert.equal(apns.headers["apns-topic"], "org.xpn.wxpn");
  assert.equal(apns.headers["apns-push-type"], "alert");
  assert.match(apns.headers.authorization, /^bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  assert.deepEqual(JSON.parse(apns.body), apnsPayload(notice));

  // A second send reuses both credentials.
  calls = [];
  await call(e, "/send", { body: notice, headers: staff(e) });
  assert.equal(calls.filter((c) => c.url.includes("oauth2")).length, 0);
});

test("a drive notice reaches the earlier version's drives listeners too", async () => {
  const e = setup();
  await registered(e, [
    [androidToken(1), "android", ["drives"]],
    [androidToken(2), "android", ["live"]],
  ]);
  const result = await (
    await call(e, "/send", { body: { ...notice, kind: "drives" }, headers: staff(e) })
  ).json();
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, 1);
});

test("send goes a page at a time, with a cursor for the next", async () => {
  const e = setup({ PAGE_SIZE: "2" });
  await registered(
    e,
    [1, 2, 3, 4, 5].map((n) => [androidToken(n), "android"]),
  );
  let cursor = null;
  let sent = 0;
  let pages = 0;
  do {
    const result = await (
      await call(e, "/send", { body: { ...notice, cursor }, headers: staff(e) })
    ).json();
    sent += result.sent;
    cursor = result.cursor;
    pages++;
  } while (cursor);
  assert.equal(sent, 5);
  assert.equal(pages, 3);
});

test("every token refused at once looks like a setup mistake: none are removed", async () => {
  const e = setup({ APNS_SANDBOX: "true" });
  const tokens = [1, 2, 3, 4, 5].map(iosToken);
  await registered(
    e,
    tokens.map((t) => [t, "ios"]),
  );
  tokens.forEach((t) => dead.add(t));
  const result = await (await call(e, "/send", { body: notice, headers: staff(e) })).json();
  assert.equal(result.removed, 0);
  assert.equal(result.failed, 5);
  assert.match(result.warnings[0], /APNS_SANDBOX/);
  assert.equal(e.TOKENS.map.size, 5);
  assert.ok(calls.some((c) => c.url.startsWith("https://api.sandbox.push.apple.com/")));
});

test("a platform that isn't set up fails its phones, and the rest still go", async () => {
  const e = setup({ APNS_KEY_P8: "" });
  await registered(e, [
    [iosToken(1), "ios"],
    [androidToken(1), "android"],
  ]);
  const result = await (await call(e, "/send", { body: notice, headers: staff(e) })).json();
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.match(result.errors[0], /APNS_KEY_P8/);
});

test("IOS_VIA=fcm sends iOS through FCM", async () => {
  const e = setup({ IOS_VIA: "fcm" });
  await registered(e, [[iosToken(1), "ios"]]);
  const result = await (await call(e, "/send", { body: notice, headers: staff(e) })).json();
  assert.equal(result.sent, 1);
  assert.ok(calls.some((c) => c.url.includes("fcm.googleapis.com")));
  assert.ok(!calls.some((c) => c.url.includes("push.apple.com")));
});

test("the sending page: the form, locked down", async () => {
  const response = await call(setup(), "/", { method: "GET" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  const csp = response.headers.get("Content-Security-Policy");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const nonce = csp.match(/script-src 'nonce-([^']+)'/)[1];
  const html = await response.text();
  assert.ok(html.includes(`<script nonce="${nonce}">`));
  for (const id of ["title", "body", "stream", "url", "watch", "key", "send"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /sessionStorage/);
  assert.match(html, /confirm\(/);
  assert.equal((await call(setup(), "/nowhere", { method: "GET" })).status, 404);
});
