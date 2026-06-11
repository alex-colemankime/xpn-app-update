import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // React in its own chunk: it never changes between app updates,
        // so the PWA cache (and returning browsers) keep it while only
        // the small app chunk re-downloads on each release.
        // (Function form — required by Vite 8's rolldown bundler.)
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "WXPN 88.5 FM",
        short_name: "WXPN",
        description: "WXPN 88.5 FM Philadelphia — live stream and shows",
        theme_color: "#12100E",
        background_color: "#0D0B09",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Never let the service worker touch the live audio stream
        navigateFallbackDenylist: [/^\/xpnhi/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20 } }
          },
          {
            urlPattern: /^https:\/\/backend\.xpn\.org\/app\/uploads\/.*/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "xpn-images", expiration: { maxEntries: 100 } }
          }
        ]
      }
    })
  ]
});
