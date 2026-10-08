import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, loadEnv } from "vite";
import {
  parseArchiveFeeds as archiveFeeds,
  parseVideoSections as videoSections,
} from "./config.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Production builds without samples get an empty stand-in for samples.js, so
// the placeholder content is not even shipped as an unused file. The hook
// filters let the bundler skip calling these hooks for every other module.
function noSamples() {
  const id = "\0no-samples";
  return {
    name: "wxpn-no-samples",
    enforce: "pre",
    resolveId: { filter: { id: /(^|\/)samples\.js$/ }, handler: () => id },
    load: {
      filter: { id: new RegExp(`^${id}$`) },
      handler: () => "export const SAMPLE_UPDATES = {};",
    },
  };
}

// Link previews (Slack, iMessage, social): the share image and page address
// need absolute URLs, so they are added only when the build knows where it
// will live (VITE_SITE_URL, set by the Pages workflow).
function shareTags(env) {
  const site = (env.VITE_SITE_URL || "").replace(/\/?$/, "/");
  const meta = (attr, key, content) => ({
    tag: "meta",
    attrs: { [attr]: key, content },
    injectTo: "head",
  });
  return {
    name: "wxpn-share-tags",
    apply: "build",
    transformIndexHtml: () =>
      site === "/"
        ? []
        : [
            meta("property", "og:url", site),
            meta("property", "og:image", `${site}share-card.jpg`),
            meta("property", "og:image:width", "1200"),
            meta("property", "og:image:height", "630"),
            meta(
              "property",
              "og:image:alt",
              "The WXPN app on two phones: Listen live, and Recently played.",
            ),
            meta("name", "twitter:card", "summary_large_image"),
            meta("name", "twitter:image", `${site}share-card.jpg`),
          ],
  };
}

const origin = (url) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};

// A Content Security Policy for built apps (web and native): scripts only from
// the app itself (plus Apple's MusicKit), network only to the services the
// app uses. The inline theme script in index.html is allowed by its hash.
function contentSecurityPolicy(env) {
  return {
    name: "wxpn-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, code]) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`,
        );
        const ga4 = /^G-[A-Z0-9]+$/.test(env.VITE_GA4_ID || "");
        const connect = [
          "'self'",
          "https://origin.xpn.org",
          "https://xpn.org",
          "https://api.spotify.com",
          "https://accounts.spotify.com",
          "https://api.music.apple.com",
          "https://*.apple.com",
          origin(env.VITE_XPN_UPDATES_URL),
          origin(env.VITE_PUSH_REGISTER_URL),
          origin(env.VITE_XPN_CONCERTS_ENDPOINT),
          origin(env.VITE_XPN_LIVESTREAM_PAGE),
          origin(env.VITE_APPLE_MUSIC_TOKEN_URL),
          ...archiveFeeds(env.VITE_XPN_ARCHIVE_FEEDS).map((f) => origin(f.url)),
          // Usage reporting (analytics.js), only when a GA4 id is set.
          ...(ga4
            ? [
                "https://www.googletagmanager.com",
                "https://*.google-analytics.com",
                "https://*.analytics.google.com",
              ]
            : []),
          // Videos: the player's config (its policy key) and the Playback API.
          ...(videoSections(env.VITE_BRIGHTCOVE_VIDEOS).length
            ? ["https://players.brightcove.net", "https://edge.api.brightcove.com"]
            : []),
        ];
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${inline.join(" ")} https://js-cdn.music.apple.com${ga4 ? " https://www.googletagmanager.com" : ""}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' https: data: blob:",
          "font-src 'self'",
          // Archive episodes stream from StreamGuys (or a podcast feed's
          // host, often through a measurement redirect or two).
          "media-src 'self' https: blob:",
          `connect-src ${[...new Set(connect.filter(Boolean))].join(" ")}`,
          // 'self': the app's own frame for Brightcove's player, and the
          // design preview's frame around the app.
          "frame-src 'self' https://www.youtube-nocookie.com https://players.brightcove.net https://*.apple.com",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join("; ");
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Sample content (see config.js): on in `npm run dev`, and in builds made with
  // VITE_SHOW_SAMPLES=true. Defined as a literal so production builds drop
  // every branch that uses them.
  const showSamples = mode === "development" || env.VITE_SHOW_SAMPLES === "true";
  return {
    plugins: [
      ...(showSamples ? [] : [noSamples()]),
      react(),
      // React Compiler: memoizes components and hooks automatically.
      babel({ presets: [reactCompilerPreset()] }),
      contentSecurityPolicy(env),
      shareTags(env),
    ],
    define: {
      __SHOW_SAMPLES__: JSON.stringify(showSamples),
      __DEVICE_PREVIEW__: JSON.stringify(env.VITE_DEVICE_PREVIEW === "true"),
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      target: "es2022",
    },
  };
});
