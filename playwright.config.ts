import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  globalSetup: "./apps/web/e2e/global-setup.ts",
  outputDir: "test-results/playwright",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5267",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
});
