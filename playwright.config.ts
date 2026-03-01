import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * Required env vars (add to .env.local):
 *   PLAYWRIGHT_TEST_EMAIL    – email of a pre-existing Supabase test user
 *   PLAYWRIGHT_TEST_PASSWORD – password of that user
 *
 * Playwright ≥ 1.45 automatically loads .env.local, so no dotenv import
 * is needed.
 */
export default defineConfig({
  testDir: "./tests",

  // Serial execution — auth state must be stable between tests
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse an already-running dev server when not in CI
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
