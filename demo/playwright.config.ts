import { defineConfig, devices } from "@playwright/test";

/**
 * Demo-only Playwright config.
 * Run with: npx playwright test --config demo/playwright.config.ts --headed
 */
export default defineConfig({
  testDir: "./",
  testMatch: "lineage-demo.spec.ts",

  use: {
    baseURL: "http://localhost:5000",
    headless: false,

    // Always record — that's the whole point.
    video: "on",
    screenshot: "on",

    viewport: { width: 1440, height: 900 },

    // No slowMo: we control all timing explicitly inside the script so
    // animations play at normal speed and pauses feel deliberate.
  },

  // No webServer — the user runs the app via local-docker.sh.
  outputDir: "./test-results",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
