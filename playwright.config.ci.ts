import { defineConfig, devices } from "@playwright/test";

const tangleUiE2ePort = Number(process.env.TANGLE_UI_E2E_PORT || 1200);
if (
  !Number.isInteger(tangleUiE2ePort) ||
  tangleUiE2ePort <= 0 ||
  tangleUiE2ePort > 65535
) {
  throw new Error(
    `TANGLE_UI_E2E_PORT must be a numeric TCP port, got ${JSON.stringify(process.env.TANGLE_UI_E2E_PORT)}`,
  );
}
const tangleUiE2eUrl = `http://localhost:${tangleUiE2ePort}`;

/**
 * CI Config
 * Use with: npm run test:e2e:ci
 *
 * This config uses CI settings (1 worker, no server reuse) on TANGLE_UI_E2E_PORT
 * (default 1200).
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
    baseURL: tangleUiE2eUrl,
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
    command: `vite --port ${tangleUiE2ePort} --strictPort`,
    env: { VITE_REMOTE_PIPELINES: "false" },
    url: tangleUiE2eUrl,
    reuseExistingServer: false, // Force fresh server like CI
    timeout: 120 * 1000,
  },
});
