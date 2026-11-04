import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "", process.cwd(), "");
const tangleUiPort = Number(env.TANGLE_UI_PORT || 3000);
if (
  !Number.isInteger(tangleUiPort) ||
  tangleUiPort <= 0 ||
  tangleUiPort > 65535
) {
  throw new Error(
    `TANGLE_UI_PORT must be a numeric TCP port, got ${JSON.stringify(env.TANGLE_UI_PORT)}`,
  );
}
const tangleUiUrl = `http://localhost:${tangleUiPort}`;

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
    baseURL: tangleUiUrl,

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
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm start",
    env: { VITE_REMOTE_PIPELINES: "false" },
    url: tangleUiUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
