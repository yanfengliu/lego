import { defineConfig } from "@playwright/test";

/**
 * A port of this run's own, so two Playwright runs can share a checkout.
 *
 * The dev server used to be pinned to 5267, and several agents working in one
 * worktree spent tens of minutes each queueing behind "Port 5267 is already in
 * use" — one of them resorted to killing every node process and took a sibling
 * agent down with it. The port is derived from the process id so concurrent
 * runs differ without any coordination, and `LEGO_E2E_PORT` pins it when a
 * caller needs to know the number in advance.
 *
 * Chosen here rather than in global setup because Playwright reads the config
 * before setup runs, so this is the last moment both the server and `baseURL`
 * can still agree on it.
 */
const port = Number(process.env.LEGO_E2E_PORT ?? 5267 + (process.pid % 900));
process.env.LEGO_E2E_PORT = String(port);

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
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
});
