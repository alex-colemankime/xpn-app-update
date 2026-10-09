// End-to-end tests (tests/e2e): the built app in a real browser, with every
// outside service answered by fixtures, so they run the same in CI and
// offline. `npm run e2e` builds, serves and tests.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
      // A browser already on the machine (PLAYWRIGHT_CHROMIUM), else Playwright's own.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command:
      "npx vite build --logLevel error && npx vite preview --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
