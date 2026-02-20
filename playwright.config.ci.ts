import { defineConfig, devices } from "@playwright/test";

/**
 * CI Config
 * Use with: npm run test:e2e:ci
 *
 * This config uses CI settings (1 worker, no server reuse) but runs on port 3001
 * so it doesn't conflict with your dev server on port 3000
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  expect: {
    /* Default assertion timeout - individual waits can override for specific slow operations */
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        },
      },
    },
  ],

  webServer: {
    command: "vite --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false, // Force fresh server like CI
    timeout: 120 * 1000,
  },
});
