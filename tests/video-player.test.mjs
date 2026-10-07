// The app's frame for Brightcove videos (public/video-player.html): its one
// inline script runs only under the hash its own policy names, so an edit to
// the script must update the hash too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/video-player.html", import.meta.url), "utf8");

test("the frame's script matches the hash its policy allows", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1, "one inline script");
  const hash = createHash("sha256").update(scripts[0], "utf8").digest("base64");
  const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || "";
  assert.ok(policy.includes(`'sha256-${hash}'`), `the policy should allow 'sha256-${hash}'`);
  const scriptSrc = policy.split(";").find((d) => d.trim().startsWith("script-src"));
  assert.doesNotMatch(scriptSrc, /unsafe-inline/, "no other inline script can run");
});

test("the frame hides the player's own title and description", () => {
  assert.match(
    html,
    /\.vjs-dock-text,\s*\.vjs-dock-shelf,\s*\.vjs-title-bar\s*\{\s*display: none !important;/,
  );
});

test("the frame runs only sandboxed, and loads scripts only from Brightcove's player host", () => {
  assert.match(html, /if \(self\.origin !== "null" \|\| window\.parent === window\) return;/);
  const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || "";
  const scriptSrc = policy.split(";").find((d) => d.trim().startsWith("script-src"));
  assert.doesNotMatch(scriptSrc, /\shttps:(\s|$)/, "not any https script");
  assert.match(scriptSrc, /https:\/\/players\.brightcove\.net/);
});
