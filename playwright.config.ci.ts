import { defineConfig, devices } from "@playwright/test";

/**
 * CI Config
 * Use with: npm run test:e2e:ci
 *
 * This config uses CI settings (1 worker, no server reuse) but runs on port 3001
 * so it doesn't conflict with your dev server on port 3000
 */

/**
 * Host-provided storage is a build-time switch, so it cannot be turned on per
 * test — those specs need a server of their own with the flag set.
 */
const HOST_STORAGE_TESTS = "**/pipeline-storage-host.spec.ts";
const HOST_STORAGE_PORT = 3011;
const HOST_STORAGE_URL = `http://localhost:${HOST_STORAGE_PORT}`;

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
      testIgnore: HOST_STORAGE_TESTS,
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
    {
      name: "chromium-host-storage",
      testMatch: HOST_STORAGE_TESTS,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: HOST_STORAGE_URL,
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        },
      },
    },
  ],

  webServer: [
    {
      command: "VITE_PIPELINE_STORAGE_BETA=false vite --port 3001",
      url: "http://localhost:3001",
      reuseExistingServer: false, // Force fresh server like CI
      timeout: 120 * 1000,
    },
    {
      command: `VITE_PIPELINE_STORAGE_BETA=true vite --port ${HOST_STORAGE_PORT}`,
      url: HOST_STORAGE_URL,
      reuseExistingServer: false,
      timeout: 120 * 1000,
    },
  ],
});
