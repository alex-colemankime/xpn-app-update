// The Apple Music developer token endpoint (services/apple-music-token.js):
// a JWT Apple accepts (ES256, the key's id, the team, a lifetime), signed
// so the key's public half verifies it, and only for the app's origins.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { developerToken } from "../services/apple-music-token.js";

// A stand-in MusicKit key, as Apple's .p8 file holds one.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.toString("base64").replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
const env = { MUSICKIT_KEY: pem, KEY_ID: "ABC123DEFG", TEAM_ID: "TEAM123456" };
const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

test("the token is an ES256 JWT for the key and team, valid for 30 days", async () => {
  const now = Date.UTC(2026, 9, 11);
  const { token } = await developerToken(env, { now });
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(decode(header), { alg: "ES256", kid: "ABC123DEFG" });
  assert.deepEqual(decode(payload), {
    iss: "TEAM123456",
    iat: now / 1000,
    exp: now / 1000 + 30 * 86400,
  });
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pair.publicKey,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  assert.ok(ok, "the key's public half verifies it");
});

test("the app's origins get a token; any other site doesn't", async () => {
  const ask = (origin) =>
    worker.fetch(
      new Request("https://token.test/", { headers: origin ? { Origin: origin } : {} }),
      env,
    );
  const app = await ask("capacitor://localhost");
  assert.equal(app.status, 200);
  assert.equal(app.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  assert.match((await app.json()).token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal((await ask("https://elsewhere.example")).status, 403);
  assert.equal((await worker.fetch(new Request("https://token.test/"), {})).status, 200, "kept");
});
