import { defineConfig, devices } from "@playwright/test";

/**
 * Host-provided storage is a build-time switch, so it cannot be turned on per
 * test — those specs need a server of their own with the flag set.
 */
const HOST_STORAGE_TESTS = "**/pipeline-storage-backend.spec.ts";

/**
 * Pinned so the pipeline routes are answered by the test and never by whatever
 * a developer happens to be running.
 */
const BACKEND_STUB_URL = "http://backend.test";
const HOST_STORAGE_PORT = 3010;
const HOST_STORAGE_URL = `http://localhost:${HOST_STORAGE_PORT}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  timeout: 60_000,
  expect: {
    /* Default assertion timeout - individual waits can override for specific slow operations */
    timeout: 10_000,
  },
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    /* Collect trace on failure. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",

    /* Record video, keep only for failed tests */
    video: "retain-on-failure",

    /* Capture screenshots on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      testIgnore: HOST_STORAGE_TESTS,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Disable CORS for CI testing (backend runs on different port)
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

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      // Explicit rather than inherited, so a developer's own .env cannot put
      // the whole suite into a storage mode it is not written for.
      command: "VITE_PIPELINE_STORAGE_BETA=false npm start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: `VITE_PIPELINE_STORAGE_BETA=true VITE_BACKEND_API_URL=${BACKEND_STUB_URL} vite --port ${HOST_STORAGE_PORT}`,
      url: HOST_STORAGE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
