import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: "remote-pipelines.spec.ts",
  outputDir: "test-results/remote-pipelines",
  reporter: [["html", { outputFolder: "playwright-report/remote-pipelines" }]],
  workers: 1,
  use: {
    ...baseConfig.use,
    baseURL: "http://127.0.0.1:3001",
  },
  projects: [{ name: "remote-pipelines", use: devices["Desktop Chrome"] }],
  webServer: {
    command:
      "VITE_REMOTE_PIPELINES_ENABLED=true VITE_BACKEND_API_URL=http://localhost:3001 VITE_REQUIRE_AUTHORIZATION=false pnpm exec vite --host 127.0.0.1 --port 3001 --strictPort",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
